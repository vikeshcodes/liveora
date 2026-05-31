"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabasePool = void 0;
const pg_1 = require("pg");
const env_1 = require("../config/env");
const createDatabasePool = () => {
    if (env_1.env.DATABASE_PROVIDER === "sqlite") {
        return null;
    }
    if (!env_1.env.DATABASE_URL) {
        return null;
    }
    return new pg_1.Pool({
        connectionString: env_1.env.DATABASE_URL,
        max: 8,
        idleTimeoutMillis: 30_000
    });
};
exports.createDatabasePool = createDatabasePool;
