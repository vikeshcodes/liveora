"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeSubscribersPoller = void 0;
const logger_1 = require("../../utils/logger");
const youtube_event_normalizer_1 = require("./youtube.event-normalizer");
const logger = (0, logger_1.createLogger)("youtube:subscribers");
class YouTubeSubscribersPoller {
    context;
    intervalMs;
    timer = null;
    running = false;
    primed = false;
    constructor(context, intervalMs = 5 * 60_000) {
        this.context = context;
        this.intervalMs = intervalMs;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.context.setPollerStatus({ name: "subscribers", enabled: true, running: true, status: "starting" });
        logger.info("Subscriber poll started", { overlayId: this.context.overlayId });
        void this.tick();
    }
    stop() {
        this.running = false;
        if (this.timer)
            clearTimeout(this.timer);
        this.context.setPollerStatus({ name: "subscribers", running: false, status: "stopped" });
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
            const response = await this.context.client.get(this.context.overlayId, "/subscriptions", {
                part: "subscriberSnippet,snippet",
                myRecentSubscribers: true,
                maxResults: 50
            });
            if (!this.running) {
                return;
            }
            this.context.quota.record("subscribers", 1);
            if (this.primed) {
                const items = [...(response.items ?? [])].reverse();
                for (const item of items) {
                    await this.context.emitEvent((0, youtube_event_normalizer_1.normalizeYouTubeSubscriber)(item, this.context.overlayId));
                }
            }
            else {
                this.primed = true;
            }
            this.context.setPollerStatus({
                name: "subscribers",
                running: this.running,
                status: "running",
                lastPolledAt: new Date().toISOString(),
                pollingIntervalMs: this.intervalMs,
                errorMessage: "Best-effort only: private subscribers may not appear."
            });
        }
        catch (error) {
            this.context.setError(error instanceof Error ? error.message : "Subscriber poll failed", "subscribers");
        }
        finally {
            this.schedule();
        }
    }
}
exports.YouTubeSubscribersPoller = YouTubeSubscribersPoller;
