"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeTokenStore = void 0;
const node_crypto_1 = require("node:crypto");
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
const key = (0, node_crypto_1.createHash)("sha256").update(env_1.env.OVERLAY_TOKEN_SECRET).digest();
const logger = (0, logger_1.createLogger)("youtube:tokens");
const encrypt = (value) => {
    if (!value) {
        return null;
    }
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
};
const decrypt = (value) => {
    if (!value) {
        return null;
    }
    const [version, ivRaw, tagRaw, payloadRaw] = value.split(":");
    if (version !== "v1" || !ivRaw || !tagRaw || !payloadRaw) {
        return value;
    }
    const decipher = (0, node_crypto_1.createDecipheriv)("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(payloadRaw, "base64url")), decipher.final()]).toString("utf8");
};
class YouTubeTokenStore {
    pool;
    kvStore;
    memory = null;
    constructor(pool, kvStore = null) {
        this.pool = pool;
        this.kvStore = kvStore;
    }
    async saveConnection(input) {
        if (!this.pool) {
            this.memory = {
                account: {
                    id: (0, node_crypto_1.randomUUID)(),
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
            await client.query(`INSERT INTO youtube_oauth_tokens
          (youtube_account_id, access_token_encrypted, refresh_token_encrypted, scope, token_type, expiry_date)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
         ON CONFLICT (youtube_account_id) DO UPDATE SET
          access_token_encrypted = EXCLUDED.access_token_encrypted,
          refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, youtube_oauth_tokens.refresh_token_encrypted),
          scope = EXCLUDED.scope,
          token_type = EXCLUDED.token_type,
          expiry_date = EXCLUDED.expiry_date,
          updated_at = now()`, [
                account.id,
                encrypt(input.tokens.access_token),
                encrypt(input.tokens.refresh_token),
                input.tokens.scope ?? "",
                input.tokens.token_type ?? "Bearer",
                Number(input.tokens.expiry_date ?? Date.now() + 3600_000)
            ]);
            await client.query("COMMIT");
            return this.getAuth(input.overlayId);
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async updateTokens(overlayId, tokens) {
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
        await this.pool.query(`UPDATE youtube_oauth_tokens SET
        access_token_encrypted = $2,
        refresh_token_encrypted = COALESCE($3, refresh_token_encrypted),
        scope = $4,
        token_type = $5,
        expiry_date = to_timestamp($6 / 1000.0),
        updated_at = now()
       WHERE youtube_account_id = $1`, [
            current.account.id,
            encrypt(merged.accessToken),
            encrypt(merged.refreshToken),
            merged.scope,
            merged.tokenType,
            merged.expiryDate
        ]);
        return this.getAuth(overlayId);
    }
    async getAuth(overlayId) {
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
            result = await this.pool.query(`SELECT
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
         LIMIT 1`, [overlayId]);
        }
        catch (error) {
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
                accessToken: decrypt(row.access_token_encrypted),
                refreshToken: decrypt(row.refresh_token_encrypted),
                scope: row.scope ?? "",
                tokenType: row.token_type ?? "Bearer",
                expiryDate: Number(row.expiry_date)
            }
        };
    }
    async getPublicStatus(overlayId) {
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
    async disconnect(overlayId) {
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
        }
        catch (error) {
            logger.warn("Token database unavailable during disconnect", {
                message: error instanceof Error ? error.message : "Unknown database error"
            });
        }
    }
    async upsertAccount(client, input) {
        const existing = await client.query("SELECT * FROM youtube_accounts WHERE overlay_id = $1 LIMIT 1", [input.overlayId]);
        const row = existing.rows[0]
            ? (await client.query(`UPDATE youtube_accounts SET
              channel_id = $2,
              channel_title = $3,
              channel_handle = $4,
              connected = true,
              updated_at = now()
             WHERE overlay_id = $1
             RETURNING *`, [input.overlayId, input.channelId, input.channelTitle, input.channelHandle])).rows[0]
            : (await client.query(`INSERT INTO youtube_accounts (overlay_id, channel_id, channel_title, channel_handle, connected)
             VALUES ($1, $2, $3, $4, true)
             RETURNING *`, [input.overlayId, input.channelId, input.channelTitle, input.channelHandle])).rows[0];
        return this.mapAccount(row);
    }
    mapAccount(row) {
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
    kvKey(overlayId) {
        return `liveora:youtube-auth:${overlayId}`;
    }
    persistAuth(overlayId, auth) {
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
    readPersistedAuth(overlayId) {
        const persisted = this.kvStore?.get(this.kvKey(overlayId));
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
exports.YouTubeTokenStore = YouTubeTokenStore;
