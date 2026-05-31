import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { env } from "../config/env";

const requireFromHere = createRequire(__filename);

const parseSqlitePath = (databaseUrl: string | undefined) => {
  const fallback = path.join(env.DATA_DIR, "liveora.db");
  if (!databaseUrl) {
    return fallback;
  }

  if (databaseUrl.startsWith("file:")) {
    return databaseUrl.replace(/^file:/, "");
  }

  return databaseUrl;
};

export class SQLiteKvStore {
  private readonly db: any;

  constructor(databaseUrl = env.DATABASE_URL) {
    const sqlite = requireFromHere("node:sqlite") as { DatabaseSync: new (filename: string) => any };
    const filename = parseSqlitePath(databaseUrl);
    const directory = path.dirname(filename);

    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
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
    return this.db.filename as string | undefined;
  }

  get<T>(key: string): T | null {
    const row = this.db.prepare("SELECT value FROM liveora_kv WHERE key = ?").get(key) as { value?: string } | undefined;
    if (!row?.value) {
      return null;
    }

    return JSON.parse(row.value) as T;
  }

  set<T>(key: string, value: T) {
    this.db
      .prepare(
        `INSERT INTO liveora_kv (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at`
      )
      .run(key, JSON.stringify(value), new Date().toISOString());
  }

  delete(key: string) {
    this.db.prepare("DELETE FROM liveora_kv WHERE key = ?").run(key);
  }

  ping() {
    this.db.prepare("SELECT 1 AS ok").get();
    return true;
  }
}
