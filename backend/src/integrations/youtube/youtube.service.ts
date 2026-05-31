import type { Pool } from "pg";
import { env } from "../../config/env";
import type { EventBus } from "../../services/eventBus";
import type { OverlayStore } from "../../services/store";
import { createLogger } from "../../utils/logger";
import { YouTubeChatPoller } from "./youtube.chat.poller";
import { YouTubeChatStream } from "./youtube.chat.stream";
import { YouTubeClient } from "./youtube.client";
import { YouTubeDedupStore } from "./youtube.dedup";
import {
  normalizeYouTubeChatMessage,
  normalizeYouTubeMember,
  normalizeYouTubeStreamStatus,
  normalizeYouTubeSubscriber,
  normalizeYouTubeSuperChat,
  normalizeYouTubeViewerCount
} from "./youtube.event-normalizer";
import { YouTubeLive } from "./youtube.live";
import { isPlaceholderGoogleCredential, revokeGoogleToken } from "./youtube.oauth";
import { YouTubeQuotaTracker } from "./youtube.quota";
import { YouTubeMembersPoller } from "./youtube.members.poller";
import { YouTubeSubscribersPoller } from "./youtube.subscribers.poller";
import { YouTubeSuperChatPoller } from "./youtube.superchat.poller";
import { YouTubeTokenStore } from "./youtube.tokens";
import type {
  NormalizedYouTubeEvent,
  YouTubeIntegrationState,
  YouTubeIntegrationStatus,
  YouTubeOAuthTokens,
  YouTubePollerContext,
  YouTubePollerName,
  YouTubePollerStatus,
  YouTubeServiceDeps
} from "./youtube.types";
import { toOverlayEvent } from "./youtube.types";
import { YouTubeViewerCountPoller } from "./youtube.viewer-count.poller";

const logger = createLogger("youtube:service");

type SocketEmitter = (eventName: string, payload: unknown) => void;

const pollerStatus = (name: YouTubePollerName, enabled = false): YouTubePollerStatus => ({
  name,
  enabled,
  running: false,
  status: enabled ? "idle" : "disabled",
  lastPolledAt: null,
  pollingIntervalMs: null,
  nextPageToken: null,
  errorMessage: null
});

const isMissingYouTubeChannelId = (value: string | undefined | null) =>
  !value ||
  value.includes("REPLACE_WITH") ||
  value.includes("YOUR_YOUTUBE_CHANNEL_ID") ||
  value === "UC_REPLACE_WITH_MY_CHANNEL_ID";

export class YouTubeService {
  readonly tokenStore: YouTubeTokenStore;
  readonly client: YouTubeClient;
  readonly live: YouTubeLive;
  readonly quota = new YouTubeQuotaTracker();
  private readonly dedup: YouTubeDedupStore;
  private state = new Map<string, YouTubeIntegrationState>();
  private pollerStatuses = new Map<string, Record<string, YouTubePollerStatus>>();
  private pollers = new Map<string, Array<{ stop: () => void }>>();
  private lastEvents = new Map<string, NormalizedYouTubeEvent>();
  private recentEvents = new Map<string, NormalizedYouTubeEvent[]>();
  private lastErrors = new Map<string, string>();
  private socketEmitter: SocketEmitter | null = null;

  constructor(private readonly deps: YouTubeServiceDeps) {
    this.tokenStore = new YouTubeTokenStore(deps.pool, deps.kvStore ?? null);
    this.client = new YouTubeClient(this.tokenStore);
    this.live = new YouTubeLive(this.client, deps.pool, deps.kvStore ?? null);
    this.dedup = new YouTubeDedupStore(deps.pool, deps.kvStore ?? null);
  }

  setSocketEmitter(socketEmitter: SocketEmitter) {
    this.socketEmitter = socketEmitter;
  }

  async connectOAuthAccount(overlayId: string, tokens: YouTubeOAuthTokens) {
    const channel = await this.fetchAuthorizedChannel(tokens.access_token);
    const channelId = this.requireConfiguredYouTubeChannelId();

    const saved = await this.tokenStore.saveConnection({
      overlayId,
      channelId,
      channelTitle: channel.title,
      channelHandle: channel.handle,
      tokens
    });

    logger.info("YouTube OAuth connected", {
      overlayId,
      channelId,
      channelTitle: saved?.account.channelTitle
    });
    this.socketEmitter?.("youtube:auth:updated", {
      overlayId,
      connected: true,
      channelId,
      channelTitle: saved?.account.channelTitle ?? channel.title,
      channelHandle: saved?.account.channelHandle ?? channel.handle,
      message: "YouTube connected successfully",
      timestamp: new Date().toISOString()
    });
    this.emitStatus(overlayId);
    return saved;
  }

  async disconnect(overlayId: string) {
    const auth = await this.tokenStore.getAuth(overlayId);
    await this.stopYouTubeIntegration(overlayId);

    if (auth?.tokens.accessToken) {
      await revokeGoogleToken(auth.tokens.accessToken).catch(() => undefined);
    }
    await this.tokenStore.disconnect(overlayId);
    this.state.set(overlayId, "stopped");
    this.socketEmitter?.("youtube:auth:updated", {
      overlayId,
      connected: false,
      message: "YouTube disconnected",
      timestamp: new Date().toISOString()
    });
    this.emitStatus(overlayId);
  }

  async startYouTubeIntegration(overlayId: string) {
    this.assertOverlay(overlayId);
    await this.stopYouTubeIntegration(overlayId);

    try {
      this.requireConfiguredYouTubeChannelId();
    } catch (error) {
      const message = error instanceof Error ? error.message : "YouTube channel ID is missing. Add it in creator-os.config.json.";
      this.state.set(overlayId, "stopped");
      this.setError(overlayId, message);
      throw error;
    }

    const auth = await this.tokenStore.getAuth(overlayId);
    if (!auth) {
      const message = "YouTube OAuth is not connected";
      this.state.set(overlayId, "stopped");
      this.setError(overlayId, message);
      throw Object.assign(new Error(message), { statusCode: 401, code: "YOUTUBE_NOT_CONNECTED" });
    }

    this.lastErrors.delete(overlayId);
    this.state.set(overlayId, "starting");
    this.initPollerStatuses(overlayId);
    this.emitStatus(overlayId);

    const session = await this.refreshActiveLiveSession(overlayId);
    if (session.status === "no_active_broadcast") {
      this.setError(overlayId, "No active live stream found. Start a YouTube livestream and refresh the session.");
    }

    const context = this.createPollerContext(overlayId);
    const activePollers: Array<{ stop: () => void }> = [];

    const settings = this.getYouTubeSettings();
    if (settings.chatPollingEnabled) {
      if (settings.useChatStream) {
        const fallback = () => {
          const chatPoller = new YouTubeChatPoller(context);
          activePollers.push(chatPoller);
          chatPoller.start();
        };
        const stream = new YouTubeChatStream(context, fallback);
        activePollers.push(stream);
        stream.start();
      } else {
        const chatPoller = new YouTubeChatPoller(context);
        activePollers.push(chatPoller);
        chatPoller.start();
      }
    }

    if (settings.superchatPollingEnabled) {
      const superChatPoller = new YouTubeSuperChatPoller(context);
      activePollers.push(superChatPoller);
      superChatPoller.start();
    }

    if (settings.viewerCountPollingEnabled) {
      const viewerPoller = new YouTubeViewerCountPoller(context);
      activePollers.push(viewerPoller);
      viewerPoller.start();
    }

    if (settings.subscriberPollingEnabled) {
      const subscriberPoller = new YouTubeSubscribersPoller(context);
      activePollers.push(subscriberPoller);
      subscriberPoller.start();
    }

    if (settings.memberPollingEnabled) {
      const memberPoller = new YouTubeMembersPoller(context, async () => {
        const auth = await this.tokenStore.getAuth(overlayId);
        return auth?.tokens.scope ?? "";
      });
      activePollers.push(memberPoller);
      void memberPoller.start();
    }

    this.pollers.set(overlayId, activePollers);
    this.state.set(overlayId, "running");
    this.emitStatus(overlayId);
    logger.info("YouTube integration started", { overlayId, pollerCount: activePollers.length });
    return this.getYouTubeIntegrationStatus(overlayId);
  }

  async stopYouTubeIntegration(overlayId: string) {
    const pollers = this.pollers.get(overlayId) ?? [];
    pollers.forEach((poller) => poller.stop());
    this.pollers.delete(overlayId);
    this.state.set(overlayId, "stopped");
    this.emitStatus(overlayId);
    return this.getYouTubeIntegrationStatus(overlayId);
  }

  async restartYouTubeIntegration(overlayId: string) {
    await this.stopYouTubeIntegration(overlayId);
    return this.startYouTubeIntegration(overlayId);
  }

  async refreshActiveLiveSession(overlayId: string) {
    this.assertOverlay(overlayId);
    const session = await this.live.refreshActiveSession(overlayId);
    await this.emitYouTubeEvent(normalizeYouTubeStreamStatus(overlayId, session.status, { session }));
    this.socketEmitter?.("youtube:session:updated", {
      overlayId,
      session,
      message:
        session.status === "no_active_broadcast"
          ? "No active livestream found. Start a YouTube livestream and click Refresh Session."
          : "YouTube live session refreshed",
      timestamp: new Date().toISOString()
    });
    this.emitStatus(overlayId);
    return session;
  }

  async getYouTubeIntegrationStatus(overlayId: string): Promise<YouTubeIntegrationStatus> {
    const authStatus = await this.tokenStore.getPublicStatus(overlayId);
    const channelId = this.getConfiguredYouTubeChannelId();
    const warnings = [
      "Subscriber alerts are best-effort because YouTube does not expose all private subscriber events.",
      "Membership alerts require channel eligibility and correct OAuth scope.",
      "Live chat needs an active livestream with live chat enabled.",
      ...(isMissingYouTubeChannelId(channelId)
        ? ["YouTube channel ID is missing. Add it in creator-os.config.json."]
        : []),
      ...(this.isMissingOAuthCredentials()
        ? [
            this.deps.runtimeSettings
              ? "Google OAuth credentials are missing. Add them in Settings or backend/.env.local."
              : "Google OAuth credentials are missing. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env.local."
          ]
        : []),
      ...this.quota.snapshot().warnings
    ];

    return {
      overlayId,
      state: this.state.get(overlayId) ?? "stopped",
      connected: authStatus.connected,
      channelId: authStatus.channelId,
      channelTitle: authStatus.channelTitle,
      channelHandle: authStatus.channelHandle,
      scope: authStatus.scope,
      tokenExpiryDate: authStatus.expiryDate,
      liveSession: this.live.getCachedSession(overlayId),
      pollers: this.getPollerStatuses(overlayId),
      lastEvent: this.lastEvents.get(overlayId) ?? null,
      lastError: this.lastErrors.get(overlayId) ?? null,
      quota: this.quota.snapshot(),
      warnings,
      updatedAt: new Date().toISOString()
    };
  }

  getRecentEvents(overlayId: string, limit = 25) {
    return (this.recentEvents.get(overlayId) ?? []).slice(0, limit);
  }

  async emitTestEvent(overlayId: string, type: "chat" | "superchat" | "viewer_count" | "subscriber" | "membership") {
    const publishedAt = new Date().toISOString();
    const rawByType = {
      chat: {
        id: `yt-test-chat-${Date.now()}`,
        snippet: { displayMessage: "This is a local YouTube test chat.", publishedAt, type: "textMessageEvent" },
        authorDetails: {
          displayName: "YouTube Tester",
          profileImageUrl: "https://yt3.ggpht.com/ytc/default-user=s88-c-k-c0x00ffffff-no-rj",
          isVerified: true,
          isChatOwner: false,
          isChatSponsor: true,
          isChatModerator: false
        }
      },
      superchat: {
        id: `yt-test-superchat-${Date.now()}`,
        snippet: {
          createdAt: publishedAt,
          supporterDetails: {
            displayName: "Super Chat Tester",
            profileImageUrl: "https://yt3.ggpht.com/ytc/default-user=s88-c-k-c0x00ffffff-no-rj"
          },
          commentText: "This is a local Super Chat test.",
          amountMicros: 100000000,
          currency: "INR",
          displayString: "₹100.00",
          messageType: 1
        }
      },
      viewer_count: { videoId: "test-video", count: 42, publishedAt },
      subscriber: {
        id: `yt-test-subscriber-${Date.now()}`,
        subscriberSnippet: {
          channelId: `yt-test-subscriber-channel-${Date.now()}`,
          title: "Subscriber Tester",
          publishedAt,
          thumbnails: { default: { url: "https://yt3.ggpht.com/ytc/default-user=s88-c-k-c0x00ffffff-no-rj" } }
        }
      },
      membership: {
        id: `yt-test-member-${Date.now()}`,
        snippet: {
          memberDetails: {
            displayName: "Member Tester",
            profileImageUrl: "https://yt3.ggpht.com/ytc/default-user=s88-c-k-c0x00ffffff-no-rj",
            channelId: "yt-test-member-channel"
          },
          membershipsDetails: { highestAccessibleLevelDisplayName: "Gold", memberSince: publishedAt }
        }
      }
    };

    const event =
      type === "chat"
        ? normalizeYouTubeChatMessage(rawByType.chat, overlayId)
        : type === "superchat"
          ? normalizeYouTubeSuperChat(rawByType.superchat, overlayId)
          : type === "viewer_count"
            ? normalizeYouTubeViewerCount(rawByType.viewer_count.videoId, rawByType.viewer_count.count, overlayId, publishedAt)
            : type === "subscriber"
              ? normalizeYouTubeSubscriber(rawByType.subscriber, overlayId)
              : normalizeYouTubeMember(rawByType.membership, overlayId);

    await this.emitYouTubeEvent(event);
    return event;
  }

  private async emitYouTubeEvent(event: NormalizedYouTubeEvent) {
    const duplicate = await this.dedup.isDuplicateAndRecord(event);
    if (duplicate) {
      return;
    }

    const result = this.deps.eventBus.publish(toOverlayEvent(event));
    this.lastEvents.set(event.overlayId, event);
    this.recentEvents.set(event.overlayId, [event, ...(this.recentEvents.get(event.overlayId) ?? [])].slice(0, 50));

    if (result.accepted) {
      logger.info("Event broadcasted", { overlayId: event.overlayId, type: event.type, eventId: event.id });
    }

    this.socketEmitter?.("youtube:event", {
      overlayId: event.overlayId,
      event,
      timestamp: new Date().toISOString()
    });
    this.emitStatus(event.overlayId);
  }

  private createPollerContext(overlayId: string): YouTubePollerContext {
    return {
      overlayId,
      client: this.client,
      live: this.live,
      dedup: this.dedup,
      quota: this.quota,
      emitEvent: (event) => this.emitYouTubeEvent(event),
      setPollerStatus: (status) => this.setPollerStatus(overlayId, status),
      setError: (message, name) => this.setError(overlayId, message, name)
    };
  }

  private setPollerStatus(overlayId: string, status: Partial<YouTubePollerStatus> & { name: YouTubePollerName }) {
    const current = this.getPollerStatuses(overlayId);
    current[status.name] = {
      ...pollerStatus(status.name),
      ...(current[status.name] ?? {}),
      ...status
    };
    this.pollerStatuses.set(overlayId, current);
    void this.persistPollerStatus(overlayId, current[status.name]);
    this.emitStatus(overlayId);
  }

  private async persistPollerStatus(overlayId: string, status: YouTubePollerStatus) {
    if (this.deps.kvStore) {
      const key = `liveora:youtube-pollers:${overlayId}`;
      const current = this.deps.kvStore.get<Record<string, YouTubePollerStatus>>(key) ?? {};
      this.deps.kvStore.set(key, { ...current, [status.name]: status });
    }

    if (!this.deps.pool) {
      return;
    }

    await this.deps.pool
      .query(
        `INSERT INTO youtube_polling_state
          (overlay_id, poller_name, next_page_token, last_polled_at, polling_interval_ms, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (overlay_id, poller_name) DO UPDATE SET
          next_page_token = EXCLUDED.next_page_token,
          last_polled_at = EXCLUDED.last_polled_at,
          polling_interval_ms = EXCLUDED.polling_interval_ms,
          status = EXCLUDED.status,
          error_message = EXCLUDED.error_message,
          updated_at = now()`,
        [
          overlayId,
          status.name,
          status.nextPageToken ?? null,
          status.lastPolledAt,
          status.pollingIntervalMs,
          status.status,
          status.errorMessage
        ]
      )
      .catch(() => undefined);
  }

  private setError(overlayId: string, message: string, name?: YouTubePollerName) {
    this.lastErrors.set(overlayId, message);
    if (name) {
      this.setPollerStatus(overlayId, {
        name,
        status: "error",
        running: false,
        errorMessage: message,
        lastPolledAt: new Date().toISOString()
      });
    }
    logger.warn("YouTube integration error", { overlayId, poller: name, message });
    this.socketEmitter?.("youtube:error", {
      overlayId,
      code: "YOUTUBE_INTEGRATION_ERROR",
      message,
      poller: name,
      timestamp: new Date().toISOString()
    });
    this.emitStatus(overlayId);
  }

  private getPollerStatuses(overlayId: string) {
    if (!this.pollerStatuses.has(overlayId)) {
      this.initPollerStatuses(overlayId);
    }
    return this.pollerStatuses.get(overlayId)!;
  }

  private initPollerStatuses(overlayId: string) {
    const settings = this.getYouTubeSettings();
    const persisted = this.deps.kvStore?.get<Record<string, YouTubePollerStatus>>(`liveora:youtube-pollers:${overlayId}`) ?? {};
    this.pollerStatuses.set(overlayId, {
      chat: pollerStatus("chat", settings.chatPollingEnabled && !settings.useChatStream),
      chat_stream: pollerStatus("chat_stream", settings.chatPollingEnabled && settings.useChatStream),
      superchat: pollerStatus("superchat", settings.superchatPollingEnabled),
      viewer_count: pollerStatus("viewer_count", settings.viewerCountPollingEnabled),
      subscribers: pollerStatus("subscribers", settings.subscriberPollingEnabled),
      members: pollerStatus("members", settings.memberPollingEnabled),
      ...persisted
    });
  }

  private emitStatus(overlayId: string) {
    if (!this.socketEmitter) {
      return;
    }

    void this.getYouTubeIntegrationStatus(overlayId).then((status) => {
      this.socketEmitter?.("youtube:status", status);
      this.socketEmitter?.("youtube:status:updated", status);
    });
  }

  private assertOverlay(overlayId: string) {
    if (!this.deps.overlayStore.getOverlay(overlayId)) {
      throw Object.assign(new Error("Invalid overlay ID"), { statusCode: 404 });
    }
  }

  private async fetchAuthorizedChannel(accessToken: string) {
    const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });
    const payload = (await response.json()) as any;
    if (!response.ok) {
      throw Object.assign(new Error(payload.error?.message ?? "Failed to load YouTube channel"), { statusCode: 502 });
    }

    const item = payload.items?.[0];
    if (!item) {
      throw Object.assign(new Error("No YouTube channel was returned for this Google account"), { statusCode: 404 });
    }

    return {
      id: item.id,
      title: item.snippet?.title ?? null,
      handle: item.snippet?.customUrl ?? null
    };
  }

  private getYouTubeSettings() {
    const runtime = this.deps.runtimeSettings?.getInternalSettings().youtube;
    return {
      channelId: runtime?.channelId ?? env.YOUTUBE_CHANNEL_ID ?? "",
      channelHandle: runtime?.channelHandle ?? env.YOUTUBE_CHANNEL_HANDLE ?? "",
      useChatStream: runtime?.useChatStream ?? env.YOUTUBE_USE_CHAT_STREAM,
      chatPollingEnabled: runtime?.chatPollingEnabled ?? env.YOUTUBE_CHAT_POLLING_ENABLED,
      superchatPollingEnabled: runtime?.superchatPollingEnabled ?? env.YOUTUBE_SUPERCHAT_POLLING_ENABLED,
      viewerCountPollingEnabled: runtime?.viewerCountPollingEnabled ?? env.YOUTUBE_VIEWER_COUNT_POLLING_ENABLED,
      subscriberPollingEnabled: runtime?.subscriberPollingEnabled ?? env.YOUTUBE_SUBSCRIBER_POLLING_ENABLED,
      memberPollingEnabled: runtime?.memberPollingEnabled ?? env.YOUTUBE_MEMBER_POLLING_ENABLED
    };
  }

  private getConfiguredYouTubeChannelId() {
    return this.deps.runtimeSettings?.getYouTubeChannelId() ?? env.YOUTUBE_CHANNEL_ID ?? "";
  }

  private requireConfiguredYouTubeChannelId() {
    const channelId = this.getConfiguredYouTubeChannelId();
    if (isMissingYouTubeChannelId(channelId)) {
      throw Object.assign(new Error("YouTube channel ID is missing. Add it in creator-os.config.json."), {
        statusCode: 400,
        code: "YOUTUBE_CHANNEL_ID_MISSING"
      });
    }

    return channelId;
  }

  private isMissingOAuthCredentials() {
    const config = this.deps.runtimeSettings?.getGoogleOAuthConfig();
    return isPlaceholderGoogleCredential(config?.clientId ?? env.GOOGLE_CLIENT_ID) || isPlaceholderGoogleCredential(config?.clientSecret ?? env.GOOGLE_CLIENT_SECRET);
  }
}
