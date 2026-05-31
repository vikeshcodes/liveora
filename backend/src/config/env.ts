import { config as loadDotEnv } from "dotenv";
import { loadCreatorOsConfig } from "./localConfig";

loadDotEnv({ path: ".env.local" });
loadDotEnv();

const localConfig = loadCreatorOsConfig();
const localOrigins = [
  "http://localhost:5150",
  "http://localhost:5160",
  "http://127.0.0.1:5150",
  "http://127.0.0.1:5160"
];

const dockerOrigins = [
  process.env.APP_BASE_URL ?? "http://localhost:3080",
  process.env.PUBLIC_APP_URL ?? "http://localhost:3080",
  "http://localhost:3080",
  "http://127.0.0.1:3080"
];

const listFromEnv = (value: string | undefined, fallback: string[]) => {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const liveoraMode = process.env.LIVEORA_MODE ?? process.env.CREATOR_OS_MODE ?? localConfig.mode ?? "local";
const isDockerMode = liveoraMode === "docker";
const appBaseUrl =
  process.env.APP_BASE_URL ??
  process.env.PUBLIC_APP_URL ??
  (isDockerMode ? "http://localhost:3080" : localConfig.urls.backend);

export const env = {
  PORT: Number(process.env.PORT ?? (isDockerMode ? 3080 : localConfig.ports.backend ?? 5170)),
  HOST: process.env.HOST ?? "127.0.0.1",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  LIVEORA_MODE: liveoraMode,
  APP_BASE_URL: appBaseUrl,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? appBaseUrl,
  DATA_DIR: process.env.LIVEORA_DATA_DIR ?? process.env.DATA_DIR ?? "/app/data",
  DATABASE_PROVIDER: process.env.DATABASE_PROVIDER ?? (isDockerMode ? "sqlite" : "postgres"),
  CORS_ORIGIN: listFromEnv(process.env.CORS_ORIGIN, isDockerMode ? dockerOrigins : localOrigins),
  SOCKET_ALLOWED_ORIGINS: listFromEnv(
    process.env.SOCKET_ALLOWED_ORIGINS,
    isDockerMode ? dockerOrigins : localOrigins
  ),
  DATABASE_URL: process.env.DATABASE_URL,
  OVERLAY_TOKEN_SECRET: process.env.OVERLAY_TOKEN_SECRET ?? "change_this_secret",
  LIVEORA_ADMIN_PASSWORD: process.env.LIVEORA_ADMIN_PASSWORD,
  REQUIRE_OVERLAY_TOKEN: process.env.REQUIRE_OVERLAY_TOKEN === "true",
  FRONTEND_URL: process.env.FRONTEND_URL ?? localConfig.urls.frontend,
  ADMIN_URL: process.env.ADMIN_URL ?? localConfig.urls.admin,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ??
    `${appBaseUrl}/api/v1/youtube/auth/callback`,
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID ?? localConfig.youtube.channelId,
  YOUTUBE_CHANNEL_HANDLE: process.env.YOUTUBE_CHANNEL_HANDLE ?? localConfig.youtube.channelHandle,
  YOUTUBE_DEFAULT_OVERLAY_ID: process.env.YOUTUBE_DEFAULT_OVERLAY_ID ?? localConfig.activeOverlayId,
  YOUTUBE_USE_CHAT_STREAM:
    process.env.YOUTUBE_USE_CHAT_STREAM !== undefined
      ? process.env.YOUTUBE_USE_CHAT_STREAM === "true"
      : localConfig.youtube.useChatStream,
  YOUTUBE_CHAT_POLLING_ENABLED:
    process.env.YOUTUBE_CHAT_POLLING_ENABLED !== undefined
      ? process.env.YOUTUBE_CHAT_POLLING_ENABLED !== "false"
      : localConfig.youtube.chatPollingEnabled,
  YOUTUBE_SUPERCHAT_POLLING_ENABLED:
    process.env.YOUTUBE_SUPERCHAT_POLLING_ENABLED !== undefined
      ? process.env.YOUTUBE_SUPERCHAT_POLLING_ENABLED !== "false"
      : localConfig.youtube.superchatPollingEnabled,
  YOUTUBE_VIEWER_COUNT_POLLING_ENABLED:
    process.env.YOUTUBE_VIEWER_COUNT_POLLING_ENABLED !== undefined
      ? process.env.YOUTUBE_VIEWER_COUNT_POLLING_ENABLED !== "false"
      : localConfig.youtube.viewerCountPollingEnabled,
  YOUTUBE_SUBSCRIBER_POLLING_ENABLED:
    process.env.YOUTUBE_SUBSCRIBER_POLLING_ENABLED !== undefined
      ? process.env.YOUTUBE_SUBSCRIBER_POLLING_ENABLED === "true"
      : localConfig.youtube.subscriberPollingEnabled,
  YOUTUBE_MEMBER_POLLING_ENABLED:
    process.env.YOUTUBE_MEMBER_POLLING_ENABLED !== undefined
      ? process.env.YOUTUBE_MEMBER_POLLING_ENABLED === "true"
      : localConfig.youtube.memberPollingEnabled,
  VERSION: process.env.npm_package_version ?? "0.1.0"
};
