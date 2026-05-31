import { createLogger } from "../../utils/logger";
import { normalizeYouTubeChatMessage } from "./youtube.event-normalizer";
import type { YouTubePollerContext } from "./youtube.types";

const logger = createLogger("youtube:chat");

export class YouTubeChatPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private nextPageToken: string | null = null;
  private primed = false;

  constructor(private readonly context: YouTubePollerContext) {}

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.context.setPollerStatus({ name: "chat", enabled: true, running: true, status: "starting" });
    logger.info("Chat poll started", { overlayId: this.context.overlayId });
    void this.tick();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.context.setPollerStatus({ name: "chat", running: false, status: "stopped" });
  }

  private schedule(delayMs: number) {
    if (!this.running) {
      return;
    }

    this.timer = setTimeout(() => void this.tick(), Math.max(2000, delayMs));
  }

  private async tick() {
    if (!this.running) {
      return;
    }

    try {
      let session = this.context.live.getCachedSession(this.context.overlayId);
      if (!session?.liveChatId) {
        session = await this.context.live.refreshActiveSession(this.context.overlayId);
      }
      if (!this.running) {
        return;
      }

      if (!session.liveChatId) {
        this.context.setPollerStatus({
          name: "chat",
          running: this.running,
          status: "error",
          errorMessage: "No active livestream chat found"
        });
        this.schedule(15_000);
        return;
      }

      const response = await this.context.client.get<any>(this.context.overlayId, "/liveChat/messages", {
        liveChatId: session.liveChatId,
        part: "id,snippet,authorDetails",
        pageToken: this.nextPageToken,
        profileImageSize: 88
      });
      if (!this.running) {
        return;
      }

      this.context.quota.record("chat", 1);
      this.nextPageToken = response.nextPageToken ?? this.nextPageToken;
      const interval = Number(response.pollingIntervalMillis ?? 5000);

      if (response.offlineAt) {
        this.context.setPollerStatus({
          name: "chat",
          running: false,
          status: "stopped",
          lastPolledAt: new Date().toISOString(),
          pollingIntervalMs: interval,
          nextPageToken: this.nextPageToken,
          errorMessage: "Live chat ended"
        });
        this.stop();
        return;
      }

      if (this.primed) {
        for (const item of response.items ?? []) {
          await this.context.emitEvent(normalizeYouTubeChatMessage(item, this.context.overlayId));
        }
      } else {
        this.primed = true;
      }

      this.context.setPollerStatus({
        name: "chat",
        running: this.running,
        status: "running",
        lastPolledAt: new Date().toISOString(),
        pollingIntervalMs: interval,
        nextPageToken: this.nextPageToken,
        errorMessage: null
      });
      this.schedule(interval);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat poll failed";
      this.context.setError(message, "chat");
      this.schedule(15_000);
    }
  }
}
