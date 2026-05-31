import type { TimerState } from "../types";
import type { SQLiteKvStore } from "./sqliteKvStore";

const DEFAULT_DURATION_MS = 25 * 60 * 1000;
const TIMERS_KEY = "liveora:timers";

export class TimerService {
  private timers = new Map<string, TimerState>();

  constructor(private readonly kvStore: SQLiteKvStore | null = null) {
    const persisted = this.kvStore?.get<TimerState[]>(TIMERS_KEY) ?? [];
    this.timers = new Map(persisted.map((timer) => [timer.overlayId, timer]));
  }

  get(overlayId: string) {
    return this.timers.get(overlayId) ?? this.createIdleState(overlayId);
  }

  start(overlayId: string, durationSeconds?: number) {
    const current = this.get(overlayId);
    const durationMs = durationSeconds ? Math.max(1, durationSeconds) * 1000 : current.remainingMs || DEFAULT_DURATION_MS;
    const now = Date.now();
    const next: TimerState = {
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

  pause(overlayId: string) {
    const current = this.get(overlayId);
    const remainingMs =
      current.status === "running" && current.endsAt
        ? Math.max(0, new Date(current.endsAt).getTime() - Date.now())
        : current.remainingMs;

    const next: TimerState = {
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

  reset(overlayId: string, durationSeconds?: number) {
    const durationMs = durationSeconds ? Math.max(1, durationSeconds) * 1000 : DEFAULT_DURATION_MS;
    const next: TimerState = {
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

  private persist() {
    this.kvStore?.set(TIMERS_KEY, [...this.timers.values()]);
  }

  private createIdleState(overlayId: string): TimerState {
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
