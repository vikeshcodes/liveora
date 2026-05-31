"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeSuperChatPoller = void 0;
const logger_1 = require("../../utils/logger");
const youtube_event_normalizer_1 = require("./youtube.event-normalizer");
const logger = (0, logger_1.createLogger)("youtube:superchat");
class YouTubeSuperChatPoller {
    context;
    intervalMs;
    timer = null;
    running = false;
    primed = false;
    constructor(context, intervalMs = 30_000) {
        this.context = context;
        this.intervalMs = intervalMs;
    }
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.context.setPollerStatus({ name: "superchat", enabled: true, running: true, status: "starting" });
        logger.info("Super Chat poll started", { overlayId: this.context.overlayId });
        void this.tick();
    }
    stop() {
        this.running = false;
        if (this.timer)
            clearTimeout(this.timer);
        this.context.setPollerStatus({ name: "superchat", running: false, status: "stopped" });
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
            const response = await this.context.client.get(this.context.overlayId, "/superChatEvents", {
                part: "id,snippet",
                maxResults: 50,
                hl: "en"
            });
            if (!this.running) {
                return;
            }
            this.context.quota.record("superchat", 1);
            if (this.primed) {
                const items = [...(response.items ?? [])].reverse();
                for (const item of items) {
                    await this.context.emitEvent((0, youtube_event_normalizer_1.normalizeYouTubeSuperChat)(item, this.context.overlayId));
                }
            }
            else {
                this.primed = true;
            }
            this.context.setPollerStatus({
                name: "superchat",
                running: this.running,
                status: "running",
                lastPolledAt: new Date().toISOString(),
                pollingIntervalMs: this.intervalMs,
                errorMessage: null
            });
        }
        catch (error) {
            this.context.setError(error instanceof Error ? error.message : "Super Chat poll failed", "superchat");
        }
        finally {
            this.schedule();
        }
    }
}
exports.YouTubeSuperChatPoller = YouTubeSuperChatPoller;
