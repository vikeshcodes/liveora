"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeSettingsService = void 0;
const node_crypto_1 = require("node:crypto");
const env_1 = require("../config/env");
const localConfig_1 = require("../config/localConfig");
const SETTINGS_KEY = "liveora:settings";
const SECRET_PREFIX = "v1";
const key = (0, node_crypto_1.createHash)("sha256").update(env_1.env.OVERLAY_TOKEN_SECRET).digest();
const isPlaceholder = (value) => !value || value.includes("REPLACE_WITH") || value.includes("YOUR_YOUTUBE_CHANNEL_ID") || value.startsWith("replace_with_");
const encrypt = (value) => {
    if (!value) {
        return null;
    }
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [SECRET_PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
};
const decrypt = (value) => {
    if (!value) {
        return "";
    }
    const [version, ivRaw, tagRaw, payloadRaw] = value.split(":");
    if (version !== SECRET_PREFIX || !ivRaw || !tagRaw || !payloadRaw) {
        return value;
    }
    const decipher = (0, node_crypto_1.createDecipheriv)("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(payloadRaw, "base64url")), decipher.final()]).toString("utf8");
};
const maskSecret = (value) => {
    if (!value) {
        return "";
    }
    if (value.length <= 8) {
        return "••••••••";
    }
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};
class RuntimeSettingsService {
    kvStore;
    constructor(kvStore) {
        this.kvStore = kvStore;
    }
    getInternalSettings() {
        const stored = this.kvStore?.get(SETTINGS_KEY);
        return this.normalize(stored ?? {});
    }
    getPublicSettings(themes = [], widgets = [], scenes = []) {
        const settings = this.getInternalSettings();
        const googleClientSecret = decrypt(settings.youtube.googleClientSecretEncrypted);
        const googleClientId = this.getGoogleClientId(settings);
        const configuredChannelId = !isPlaceholder(settings.youtube.channelId);
        const localPublicConfig = (0, localConfig_1.getPublicCreatorOsConfig)();
        const urls = settings.mode === "docker"
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
                adminPasswordEnabled: Boolean(env_1.env.LIVEORA_ADMIN_PASSWORD)
            }
        };
    }
    updateSettings(patch) {
        const current = this.getInternalSettings();
        const next = {
            ...current,
            ...patch,
            youtube: {
                ...current.youtube,
                ...(patch.youtube ?? {}),
                googleClientSecretEncrypted: patch.youtube?.googleClientSecret && patch.youtube.googleClientSecret.trim()
                    ? encrypt(patch.youtube.googleClientSecret.trim())
                    : current.youtube.googleClientSecretEncrypted
            },
            updatedAt: new Date().toISOString()
        };
        delete next.youtube.googleClientSecret;
        this.kvStore?.set(SETTINGS_KEY, next);
        return next;
    }
    completeSetup(patch) {
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
        return settings.youtube.channelId || env_1.env.YOUTUBE_CHANNEL_ID || "";
    }
    getYouTubeChannelHandle() {
        const settings = this.getInternalSettings();
        return settings.youtube.channelHandle || env_1.env.YOUTUBE_CHANNEL_HANDLE || "";
    }
    getGoogleClientId(settings) {
        return settings.youtube.googleClientId || env_1.env.GOOGLE_CLIENT_ID || "";
    }
    getGoogleClientSecret(settings) {
        return decrypt(settings.youtube.googleClientSecretEncrypted) || env_1.env.GOOGLE_CLIENT_SECRET || "";
    }
    normalize(partial) {
        const localConfig = (0, localConfig_1.loadCreatorOsConfig)();
        const publicConfig = (0, localConfig_1.getPublicCreatorOsConfig)();
        const appName = partial.appName ?? (env_1.env.LIVEORA_MODE === "docker" ? "LiveOra by Vikesh Codes" : "Vikesh Codes Creator OS");
        const mode = env_1.env.LIVEORA_MODE ?? partial.mode ?? localConfig.mode;
        return {
            projectName: partial.projectName ?? appName,
            appName,
            mode,
            setupComplete: Boolean(partial.setupComplete ?? mode !== "docker"),
            activeOverlayId: partial.activeOverlayId ?? localConfig.activeOverlayId,
            appBaseUrl: partial.appBaseUrl ?? env_1.env.PUBLIC_APP_URL ?? env_1.env.APP_BASE_URL,
            youtube: {
                channelId: partial.youtube?.channelId ?? publicConfig.youtube.channelId ?? "",
                channelHandle: partial.youtube?.channelHandle ?? publicConfig.youtube.channelHandle ?? "",
                googleClientId: partial.youtube?.googleClientId ?? env_1.env.GOOGLE_CLIENT_ID ?? "",
                googleClientSecretEncrypted: partial.youtube?.googleClientSecretEncrypted ?? (env_1.env.GOOGLE_CLIENT_SECRET ? encrypt(env_1.env.GOOGLE_CLIENT_SECRET) : null),
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
exports.RuntimeSettingsService = RuntimeSettingsService;
