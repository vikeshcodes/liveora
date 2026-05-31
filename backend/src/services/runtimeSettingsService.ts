import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { loadCreatorOsConfig, getPublicCreatorOsConfig } from "../config/localConfig";
import type { LocalOverlayConfig } from "../config/localConfig";
import type { ThemeRecord } from "../types";
import type { SQLiteKvStore } from "./sqliteKvStore";

const SETTINGS_KEY = "liveora:settings";
const SECRET_PREFIX = "v1";
const key = createHash("sha256").update(env.OVERLAY_TOKEN_SECRET).digest();

export interface RuntimeSettings {
  projectName: string;
  appName: string;
  mode: string;
  setupComplete: boolean;
  activeOverlayId: string;
  appBaseUrl: string;
  youtube: {
    channelId: string;
    channelHandle: string;
    googleClientId: string;
    googleClientSecretEncrypted: string | null;
    useChatStream: boolean;
    chatPollingEnabled: boolean;
    superchatPollingEnabled: boolean;
    viewerCountPollingEnabled: boolean;
    subscriberPollingEnabled: boolean;
    memberPollingEnabled: boolean;
  };
  overlays: LocalOverlayConfig[];
  updatedAt: string;
}

export interface RuntimeSettingsPatch {
  projectName?: string;
  appName?: string;
  setupComplete?: boolean;
  activeOverlayId?: string;
  appBaseUrl?: string;
  youtube?: Partial<Omit<RuntimeSettings["youtube"], "googleClientSecretEncrypted">> & {
    googleClientSecret?: string;
  };
  overlays?: LocalOverlayConfig[];
}

const isPlaceholder = (value: string | undefined | null) =>
  !value || value.includes("REPLACE_WITH") || value.includes("YOUR_YOUTUBE_CHANNEL_ID") || value.startsWith("replace_with_");

const encrypt = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [SECRET_PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
};

const decrypt = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  const [version, ivRaw, tagRaw, payloadRaw] = value.split(":");
  if (version !== SECRET_PREFIX || !ivRaw || !tagRaw || !payloadRaw) {
    return value;
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payloadRaw, "base64url")), decipher.final()]).toString("utf8");
};

const maskSecret = (value: string) => {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "••••••••";
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};

export class RuntimeSettingsService {
  constructor(private readonly kvStore: SQLiteKvStore | null) {}

  getInternalSettings(): RuntimeSettings {
    const stored = this.kvStore?.get<RuntimeSettings>(SETTINGS_KEY);
    return this.normalize(stored ?? {});
  }

  getPublicSettings(themes: ThemeRecord[] = [], widgets: unknown[] = [], scenes: unknown[] = []) {
    const settings = this.getInternalSettings();
    const googleClientSecret = decrypt(settings.youtube.googleClientSecretEncrypted);
    const googleClientId = this.getGoogleClientId(settings);
    const configuredChannelId = !isPlaceholder(settings.youtube.channelId);
    const localPublicConfig = getPublicCreatorOsConfig();
    const urls =
      settings.mode === "docker"
        ? {
            frontend: settings.appBaseUrl,
            admin: settings.appBaseUrl,
            backend: settings.appBaseUrl
          }
        : localPublicConfig.urls;

    return {
      projectName: settings.projectName,
      appName: settings.appName,
      officialOwner: "VikeshCodes",
      mode: settings.mode,
      setupComplete: settings.setupComplete,
      activeOverlayId: settings.activeOverlayId,
      ports: settings.mode === "docker" ? { frontend: 3080, admin: 3080, backend: 3080, database: 0 } : localPublicConfig.ports,
      urls,
      youtube: {
        channelId: settings.youtube.channelId,
        channelHandle: settings.youtube.channelHandle,
        configured: configuredChannelId,
        configSource: this.kvStore ? "runtime settings" : localPublicConfig.youtube.configSource,
        defaultOverlayId: settings.activeOverlayId,
        useChatStream: settings.youtube.useChatStream,
        chatPollingEnabled: settings.youtube.chatPollingEnabled,
        superchatPollingEnabled: settings.youtube.superchatPollingEnabled,
        viewerCountPollingEnabled: settings.youtube.viewerCountPollingEnabled,
        subscriberPollingEnabled: settings.youtube.subscriberPollingEnabled,
        memberPollingEnabled: settings.youtube.memberPollingEnabled,
        googleClientIdConfigured: !isPlaceholder(googleClientId),
        googleClientSecretConfigured: !isPlaceholder(googleClientSecret),
        googleClientIdMasked: maskSecret(googleClientId),
        googleClientSecretMasked: maskSecret(googleClientSecret)
      },
      overlays: settings.overlays,
      themes,
      widgets,
      scenes,
      features: {
        localOnly: true,
        dockerAllInOne: settings.mode === "docker",
        adminPasswordEnabled: Boolean(env.LIVEORA_ADMIN_PASSWORD)
      }
    };
  }

  updateSettings(patch: RuntimeSettingsPatch) {
    const current = this.getInternalSettings();
    const next: RuntimeSettings = {
      ...current,
      ...patch,
      youtube: {
        ...current.youtube,
        ...(patch.youtube ?? {}),
        googleClientSecretEncrypted:
          patch.youtube?.googleClientSecret && patch.youtube.googleClientSecret.trim()
            ? encrypt(patch.youtube.googleClientSecret.trim())
            : current.youtube.googleClientSecretEncrypted
      },
      updatedAt: new Date().toISOString()
    };

    delete (next.youtube as Record<string, unknown>).googleClientSecret;
    this.kvStore?.set(SETTINGS_KEY, next);
    return next;
  }

  completeSetup(patch: RuntimeSettingsPatch) {
    return this.updateSettings({ ...patch, setupComplete: true });
  }

  getGoogleOAuthConfig() {
    const settings = this.getInternalSettings();
    return {
      clientId: this.getGoogleClientId(settings),
      clientSecret: this.getGoogleClientSecret(settings),
      redirectUri: `${settings.appBaseUrl}/api/v1/youtube/auth/callback`
    };
  }

  getYouTubeChannelId() {
    const settings = this.getInternalSettings();
    return settings.youtube.channelId || env.YOUTUBE_CHANNEL_ID || "";
  }

  getYouTubeChannelHandle() {
    const settings = this.getInternalSettings();
    return settings.youtube.channelHandle || env.YOUTUBE_CHANNEL_HANDLE || "";
  }

  private getGoogleClientId(settings: RuntimeSettings) {
    return settings.youtube.googleClientId || env.GOOGLE_CLIENT_ID || "";
  }

  private getGoogleClientSecret(settings: RuntimeSettings) {
    return decrypt(settings.youtube.googleClientSecretEncrypted) || env.GOOGLE_CLIENT_SECRET || "";
  }

  private normalize(partial: Partial<RuntimeSettings>): RuntimeSettings {
    const localConfig = loadCreatorOsConfig();
    const publicConfig = getPublicCreatorOsConfig();
    const appName = partial.appName ?? (env.LIVEORA_MODE === "docker" ? "LiveOra by Vikesh Codes" : "Vikesh Codes Creator OS");
    const mode = env.LIVEORA_MODE ?? partial.mode ?? localConfig.mode;

    return {
      projectName: partial.projectName ?? appName,
      appName,
      mode,
      setupComplete: Boolean(partial.setupComplete ?? mode !== "docker"),
      activeOverlayId: partial.activeOverlayId ?? localConfig.activeOverlayId,
      appBaseUrl: partial.appBaseUrl ?? env.PUBLIC_APP_URL ?? env.APP_BASE_URL,
      youtube: {
        channelId: partial.youtube?.channelId ?? publicConfig.youtube.channelId ?? "",
        channelHandle: partial.youtube?.channelHandle ?? publicConfig.youtube.channelHandle ?? "",
        googleClientId: partial.youtube?.googleClientId ?? env.GOOGLE_CLIENT_ID ?? "",
        googleClientSecretEncrypted:
          partial.youtube?.googleClientSecretEncrypted ?? (env.GOOGLE_CLIENT_SECRET ? encrypt(env.GOOGLE_CLIENT_SECRET) : null),
        useChatStream: partial.youtube?.useChatStream ?? localConfig.youtube.useChatStream,
        chatPollingEnabled: partial.youtube?.chatPollingEnabled ?? localConfig.youtube.chatPollingEnabled,
        superchatPollingEnabled: partial.youtube?.superchatPollingEnabled ?? localConfig.youtube.superchatPollingEnabled,
        viewerCountPollingEnabled: partial.youtube?.viewerCountPollingEnabled ?? localConfig.youtube.viewerCountPollingEnabled,
        subscriberPollingEnabled: partial.youtube?.subscriberPollingEnabled ?? localConfig.youtube.subscriberPollingEnabled,
        memberPollingEnabled: partial.youtube?.memberPollingEnabled ?? localConfig.youtube.memberPollingEnabled
      },
      overlays: partial.overlays ?? localConfig.overlays,
      updatedAt: partial.updatedAt ?? new Date().toISOString()
    };
  }
}
