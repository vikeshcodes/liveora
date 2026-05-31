import { createLogger } from "../../utils/logger";
import { normalizeYouTubeChatMessage } from "./youtube.event-normalizer";
import type { YouTubePollerContext } from "./youtube.types";

const logger = createLogger("youtube:chat-stream");

export class YouTubeChatStream {
  private running = false;
  private abortController: AbortController | null = null;
  private nextPageToken: string | null = null;
  private primed = false;

  constructor(private readonly context: YouTubePollerContext, private readonly onFallback: () => void) {}

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.context.setPollerStatus({ name: "chat_stream", enabled: true, running: true, status: "starting" });
    logger.info("Chat stream started", { overlayId: this.context.overlayId });
    void this.connect();
  }

  stop() {
    this.running = false;
    this.abortController?.abort();
    this.abortController = null;
    this.context.setPollerStatus({ name: "chat_stream", running: false, status: "stopped" });
  }

  private async connect() {
    try {
      let session = this.context.live.getCachedSession(this.context.overlayId);
      if (!session?.liveChatId) {
        session = await this.context.live.refreshActiveSession(this.context.overlayId);
      }
      if (!this.running) {
        return;
      }

      if (!session.liveChatId) {
        throw new Error("No active livestream chat found");
      }

      this.abortController = new AbortController();
      const stream = await this.context.client.stream(this.context.overlayId, "/liveChat/messages/streamList", {
        liveChatId: session.liveChatId,
        part: "id,snippet,authorDetails",
        pageToken: this.nextPageToken,
        maxResults: 500,
        profileImageSize: 88
      });
      if (!this.running) {
        return;
      }

      this.context.quota.record("chat_stream", 1);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (this.running) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          await this.handleLine(line);
        }
      }

      if (this.running) {
        setTimeout(() => void this.connect(), 2000);
      }
    } catch (error) {
      if (!this.running) {
        return;
      }
      const message = error instanceof Error ? error.message : "Chat stream failed";
      this.context.setError(`${message}; falling back to polling`, "chat_stream");
      this.stop();
      this.onFallback();
    }
  }

  private async handleLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) {
      return;
    }

    const payload = JSON.parse(trimmed);
    this.nextPageToken = payload.nextPageToken ?? this.nextPageToken;
    if (!this.running) {
      return;
    }
    this.context.setPollerStatus({
      name: "chat_stream",
      running: this.running,
      status: "running",
      lastPolledAt: new Date().toISOString(),
      nextPageToken: this.nextPageToken,
      errorMessage: null
    });

    if (this.primed) {
      for (const item of payload.items ?? []) {
        await this.context.emitEvent(normalizeYouTubeChatMessage(item, this.context.overlayId));
      }
    } else {
      this.primed = true;
    }
  }
}
