import { createLogger } from "../../utils/logger";
import { normalizeYouTubeMember } from "./youtube.event-normalizer";
import { hasScope, YOUTUBE_MEMBERSHIP_SCOPE } from "./youtube.scopes";
import type { YouTubePollerContext } from "./youtube.types";

const logger = createLogger("youtube:members");

export class YouTubeMembersPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private nextPageToken: string | null = null;

  constructor(
    private readonly context: YouTubePollerContext,
    private readonly getScope: () => Promise<string>,
    private readonly intervalMs = 2 * 60_000
  ) {}

  async start() {
    if (this.running) return;

    const scope = await this.getScope();
    if (!hasScope(scope, YOUTUBE_MEMBERSHIP_SCOPE)) {
      this.context.setPollerStatus({
        name: "members",
        enabled: false,
        running: false,
        status: "disabled",
        errorMessage: "Membership scope is missing. Reconnect YouTube with membership access."
      });
      return;
    }

    this.running = true;
    this.context.setPollerStatus({ name: "members", enabled: true, running: true, status: "starting" });
    logger.info("Member poll started", { overlayId: this.context.overlayId });
    void this.tick();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.context.setPollerStatus({ name: "members", running: false, status: "stopped" });
  }

  private schedule() {
    if (this.running) this.timer = setTimeout(() => void this.tick(), this.intervalMs);
  }

  private async tick() {
    if (!this.running) {
      return;
    }

    try {
      const response = await this.context.client.get<any>(this.context.overlayId, "/members", {
        part: "snippet",
        mode: "updates",
        maxResults: 100,
        pageToken: this.nextPageToken
      });
      if (!this.running) {
        return;
      }
      this.context.quota.record("members", 2);
      this.nextPageToken = response.nextPageToken ?? this.nextPageToken;

      for (const item of response.items ?? []) {
        await this.context.emitEvent(normalizeYouTubeMember(item, this.context.overlayId));
      }

      this.context.setPollerStatus({
        name: "members",
        running: this.running,
        status: "running",
        lastPolledAt: new Date().toISOString(),
        pollingIntervalMs: this.intervalMs,
        nextPageToken: this.nextPageToken,
        errorMessage: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Membership poll failed";
      this.context.setError(message, "members");
    } finally {
      this.schedule();
    }
  }
}
