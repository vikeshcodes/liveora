import { createLogger } from "../../utils/logger";
import { normalizeYouTubeSuperChat } from "./youtube.event-normalizer";
import type { YouTubePollerContext } from "./youtube.types";

const logger = createLogger("youtube:superchat");

export class YouTubeSuperChatPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private primed = false;

  constructor(private readonly context: YouTubePollerContext, private readonly intervalMs = 30_000) {}

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
    if (this.timer) clearTimeout(this.timer);
    this.context.setPollerStatus({ name: "superchat", running: false, status: "stopped" });
  }

  private schedule() {
    if (this.running) this.timer = setTimeout(() => void this.tick(), this.intervalMs);
  }

  private async tick() {
    if (!this.running) {
      return;
    }

    try {
      const response = await this.context.client.get<any>(this.context.overlayId, "/superChatEvents", {
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
          await this.context.emitEvent(normalizeYouTubeSuperChat(item, this.context.overlayId));
        }
      } else {
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
    } catch (error) {
      this.context.setError(error instanceof Error ? error.message : "Super Chat poll failed", "superchat");
    } finally {
      this.schedule();
    }
  }
}
