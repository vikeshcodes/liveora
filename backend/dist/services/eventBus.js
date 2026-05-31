"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
const event_schema_1 = require("../validators/event.schema");
class EventBus {
    store;
    emitter = null;
    constructor(store) {
        this.store = store;
    }
    setEmitter(emitter) {
        this.emitter = emitter;
    }
    publish(input) {
        const event = (0, event_schema_1.normalizeEvent)(input);
        const accepted = this.store.recordEvent(event);
        if (accepted) {
            this.emitter?.(event.overlayId, event);
        }
        return {
            accepted,
            duplicate: !accepted,
            event
        };
    }
}
exports.EventBus = EventBus;
