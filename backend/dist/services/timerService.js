"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimerService = void 0;
const DEFAULT_DURATION_MS = 25 * 60 * 1000;
const TIMERS_KEY = "liveora:timers";
class TimerService {
    kvStore;
    timers = new Map();
    constructor(kvStore = null) {
        this.kvStore = kvStore;
        const persisted = this.kvStore?.get(TIMERS_KEY) ?? [];
        this.timers = new Map(persisted.map((timer) => [timer.overlayId, timer]));
    }
    get(overlayId) {
        return this.timers.get(overlayId) ?? this.createIdleState(overlayId);
    }
    start(overlayId, durationSeconds) {
        const current = this.get(overlayId);
        const durationMs = durationSeconds ? Math.max(1, durationSeconds) * 1000 : current.remainingMs || DEFAULT_DURATION_MS;
        const now = Date.now();
        const next = {
            overlayId,
            status: "running",
            durationMs,
            remainingMs: durationMs,
            startedAt: new Date(now).toISOString(),
            endsAt: new Date(now + durationMs).toISOString(),
            updatedAt: new Date(now).toISOString()
        };
        this.timers.set(overlayId, next);
        this.persist();
        return next;
    }
    pause(overlayId) {
        const current = this.get(overlayId);
        const remainingMs = current.status === "running" && current.endsAt
            ? Math.max(0, new Date(current.endsAt).getTime() - Date.now())
            : current.remainingMs;
        const next = {
            ...current,
            status: "paused",
            remainingMs,
            endsAt: null,
            updatedAt: new Date().toISOString()
        };
        this.timers.set(overlayId, next);
        this.persist();
        return next;
    }
    reset(overlayId, durationSeconds) {
        const durationMs = durationSeconds ? Math.max(1, durationSeconds) * 1000 : DEFAULT_DURATION_MS;
        const next = {
            overlayId,
            status: "idle",
            durationMs,
            remainingMs: durationMs,
            startedAt: null,
            endsAt: null,
            updatedAt: new Date().toISOString()
        };
        this.timers.set(overlayId, next);
        this.persist();
        return next;
    }
    persist() {
        this.kvStore?.set(TIMERS_KEY, [...this.timers.values()]);
    }
    createIdleState(overlayId) {
        return {
            overlayId,
            status: "idle",
            durationMs: DEFAULT_DURATION_MS,
            remainingMs: DEFAULT_DURATION_MS,
            startedAt: null,
            endsAt: null,
            updatedAt: new Date().toISOString()
        };
    }
}
exports.TimerService = TimerService;
