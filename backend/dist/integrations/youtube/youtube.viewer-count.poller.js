"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeViewerCountPoller = void 0;
const logger_1 = require("../../utils/logger");
const youtube_event_normalizer_1 = require("./youtube.event-normalizer");
const logger = (0, logger_1.createLogger)("youtube:viewer-count");
class YouTubeViewerCountPoller {
    context;
    intervalMs;
    timer = null;
    running = false;
    lastCount = null;
    constructor(context, intervalMs = 20_000) {
        this.context = context;
        this.intervalMs = intervalMs;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.context.setPollerStatus({ name: "viewer_count", enabled: true, running: true, status: "starting" });
        logger.info("Viewer count poll started", { overlayId: this.context.overlayId });
        void this.tick();
    }
    stop() {
        this.running = false;
        if (this.timer)
            clearTimeout(this.timer);
        this.context.setPollerStatus({ name: "viewer_count", running: false, status: "stopped" });
    }
    schedule() {
        if (this.running)
            this.timer = setTimeout(() => void this.tick(), this.intervalMs);
    }
    async tick() {
        if (!this.running) {
            return;
        }
        try {
            let session = this.context.live.getCachedSession(this.context.overlayId);
            if (!session?.videoId) {
                session = await this.context.live.refreshActiveSession(this.context.overlayId);
            }
            if (!this.running) {
                return;
            }
            if (!session.videoId) {
                this.context.setPollerStatus({
                    name: "viewer_count",
                    status: "error",
                    running: this.running,
                    errorMessage: "No active video found"
                });
                return;
            }
            const response = await this.context.client.get(this.context.overlayId, "/videos", {
                part: "liveStreamingDetails",
                id: session.videoId
            });
            if (!this.running) {
                return;
            }
            this.context.quota.record("viewer_count", 1);
            const countRaw = response.items?.[0]?.liveStreamingDetails?.concurrentViewers;
            const count = countRaw === undefined ? null : Number(countRaw);
            if (count !== null && count !== this.lastCount) {
                this.lastCount = count;
                await this.context.emitEvent((0, youtube_event_normalizer_1.normalizeYouTubeViewerCount)(session.videoId, count, this.context.overlayId));
            }
            this.context.setPollerStatus({
                name: "viewer_count",
                running: this.running,
                status: "running",
                lastPolledAt: new Date().toISOString(),
                pollingIntervalMs: this.intervalMs,
                errorMessage: null
            });
        }
        catch (error) {
            this.context.setError(error instanceof Error ? error.message : "Viewer count poll failed", "viewer_count");
        }
        finally {
            this.schedule();
        }
    }
}
exports.YouTubeViewerCountPoller = YouTubeViewerCountPoller;
