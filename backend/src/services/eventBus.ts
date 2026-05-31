import type { OverlayEvent } from "../types";
import { normalizeEvent } from "../validators/event.schema";
import { OverlayStore } from "./store";

type EventEmitter = (overlayId: string, event: OverlayEvent) => void;

export class EventBus {
  private emitter: EventEmitter | null = null;

  constructor(private readonly store: OverlayStore) {}

  setEmitter(emitter: EventEmitter) {
    this.emitter = emitter;
  }

  publish(input: unknown) {
    const event = normalizeEvent(input);
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
