"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeChatPoller = void 0;
const logger_1 = require("../../utils/logger");
const youtube_event_normalizer_1 = require("./youtube.event-normalizer");
const logger = (0, logger_1.createLogger)("youtube:chat");
class YouTubeChatPoller {
    context;
    timer = null;
    running = false;
    nextPageToken = null;
    primed = false;
    constructor(context) {
        this.context = context;
    }
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.context.setPollerStatus({ name: "chat", enabled: true, running: true, status: "starting" });
        logger.info("Chat poll started", { overlayId: this.context.overlayId });
        void this.tick();
    }
    stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.context.setPollerStatus({ name: "chat", running: false, status: "stopped" });
    }
    schedule(delayMs) {
        if (!this.running) {
            return;
        }
        this.timer = setTimeout(() => void this.tick(), Math.max(2000, delayMs));
    }
    async tick() {
        if (!this.running) {
            return;
        }
        try {
            let session = this.context.live.getCachedSession(this.context.overlayId);
            if (!session?.liveChatId) {
                session = await this.context.live.refreshActiveSession(this.context.overlayId);
            }
            if (!this.running) {
                return;
            }
            if (!session.liveChatId) {
                this.context.setPollerStatus({
                    name: "chat",
                    running: this.running,
                    status: "error",
                    errorMessage: "No active livestream chat found"
                });
                this.schedule(15_000);
                return;
            }
            const response = await this.context.client.get(this.context.overlayId, "/liveChat/messages", {
                liveChatId: session.liveChatId,
                part: "id,snippet,authorDetails",
                pageToken: this.nextPageToken,
                profileImageSize: 88
            });
            if (!this.running) {
                return;
            }
            this.context.quota.record("chat", 1);
            this.nextPageToken = response.nextPageToken ?? this.nextPageToken;
            const interval = Number(response.pollingIntervalMillis ?? 5000);
            if (response.offlineAt) {
                this.context.setPollerStatus({
                    name: "chat",
                    running: false,
                    status: "stopped",
                    lastPolledAt: new Date().toISOString(),
                    pollingIntervalMs: interval,
                    nextPageToken: this.nextPageToken,
                    errorMessage: "Live chat ended"
                });
                this.stop();
                return;
            }
            if (this.primed) {
                for (const item of response.items ?? []) {
                    await this.context.emitEvent((0, youtube_event_normalizer_1.normalizeYouTubeChatMessage)(item, this.context.overlayId));
                }
            }
            else {
                this.primed = true;
            }
            this.context.setPollerStatus({
                name: "chat",
                running: this.running,
                status: "running",
                lastPolledAt: new Date().toISOString(),
                pollingIntervalMs: interval,
                nextPageToken: this.nextPageToken,
                errorMessage: null
            });
            this.schedule(interval);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Chat poll failed";
            this.context.setError(message, "chat");
            this.schedule(15_000);
        }
    }
}
exports.YouTubeChatPoller = YouTubeChatPoller;
