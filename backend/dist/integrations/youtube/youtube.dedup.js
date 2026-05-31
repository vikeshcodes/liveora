"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeDedupStore = void 0;
const logger_1 = require("../../utils/logger");
const logger = (0, logger_1.createLogger)("youtube:dedup");
const DEDUP_KEY = "liveora:youtube-dedup";
class YouTubeDedupStore {
    pool;
    kvStore;
    memory = new Set();
    constructor(pool, kvStore = null) {
        this.pool = pool;
        this.kvStore = kvStore;
        this.memory = new Set(this.kvStore?.get(DEDUP_KEY) ?? []);
    }
    async isDuplicateAndRecord(event) {
        const key = `${event.platform}:${event.type}:${event.id}`;
        if (!this.pool)
            return this.recordInMemory(key, event);
        try {
            const result = await this.pool.query(`INSERT INTO youtube_event_dedup (platform, event_type, external_event_id, overlay_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (platform, event_type, external_event_id) DO NOTHING
         RETURNING id`, [event.platform, event.type, event.id, event.overlayId]);
            const duplicate = result.rowCount === 0;
            if (duplicate) {
                logger.info("Duplicate YouTube event ignored", { eventId: event.id, type: event.type });
            }
            return duplicate;
        }
        catch (error) {
            logger.warn("Dedup database unavailable; using in-memory dedup", {
                message: error instanceof Error ? error.message : "Unknown database error"
            });
            return this.recordInMemory(key, event);
        }
    }
    recordInMemory(key, event) {
        if (this.memory.has(key)) {
            logger.info("Duplicate YouTube event ignored", { eventId: event.id, type: event.type });
            return true;
        }
        this.memory.add(key);
        this.kvStore?.set(DEDUP_KEY, [...this.memory].slice(-1000));
        return false;
    }
}
exports.YouTubeDedupStore = YouTubeDedupStore;
