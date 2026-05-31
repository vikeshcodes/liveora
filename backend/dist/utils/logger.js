"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = void 0;
const write = (level, scope, message, context) => {
    const payload = {
        level,
        scope,
        message,
        time: new Date().toISOString(),
        ...(context ? { context } : {})
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
        console.error(line);
        return;
    }
    if (level === "warn") {
        console.warn(line);
        return;
    }
    console.log(line);
};
const createLogger = (scope) => ({
    info: (message, context) => write("info", scope, message, context),
    warn: (message, context) => write("warn", scope, message, context),
    error: (message, context) => write("error", scope, message, context),
    debug: (message, context) => write("debug", scope, message, context)
});
exports.createLogger = createLogger;
