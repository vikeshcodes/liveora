"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeAdapter = void 0;
class YouTubeAdapter {
    onEvent;
    constructor(onEvent) {
        this.onEvent = onEvent;
    }
    async start() {
        // TODO: Add YouTube Live Chat API polling here.
        // Keep API keys and OAuth refresh tokens in backend environment variables only.
        void this.onEvent;
    }
    async stop() {
        // TODO: Stop YouTube polling timers or revoke active subscriptions.
    }
}
exports.YouTubeAdapter = YouTubeAdapter;
