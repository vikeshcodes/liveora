import type { Pool } from "pg";
import type { EventBus } from "../../services/eventBus";
import type { RuntimeSettingsService } from "../../services/runtimeSettingsService";
import type { SQLiteKvStore } from "../../services/sqliteKvStore";
import type { OverlayStore } from "../../services/store";
import type { OverlayEvent } from "../../types";

export type YouTubePollerName =
  | "chat"
  | "chat_stream"
  | "superchat"
  | "viewer_count"
  | "subscribers"
  | "members";

export type YouTubeIntegrationState = "stopped" | "starting" | "running" | "error";

export interface YouTubeOAuthTokens {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
  expiry_date?: number;
}

export interface YouTubeAccountRecord {
  id: string;
  overlayId: string;
  channelId: string;
  channelTitle: string | null;
  channelHandle: string | null;
  connected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredYouTubeAuth {
  account: YouTubeAccountRecord;
  tokens: {
    accessToken: string;
    refreshToken: string | null;
    scope: string;
    tokenType: string;
    expiryDate: number;
  };
}

export interface YouTubeLiveSession {
  overlayId: string;
  broadcastId: string | null;
  videoId: string | null;
  liveChatId: string | null;
  title: string | null;
  status: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  updatedAt: string;
}

export interface YouTubePollerStatus {
  name: YouTubePollerName;
  enabled: boolean;
  running: boolean;
  status: "idle" | "starting" | "running" | "stopped" | "error" | "disabled";
  lastPolledAt: string | null;
  pollingIntervalMs: number | null;
  nextPageToken?: string | null;
  errorMessage: string | null;
}

export interface YouTubeIntegrationStatus {
  overlayId: string;
  state: YouTubeIntegrationState;
  connected: boolean;
  channelId: string | null;
  channelTitle: string | null;
  channelHandle: string | null;
  scope: string;
  tokenExpiryDate: number | null;
  liveSession: YouTubeLiveSession | null;
  pollers: Record<string, YouTubePollerStatus>;
  lastEvent: NormalizedYouTubeEvent | null;
  lastError: string | null;
  quota: YouTubeQuotaSnapshot;
  warnings: string[];
  updatedAt: string;
}

export type YouTubeNormalizedType =
  | "chat"
  | "superchat"
  | "viewer_count"
  | "subscriber"
  | "membership"
  | "stream_status";

export interface NormalizedYouTubeEvent {
  id: string;
  platform: "youtube";
  type: YouTubeNormalizedType;
  overlayId: string;
  priority: number;
  username: string | null;
  message: string | null;
  amount: number | null;
  amountMicros?: number | null;
  currency: string | null;
  displayAmount: string | null;
  avatarUrl: string | null;
  publishedAt: string;
  count?: number | null;
  levelName?: string | null;
  reliability?: "best_effort" | "official";
  isVerified?: boolean;
  isChatOwner?: boolean;
  isChatSponsor?: boolean;
  isChatModerator?: boolean;
  meta: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface YouTubeQuotaSnapshot {
  totalApproxUnits: number;
  byPoller: Record<string, number>;
  warnings: string[];
  since: string;
}

export interface YouTubeServiceDeps {
  pool: Pool | null;
  eventBus: EventBus;
  overlayStore: OverlayStore;
  kvStore?: SQLiteKvStore | null;
  runtimeSettings?: RuntimeSettingsService | null;
}

export interface YouTubePollerContext {
  overlayId: string;
  client: import("./youtube.client").YouTubeClient;
  live: import("./youtube.live").YouTubeLive;
  dedup: import("./youtube.dedup").YouTubeDedupStore;
  quota: import("./youtube.quota").YouTubeQuotaTracker;
  emitEvent: (event: NormalizedYouTubeEvent) => Promise<void>;
  setPollerStatus: (status: Partial<YouTubePollerStatus> & { name: YouTubePollerName }) => void;
  setError: (message: string, name?: YouTubePollerName) => void;
}

export const toOverlayEvent = (event: NormalizedYouTubeEvent): Omit<OverlayEvent, "timestamp"> & { timestamp: string } => ({
  id: event.id,
  platform: "youtube",
  type: event.type,
  overlayId: event.overlayId,
  username: event.username,
  message: event.message,
  amount: event.amount,
  currency: event.currency,
  displayAmount: event.displayAmount,
  amountMicros: event.amountMicros ?? null,
  avatarUrl: event.avatarUrl,
  priority: event.priority,
  publishedAt: event.publishedAt,
  count: event.count ?? null,
  levelName: event.levelName ?? null,
  reliability: event.reliability ?? "official",
  isVerified: event.isVerified ?? false,
  isChatOwner: event.isChatOwner ?? false,
  isChatSponsor: event.isChatSponsor ?? false,
  isChatModerator: event.isChatModerator ?? false,
  timestamp: event.publishedAt,
  meta: event.meta,
  raw: event.raw
});
