"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeMembersPoller = void 0;
const logger_1 = require("../../utils/logger");
const youtube_event_normalizer_1 = require("./youtube.event-normalizer");
const youtube_scopes_1 = require("./youtube.scopes");
const logger = (0, logger_1.createLogger)("youtube:members");
class YouTubeMembersPoller {
    context;
    getScope;
    intervalMs;
    timer = null;
    running = false;
    nextPageToken = null;
    constructor(context, getScope, intervalMs = 2 * 60_000) {
        this.context = context;
        this.getScope = getScope;
        this.intervalMs = intervalMs;
    }
    async start() {
        if (this.running)
            return;
        const scope = await this.getScope();
        if (!(0, youtube_scopes_1.hasScope)(scope, youtube_scopes_1.YOUTUBE_MEMBERSHIP_SCOPE)) {
            this.context.setPollerStatus({
                name: "members",
                enabled: false,
                running: false,
                status: "disabled",
                errorMessage: "Membership scope is missing. Reconnect YouTube with membership access."
            });
            return;
        }
        this.running = true;
        this.context.setPollerStatus({ name: "members", enabled: true, running: true, status: "starting" });
        logger.info("Member poll started", { overlayId: this.context.overlayId });
        void this.tick();
    }
    stop() {
        this.running = false;
        if (this.timer)
            clearTimeout(this.timer);
        this.context.setPollerStatus({ name: "members", running: false, status: "stopped" });
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
            const response = await this.context.client.get(this.context.overlayId, "/members", {
                part: "snippet",
                mode: "updates",
                maxResults: 100,
                pageToken: this.nextPageToken
            });
            if (!this.running) {
                return;
            }
            this.context.quota.record("members", 2);
            this.nextPageToken = response.nextPageToken ?? this.nextPageToken;
            for (const item of response.items ?? []) {
                await this.context.emitEvent((0, youtube_event_normalizer_1.normalizeYouTubeMember)(item, this.context.overlayId));
            }
            this.context.setPollerStatus({
                name: "members",
                running: this.running,
                status: "running",
                lastPolledAt: new Date().toISOString(),
                pollingIntervalMs: this.intervalMs,
                nextPageToken: this.nextPageToken,
                errorMessage: null
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Membership poll failed";
            this.context.setError(message, "members");
        }
        finally {
            this.schedule();
        }
    }
}
exports.YouTubeMembersPoller = YouTubeMembersPoller;
