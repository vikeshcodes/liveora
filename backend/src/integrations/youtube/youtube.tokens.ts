import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { env } from "../../config/env";
import type { SQLiteKvStore } from "../../services/sqliteKvStore";
import { createLogger } from "../../utils/logger";
import type { StoredYouTubeAuth, YouTubeAccountRecord, YouTubeOAuthTokens } from "./youtube.types";

interface SaveConnectionInput {
  overlayId: string;
  channelId: string;
  channelTitle: string | null;
  channelHandle: string | null;
  tokens: YouTubeOAuthTokens;
}

const key = createHash("sha256").update(env.OVERLAY_TOKEN_SECRET).digest();
const logger = createLogger("youtube:tokens");

const encrypt = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
};

const decrypt = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const [version, ivRaw, tagRaw, payloadRaw] = value.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !payloadRaw) {
    return value;
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payloadRaw, "base64url")), decipher.final()]).toString("utf8");
};

export class YouTubeTokenStore {
  private memory: StoredYouTubeAuth | null = null;

  constructor(
    private readonly pool: Pool | null,
    private readonly kvStore: SQLiteKvStore | null = null
  ) {}

  async saveConnection(input: SaveConnectionInput) {
    if (!this.pool) {
      this.memory = {
        account: {
          id: randomUUID(),
          overlayId: input.overlayId,
          channelId: input.channelId,
          channelTitle: input.channelTitle,
          channelHandle: input.channelHandle,
          connected: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        tokens: {
          accessToken: input.tokens.access_token,
          refreshToken: input.tokens.refresh_token ?? null,
          scope: input.tokens.scope ?? "",
          tokenType: input.tokens.token_type ?? "Bearer",
          expiryDate: Number(input.tokens.expiry_date ?? Date.now() + 3600_000)
        }
      };
      this.persistAuth(input.overlayId, this.memory);
      return this.memory;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const account = await this.upsertAccount(client, input);
      await client.query(
        `INSERT INTO youtube_oauth_tokens
          (youtube_account_id, access_token_encrypted, refresh_token_encrypted, scope, token_type, expiry_date)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
         ON CONFLICT (youtube_account_id) DO UPDATE SET
          access_token_encrypted = EXCLUDED.access_token_encrypted,
          refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, youtube_oauth_tokens.refresh_token_encrypted),
          scope = EXCLUDED.scope,
          token_type = EXCLUDED.token_type,
          expiry_date = EXCLUDED.expiry_date,
          updated_at = now()`,
        [
          account.id,
          encrypt(input.tokens.access_token),
          encrypt(input.tokens.refresh_token),
          input.tokens.scope ?? "",
          input.tokens.token_type ?? "Bearer",
          Number(input.tokens.expiry_date ?? Date.now() + 3600_000)
        ]
      );
      await client.query("COMMIT");
      return this.getAuth(input.overlayId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateTokens(overlayId: string, tokens: YouTubeOAuthTokens) {
    const current = await this.getAuth(overlayId);
    if (!current) {
      throw Object.assign(new Error("YouTube account is not connected"), { statusCode: 401 });
    }

    const merged = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? current.tokens.refreshToken,
      scope: tokens.scope ?? current.tokens.scope,
      tokenType: tokens.token_type ?? current.tokens.tokenType,
      expiryDate: Number(tokens.expiry_date ?? Date.now() + Number(tokens.expires_in ?? 3600) * 1000)
    };

    if (!this.pool) {
      this.memory = { account: current.account, tokens: merged };
      this.persistAuth(overlayId, this.memory);
      return this.memory;
    }

    await this.pool.query(
      `UPDATE youtube_oauth_tokens SET
        access_token_encrypted = $2,
        refresh_token_encrypted = COALESCE($3, refresh_token_encrypted),
        scope = $4,
        token_type = $5,
        expiry_date = to_timestamp($6 / 1000.0),
        updated_at = now()
       WHERE youtube_account_id = $1`,
      [
        current.account.id,
        encrypt(merged.accessToken),
        encrypt(merged.refreshToken),
        merged.scope,
        merged.tokenType,
        merged.expiryDate
      ]
    );

    return this.getAuth(overlayId);
  }

  async getAuth(overlayId: string): Promise<StoredYouTubeAuth | null> {
    if (!this.pool) {
      if (this.memory?.account.overlayId === overlayId) {
        return this.memory;
      }
      const persisted = this.readPersistedAuth(overlayId);
      if (persisted?.account.connected) {
        this.memory = persisted;
        return persisted;
      }
      return null;
    }

    let result;
    try {
      result = await this.pool.query(
        `SELECT
          a.id,
          a.overlay_id,
          a.channel_id,
          a.channel_title,
          a.channel_handle,
          a.connected,
          a.created_at,
          a.updated_at,
          t.access_token_encrypted,
          t.refresh_token_encrypted,
          t.scope,
          t.token_type,
          EXTRACT(EPOCH FROM t.expiry_date) * 1000 AS expiry_date
         FROM youtube_accounts a
         LEFT JOIN youtube_oauth_tokens t ON t.youtube_account_id = a.id
         WHERE a.overlay_id = $1
         ORDER BY a.updated_at DESC
         LIMIT 1`,
        [overlayId]
      );
    } catch (error) {
      logger.warn("Token database unavailable; treating YouTube as disconnected", {
        message: error instanceof Error ? error.message : "Unknown database error"
      });
      return this.memory?.account.overlayId === overlayId ? this.memory : null;
    }

    const row = result.rows[0];
    if (!row || !row.connected || !row.access_token_encrypted) {
      return null;
    }

    return {
      account: this.mapAccount(row),
      tokens: {
        accessToken: decrypt(row.access_token_encrypted)!,
        refreshToken: decrypt(row.refresh_token_encrypted),
        scope: row.scope ?? "",
        tokenType: row.token_type ?? "Bearer",
        expiryDate: Number(row.expiry_date)
      }
    };
  }

  async getPublicStatus(overlayId: string) {
    const auth = await this.getAuth(overlayId);
    return auth
      ? {
          connected: true,
          channelId: auth.account.channelId,
          channelTitle: auth.account.channelTitle,
          channelHandle: auth.account.channelHandle,
          scope: auth.tokens.scope,
          expiryDate: auth.tokens.expiryDate
        }
      : {
          connected: false,
          channelId: null,
          channelTitle: null,
          channelHandle: null,
          scope: "",
          expiryDate: null
        };
  }

  async disconnect(overlayId: string) {
    if (!this.pool) {
      if (this.memory?.account.overlayId === overlayId) {
        this.memory.account.connected = false;
        this.persistAuth(overlayId, this.memory);
      }
      return;
    }

    try {
      await this.pool.query("UPDATE youtube_accounts SET connected = false, updated_at = now() WHERE overlay_id = $1", [
        overlayId
      ]);
    } catch (error) {
      logger.warn("Token database unavailable during disconnect", {
        message: error instanceof Error ? error.message : "Unknown database error"
      });
    }
  }

  private async upsertAccount(client: PoolClient, input: SaveConnectionInput): Promise<YouTubeAccountRecord> {
    const existing = await client.query("SELECT * FROM youtube_accounts WHERE overlay_id = $1 LIMIT 1", [input.overlayId]);
    const row = existing.rows[0]
      ? (
          await client.query(
            `UPDATE youtube_accounts SET
              channel_id = $2,
              channel_title = $3,
              channel_handle = $4,
              connected = true,
              updated_at = now()
             WHERE overlay_id = $1
             RETURNING *`,
            [input.overlayId, input.channelId, input.channelTitle, input.channelHandle]
          )
        ).rows[0]
      : (
          await client.query(
            `INSERT INTO youtube_accounts (overlay_id, channel_id, channel_title, channel_handle, connected)
             VALUES ($1, $2, $3, $4, true)
             RETURNING *`,
            [input.overlayId, input.channelId, input.channelTitle, input.channelHandle]
          )
        ).rows[0];

    return this.mapAccount(row);
  }

  private mapAccount(row: any): YouTubeAccountRecord {
    return {
      id: row.id,
      overlayId: row.overlay_id,
      channelId: row.channel_id,
      channelTitle: row.channel_title,
      channelHandle: row.channel_handle,
      connected: Boolean(row.connected),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private kvKey(overlayId: string) {
    return `liveora:youtube-auth:${overlayId}`;
  }

  private persistAuth(overlayId: string, auth: StoredYouTubeAuth | null) {
    if (!this.kvStore || !auth) {
      return;
    }

    this.kvStore.set(this.kvKey(overlayId), {
      account: auth.account,
      tokens: {
        accessTokenEncrypted: encrypt(auth.tokens.accessToken),
        refreshTokenEncrypted: encrypt(auth.tokens.refreshToken),
        scope: auth.tokens.scope,
        tokenType: auth.tokens.tokenType,
        expiryDate: auth.tokens.expiryDate
      }
    });
  }

  private readPersistedAuth(overlayId: string): StoredYouTubeAuth | null {
    const persisted = this.kvStore?.get<any>(this.kvKey(overlayId));
    if (!persisted?.account || !persisted?.tokens) {
      return null;
    }

    return {
      account: persisted.account,
      tokens: {
        accessToken: decrypt(persisted.tokens.accessTokenEncrypted) ?? "",
        refreshToken: decrypt(persisted.tokens.refreshTokenEncrypted),
        scope: persisted.tokens.scope ?? "",
        tokenType: persisted.tokens.tokenType ?? "Bearer",
        expiryDate: Number(persisted.tokens.expiryDate ?? Date.now())
      }
    };
  }
}
