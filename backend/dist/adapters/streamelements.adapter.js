"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamElementsAdapter = void 0;
class StreamElementsAdapter {
    options;
    onEvent;
    constructor(options, onEvent) {
        this.options = options;
        this.onEvent = onEvent;
    }
    async start() {
        // TODO: Connect to StreamElements webhook/socket source on the backend.
        // Never pass StreamElements JWTs or secret tokens to the overlay frontend.
        void this.options;
        void this.onEvent;
    }
    async stop() {
        // TODO: Close remote connections and cleanup adapter resources.
    }
}
exports.StreamElementsAdapter = StreamElementsAdapter;
