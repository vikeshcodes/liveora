import { createLogger } from "../../utils/logger";
import { normalizeYouTubeViewerCount } from "./youtube.event-normalizer";
import type { YouTubePollerContext } from "./youtube.types";

const logger = createLogger("youtube:viewer-count");

export class YouTubeViewerCountPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastCount: number | null = null;

  constructor(private readonly context: YouTubePollerContext, private readonly intervalMs = 20_000) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.context.setPollerStatus({ name: "viewer_count", enabled: true, running: true, status: "starting" });
    logger.info("Viewer count poll started", { overlayId: this.context.overlayId });
    void this.tick();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.context.setPollerStatus({ name: "viewer_count", running: false, status: "stopped" });
  }

  private schedule() {
    if (this.running) this.timer = setTimeout(() => void this.tick(), this.intervalMs);
  }

  private async tick() {
    if (!this.running) {
      return;
    }

    try {
      let session = this.context.live.getCachedSession(this.context.overlayId);
      if (!session?.videoId) {
        session = await this.context.live.refreshActiveSession(this.context.overlayId);
      }
      if (!this.running) {
        return;
      }

      if (!session.videoId) {
        this.context.setPollerStatus({
          name: "viewer_count",
          status: "error",
          running: this.running,
          errorMessage: "No active video found"
        });
        return;
      }

      const response = await this.context.client.get<any>(this.context.overlayId, "/videos", {
        part: "liveStreamingDetails",
        id: session.videoId
      });
      if (!this.running) {
        return;
      }
      this.context.quota.record("viewer_count", 1);

      const countRaw = response.items?.[0]?.liveStreamingDetails?.concurrentViewers;
      const count = countRaw === undefined ? null : Number(countRaw);
      if (count !== null && count !== this.lastCount) {
        this.lastCount = count;
        await this.context.emitEvent(normalizeYouTubeViewerCount(session.videoId, count, this.context.overlayId));
      }

      this.context.setPollerStatus({
        name: "viewer_count",
        running: this.running,
        status: "running",
        lastPolledAt: new Date().toISOString(),
        pollingIntervalMs: this.intervalMs,
        errorMessage: null
      });
    } catch (error) {
      this.context.setError(error instanceof Error ? error.message : "Viewer count poll failed", "viewer_count");
    } finally {
      this.schedule();
    }
  }
}
