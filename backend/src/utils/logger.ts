type LogLevel = "info" | "warn" | "error" | "debug";

const write = (level: LogLevel, scope: string, message: string, context?: Record<string, unknown>) => {
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

export const createLogger = (scope: string) => ({
  info: (message: string, context?: Record<string, unknown>) => write("info", scope, message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", scope, message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", scope, message, context),
  debug: (message: string, context?: Record<string, unknown>) => write("debug", scope, message, context)
});
