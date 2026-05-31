import { Pool } from "pg";
import { env } from "../config/env";

export const createDatabasePool = () => {
  if (env.DATABASE_PROVIDER === "sqlite") {
    return null;
  }

  if (!env.DATABASE_URL) {
    return null;
  }

  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 30_000
  });
};
