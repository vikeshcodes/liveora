"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeService = void 0;
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
const youtube_chat_poller_1 = require("./youtube.chat.poller");
const youtube_chat_stream_1 = require("./youtube.chat.stream");
const youtube_client_1 = require("./youtube.client");
const youtube_dedup_1 = require("./youtube.dedup");
const youtube_event_normalizer_1 = require("./youtube.event-normalizer");
const youtube_live_1 = require("./youtube.live");
const youtube_oauth_1 = require("./youtube.oauth");
const youtube_quota_1 = require("./youtube.quota");
const youtube_members_poller_1 = require("./youtube.members.poller");
const youtube_subscribers_poller_1 = require("./youtube.subscribers.poller");
const youtube_superchat_poller_1 = require("./youtube.superchat.poller");
const youtube_tokens_1 = require("./youtube.tokens");
const youtube_types_1 = require("./youtube.types");
const youtube_viewer_count_poller_1 = require("./youtube.viewer-count.poller");
const logger = (0, logger_1.createLogger)("youtube:service");
const pollerStatus = (name, enabled = false) => ({
    name,
    enabled,
    running: false,
    status: enabled ? "idle" : "disabled",
    lastPolledAt: null,
    pollingIntervalMs: null,
    nextPageToken: null,
    errorMessage: null
});
const isMissingYouTubeChannelId = (value) => !value ||
    value.includes("REPLACE_WITH") ||
    value.includes("YOUR_YOUTUBE_CHANNEL_ID") ||
    value === "UC_REPLACE_WITH_MY_CHANNEL_ID";
class YouTubeService {
    deps;
    tokenStore;
    client;
    live;
    quota = new youtube_quota_1.YouTubeQuotaTracker();
    dedup;
    state = new Map();
    pollerStatuses = new Map();
    pollers = new Map();
    lastEvents = new Map();
    recentEvents = new Map();
    lastErrors = new Map();
    socketEmitter = null;
    constructor(deps) {
        this.deps = deps;
        this.tokenStore = new youtube_tokens_1.YouTubeTokenStore(deps.pool, deps.kvStore ?? null);
        this.client = new youtube_client_1.YouTubeClient(this.tokenStore);
        this.live = new youtube_live_1.YouTubeLive(this.client, deps.pool, deps.kvStore ?? null);
        this.dedup = new youtube_dedup_1.YouTubeDedupStore(deps.pool, deps.kvStore ?? null);
    }
    setSocketEmitter(socketEmitter) {
        this.socketEmitter = socketEmitter;
    }
    async connectOAuthAccount(overlayId, tokens) {
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
    async disconnect(overlayId) {
        const auth = await this.tokenStore.getAuth(overlayId);
        await this.stopYouTubeIntegration(overlayId);
        if (auth?.tokens.accessToken) {
            await (0, youtube_oauth_1.revokeGoogleToken)(auth.tokens.accessToken).catch(() => undefined);
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
    async startYouTubeIntegration(overlayId) {
        this.assertOverlay(overlayId);
        await this.stopYouTubeIntegration(overlayId);
        try {
            this.requireConfiguredYouTubeChannelId();
        }
        catch (error) {
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
        const activePollers = [];
        const settings = this.getYouTubeSettings();
        if (settings.chatPollingEnabled) {
            if (settings.useChatStream) {
                const fallback = () => {
                    const chatPoller = new youtube_chat_poller_1.YouTubeChatPoller(context);
                    activePollers.push(chatPoller);
                    chatPoller.start();
                };
                const stream = new youtube_chat_stream_1.YouTubeChatStream(context, fallback);
                activePollers.push(stream);
                stream.start();
            }
            else {
                const chatPoller = new youtube_chat_poller_1.YouTubeChatPoller(context);
                activePollers.push(chatPoller);
                chatPoller.start();
            }
        }
        if (settings.superchatPollingEnabled) {
            const superChatPoller = new youtube_superchat_poller_1.YouTubeSuperChatPoller(context);
            activePollers.push(superChatPoller);
            superChatPoller.start();
        }
        if (settings.viewerCountPollingEnabled) {
            const viewerPoller = new youtube_viewer_count_poller_1.YouTubeViewerCountPoller(context);
            activePollers.push(viewerPoller);
            viewerPoller.start();
        }
        if (settings.subscriberPollingEnabled) {
            const subscriberPoller = new youtube_subscribers_poller_1.YouTubeSubscribersPoller(context);
            activePollers.push(subscriberPoller);
            subscriberPoller.start();
        }
        if (settings.memberPollingEnabled) {
            const memberPoller = new youtube_members_poller_1.YouTubeMembersPoller(context, async () => {
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
    async stopYouTubeIntegration(overlayId) {
        const pollers = this.pollers.get(overlayId) ?? [];
        pollers.forEach((poller) => poller.stop());
        this.pollers.delete(overlayId);
        this.state.set(overlayId, "stopped");
        this.emitStatus(overlayId);
        return this.getYouTubeIntegrationStatus(overlayId);
    }
    async restartYouTubeIntegration(overlayId) {
        await this.stopYouTubeIntegration(overlayId);
        return this.startYouTubeIntegration(overlayId);
    }
    async refreshActiveLiveSession(overlayId) {
        this.assertOverlay(overlayId);
        const session = await this.live.refreshActiveSession(overlayId);
        await this.emitYouTubeEvent((0, youtube_event_normalizer_1.normalizeYouTubeStreamStatus)(overlayId, session.status, { session }));
        this.socketEmitter?.("youtube:session:updated", {
            overlayId,
            session,
            message: session.status === "no_active_broadcast"
                ? "No active livestream found. Start a YouTube livestream and click Refresh Session."
                : "YouTube live session refreshed",
            timestamp: new Date().toISOString()
        });
        this.emitStatus(overlayId);
        return session;
    }
    async getYouTubeIntegrationStatus(overlayId) {
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
    getRecentEvents(overlayId, limit = 25) {
        return (this.recentEvents.get(overlayId) ?? []).slice(0, limit);
    }
    async emitTestEvent(overlayId, type) {
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
        const event = type === "chat"
            ? (0, youtube_event_normalizer_1.normalizeYouTubeChatMessage)(rawByType.chat, overlayId)
            : type === "superchat"
                ? (0, youtube_event_normalizer_1.normalizeYouTubeSuperChat)(rawByType.superchat, overlayId)
                : type === "viewer_count"
                    ? (0, youtube_event_normalizer_1.normalizeYouTubeViewerCount)(rawByType.viewer_count.videoId, rawByType.viewer_count.count, overlayId, publishedAt)
                    : type === "subscriber"
                        ? (0, youtube_event_normalizer_1.normalizeYouTubeSubscriber)(rawByType.subscriber, overlayId)
                        : (0, youtube_event_normalizer_1.normalizeYouTubeMember)(rawByType.membership, overlayId);
        await this.emitYouTubeEvent(event);
        return event;
    }
    async emitYouTubeEvent(event) {
        const duplicate = await this.dedup.isDuplicateAndRecord(event);
        if (duplicate) {
            return;
        }
        const result = this.deps.eventBus.publish((0, youtube_types_1.toOverlayEvent)(event));
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
    createPollerContext(overlayId) {
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
    setPollerStatus(overlayId, status) {
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
    async persistPollerStatus(overlayId, status) {
        if (this.deps.kvStore) {
            const key = `liveora:youtube-pollers:${overlayId}`;
            const current = this.deps.kvStore.get(key) ?? {};
            this.deps.kvStore.set(key, { ...current, [status.name]: status });
        }
        if (!this.deps.pool) {
            return;
        }
        await this.deps.pool
            .query(`INSERT INTO youtube_polling_state
          (overlay_id, poller_name, next_page_token, last_polled_at, polling_interval_ms, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (overlay_id, poller_name) DO UPDATE SET
          next_page_token = EXCLUDED.next_page_token,
          last_polled_at = EXCLUDED.last_polled_at,
          polling_interval_ms = EXCLUDED.polling_interval_ms,
          status = EXCLUDED.status,
          error_message = EXCLUDED.error_message,
          updated_at = now()`, [
            overlayId,
            status.name,
            status.nextPageToken ?? null,
            status.lastPolledAt,
            status.pollingIntervalMs,
            status.status,
            status.errorMessage
        ])
            .catch(() => undefined);
    }
    setError(overlayId, message, name) {
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
    getPollerStatuses(overlayId) {
        if (!this.pollerStatuses.has(overlayId)) {
            this.initPollerStatuses(overlayId);
        }
        return this.pollerStatuses.get(overlayId);
    }
    initPollerStatuses(overlayId) {
        const settings = this.getYouTubeSettings();
        const persisted = this.deps.kvStore?.get(`liveora:youtube-pollers:${overlayId}`) ?? {};
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
    emitStatus(overlayId) {
        if (!this.socketEmitter) {
            return;
        }
        void this.getYouTubeIntegrationStatus(overlayId).then((status) => {
            this.socketEmitter?.("youtube:status", status);
            this.socketEmitter?.("youtube:status:updated", status);
        });
    }
    assertOverlay(overlayId) {
        if (!this.deps.overlayStore.getOverlay(overlayId)) {
            throw Object.assign(new Error("Invalid overlay ID"), { statusCode: 404 });
        }
    }
    async fetchAuthorizedChannel(accessToken) {
        const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        });
        const payload = (await response.json());
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
    getYouTubeSettings() {
        const runtime = this.deps.runtimeSettings?.getInternalSettings().youtube;
        return {
            channelId: runtime?.channelId ?? env_1.env.YOUTUBE_CHANNEL_ID ?? "",
            channelHandle: runtime?.channelHandle ?? env_1.env.YOUTUBE_CHANNEL_HANDLE ?? "",
            useChatStream: runtime?.useChatStream ?? env_1.env.YOUTUBE_USE_CHAT_STREAM,
            chatPollingEnabled: runtime?.chatPollingEnabled ?? env_1.env.YOUTUBE_CHAT_POLLING_ENABLED,
            superchatPollingEnabled: runtime?.superchatPollingEnabled ?? env_1.env.YOUTUBE_SUPERCHAT_POLLING_ENABLED,
            viewerCountPollingEnabled: runtime?.viewerCountPollingEnabled ?? env_1.env.YOUTUBE_VIEWER_COUNT_POLLING_ENABLED,
            subscriberPollingEnabled: runtime?.subscriberPollingEnabled ?? env_1.env.YOUTUBE_SUBSCRIBER_POLLING_ENABLED,
            memberPollingEnabled: runtime?.memberPollingEnabled ?? env_1.env.YOUTUBE_MEMBER_POLLING_ENABLED
        };
    }
    getConfiguredYouTubeChannelId() {
        return this.deps.runtimeSettings?.getYouTubeChannelId() ?? env_1.env.YOUTUBE_CHANNEL_ID ?? "";
    }
    requireConfiguredYouTubeChannelId() {
        const channelId = this.getConfiguredYouTubeChannelId();
        if (isMissingYouTubeChannelId(channelId)) {
            throw Object.assign(new Error("YouTube channel ID is missing. Add it in creator-os.config.json."), {
                statusCode: 400,
                code: "YOUTUBE_CHANNEL_ID_MISSING"
            });
        }
        return channelId;
    }
    isMissingOAuthCredentials() {
        const config = this.deps.runtimeSettings?.getGoogleOAuthConfig();
        return (0, youtube_oauth_1.isPlaceholderGoogleCredential)(config?.clientId ?? env_1.env.GOOGLE_CLIENT_ID) || (0, youtube_oauth_1.isPlaceholderGoogleCredential)(config?.clientSecret ?? env_1.env.GOOGLE_CLIENT_SECRET);
    }
}
exports.YouTubeService = YouTubeService;
