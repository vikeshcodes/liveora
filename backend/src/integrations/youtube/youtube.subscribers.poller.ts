import { createLogger } from "../../utils/logger";
import { normalizeYouTubeSubscriber } from "./youtube.event-normalizer";
import type { YouTubePollerContext } from "./youtube.types";

const logger = createLogger("youtube:subscribers");

export class YouTubeSubscribersPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private primed = false;

  constructor(private readonly context: YouTubePollerContext, private readonly intervalMs = 5 * 60_000) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.context.setPollerStatus({ name: "subscribers", enabled: true, running: true, status: "starting" });
    logger.info("Subscriber poll started", { overlayId: this.context.overlayId });
    void this.tick();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.context.setPollerStatus({ name: "subscribers", running: false, status: "stopped" });
  }

  private schedule() {
    if (this.running) this.timer = setTimeout(() => void this.tick(), this.intervalMs);
  }

  private async tick() {
    if (!this.running) {
      return;
    }

    try {
      const response = await this.context.client.get<any>(this.context.overlayId, "/subscriptions", {
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
          await this.context.emitEvent(normalizeYouTubeSubscriber(item, this.context.overlayId));
        }
      } else {
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
    } catch (error) {
      this.context.setError(error instanceof Error ? error.message : "Subscriber poll failed", "subscribers");
    } finally {
      this.schedule();
    }
  }
}
