"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteKvStore = void 0;
const node_fs_1 = require("node:fs");
const node_module_1 = require("node:module");
const node_path_1 = __importDefault(require("node:path"));
const env_1 = require("../config/env");
const requireFromHere = (0, node_module_1.createRequire)(__filename);
const parseSqlitePath = (databaseUrl) => {
    const fallback = node_path_1.default.join(env_1.env.DATA_DIR, "liveora.db");
    if (!databaseUrl) {
        return fallback;
    }
    if (databaseUrl.startsWith("file:")) {
        return databaseUrl.replace(/^file:/, "");
    }
    return databaseUrl;
};
class SQLiteKvStore {
    db;
    constructor(databaseUrl = env_1.env.DATABASE_URL) {
        const sqlite = requireFromHere("node:sqlite");
        const filename = parseSqlitePath(databaseUrl);
        const directory = node_path_1.default.dirname(filename);
        if (!(0, node_fs_1.existsSync)(directory)) {
            (0, node_fs_1.mkdirSync)(directory, { recursive: true });
        }
        this.db = new sqlite.DatabaseSync(filename);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS liveora_kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    }
    get databasePath() {
        return this.db.filename;
    }
    get(key) {
        const row = this.db.prepare("SELECT value FROM liveora_kv WHERE key = ?").get(key);
        if (!row?.value) {
            return null;
        }
        return JSON.parse(row.value);
    }
    set(key, value) {
        this.db
            .prepare(`INSERT INTO liveora_kv (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at`)
            .run(key, JSON.stringify(value), new Date().toISOString());
    }
    delete(key) {
        this.db.prepare("DELETE FROM liveora_kv WHERE key = ?").run(key);
    }
    ping() {
        this.db.prepare("SELECT 1 AS ok").get();
        return true;
    }
}
exports.SQLiteKvStore = SQLiteKvStore;
