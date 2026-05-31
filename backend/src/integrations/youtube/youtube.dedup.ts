import type { Pool } from "pg";
import type { NormalizedYouTubeEvent } from "./youtube.types";
import { createLogger } from "../../utils/logger";
import type { SQLiteKvStore } from "../../services/sqliteKvStore";

const logger = createLogger("youtube:dedup");
const DEDUP_KEY = "liveora:youtube-dedup";

export class YouTubeDedupStore {
  private memory = new Set<string>();

  constructor(
    private readonly pool: Pool | null,
    private readonly kvStore: SQLiteKvStore | null = null
  ) {
    this.memory = new Set(this.kvStore?.get<string[]>(DEDUP_KEY) ?? []);
  }

  async isDuplicateAndRecord(event: NormalizedYouTubeEvent) {
    const key = `${event.platform}:${event.type}:${event.id}`;

    if (!this.pool) return this.recordInMemory(key, event);

    try {
      const result = await this.pool.query(
        `INSERT INTO youtube_event_dedup (platform, event_type, external_event_id, overlay_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (platform, event_type, external_event_id) DO NOTHING
         RETURNING id`,
        [event.platform, event.type, event.id, event.overlayId]
      );

      const duplicate = result.rowCount === 0;
      if (duplicate) {
        logger.info("Duplicate YouTube event ignored", { eventId: event.id, type: event.type });
      }

      return duplicate;
    } catch (error) {
      logger.warn("Dedup database unavailable; using in-memory dedup", {
        message: error instanceof Error ? error.message : "Unknown database error"
      });
      return this.recordInMemory(key, event);
    }
  }

  private recordInMemory(key: string, event: NormalizedYouTubeEvent) {
    if (this.memory.has(key)) {
      logger.info("Duplicate YouTube event ignored", { eventId: event.id, type: event.type });
      return true;
    }
    this.memory.add(key);
    this.kvStore?.set(DEDUP_KEY, [...this.memory].slice(-1000));
    return false;
  }
}
