import type { Pool } from "pg";
import type { SQLiteKvStore } from "../../services/sqliteKvStore";
import { createLogger } from "../../utils/logger";
import type { YouTubeClient } from "./youtube.client";
import type { YouTubeLiveSession } from "./youtube.types";

const logger = createLogger("youtube:live");

export class YouTubeLive {
  private sessions = new Map<string, YouTubeLiveSession>();

  constructor(
    private readonly client: YouTubeClient,
    private readonly pool: Pool | null,
    private readonly kvStore: SQLiteKvStore | null = null
  ) {
    const persisted = this.kvStore?.get<YouTubeLiveSession[]>("liveora:youtube-live-sessions") ?? [];
    this.sessions = new Map(persisted.map((session) => [session.overlayId, session]));
  }

  async getActiveBroadcast(overlayId: string) {
    const response = await this.client.get<any>(overlayId, "/liveBroadcasts", {
      part: "id,snippet,contentDetails,status",
      broadcastType: "all",
      mine: true,
      maxResults: 50
    });

    const activeStatuses = new Set(["live", "liveStarting", "testing", "testStarting"]);
    return (
      response.items?.find((item: any) => activeStatuses.has(item.status?.lifeCycleStatus)) ??
      response.items?.find((item: any) => item.snippet?.actualStartTime && !item.snippet?.actualEndTime) ??
      null
    );
  }

  async getLiveChatIdFromActiveBroadcast(overlayId: string) {
    const broadcast = await this.getActiveBroadcast(overlayId);
    return broadcast?.snippet?.liveChatId ?? null;
  }

  getVideoIdFromBroadcast(broadcast: any) {
    return broadcast?.id ?? null;
  }

  async getCurrentStreamStatus(overlayId: string) {
    const session = await this.refreshActiveSession(overlayId);
    return session.status;
  }

  async refreshActiveSession(overlayId: string): Promise<YouTubeLiveSession> {
    const broadcast = await this.getActiveBroadcast(overlayId);
    const now = new Date().toISOString();

    const session: YouTubeLiveSession = broadcast
      ? {
          overlayId,
          broadcastId: broadcast.id,
          videoId: this.getVideoIdFromBroadcast(broadcast),
          liveChatId: broadcast.snippet?.liveChatId ?? null,
          title: broadcast.snippet?.title ?? null,
          status: broadcast.status?.lifeCycleStatus ?? "active",
          actualStartTime: broadcast.snippet?.actualStartTime ?? null,
          actualEndTime: broadcast.snippet?.actualEndTime ?? null,
          updatedAt: now
        }
      : {
          overlayId,
          broadcastId: null,
          videoId: null,
          liveChatId: null,
          title: null,
          status: "no_active_broadcast",
          actualStartTime: null,
          actualEndTime: null,
          updatedAt: now
        };

    this.sessions.set(overlayId, session);
    await this.persistSession(session);

    if (broadcast) {
      logger.info("Active broadcast found", {
        overlayId,
        broadcastId: session.broadcastId,
        videoId: session.videoId,
        liveChatId: session.liveChatId
      });
    } else {
      logger.info("No active broadcast", { overlayId });
    }

    return session;
  }

  getCachedSession(overlayId: string) {
    return this.sessions.get(overlayId) ?? null;
  }

  private async persistSession(session: YouTubeLiveSession) {
    this.kvStore?.set("liveora:youtube-live-sessions", [...this.sessions.values()]);

    if (!this.pool || !session.broadcastId) {
      return;
    }

    await this.pool.query(
      `INSERT INTO youtube_live_sessions
        (overlay_id, broadcast_id, video_id, live_chat_id, title, status, actual_start_time, actual_end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (overlay_id, broadcast_id) DO UPDATE SET
        video_id = EXCLUDED.video_id,
        live_chat_id = EXCLUDED.live_chat_id,
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        actual_start_time = EXCLUDED.actual_start_time,
        actual_end_time = EXCLUDED.actual_end_time,
        updated_at = now()`,
      [
        session.overlayId,
        session.broadcastId,
        session.videoId,
        session.liveChatId,
        session.title,
        session.status,
        session.actualStartTime,
        session.actualEndTime
      ]
    );
  }
}
