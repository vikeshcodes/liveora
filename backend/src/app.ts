import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { Server } from "socket.io";
import type { Pool } from "pg";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createApiRouter } from "./routes/api";
import { EventBus } from "./services/eventBus";
import { OverlayStore } from "./services/store";
import { TimerService } from "./services/timerService";
import { WidgetLayoutService } from "./services/widgetLayoutService";
import type { YouTubeService } from "./integrations/youtube/youtube.service";
import type { SQLiteKvStore } from "./services/sqliteKvStore";
import type { RuntimeSettingsService } from "./services/runtimeSettingsService";

interface AppDeps {
  store: OverlayStore;
  eventBus: EventBus;
  timerService: TimerService;
  widgetLayoutService: WidgetLayoutService;
  io: Server;
  youtubeService: YouTubeService;
  pool: Pool | null;
  kvStore: SQLiteKvStore | null;
  runtimeSettingsService: RuntimeSettingsService;
}

export const createApp = (deps: AppDeps) => {
  const app = express();
  const adminPassword = env.LIVEORA_ADMIN_PASSWORD;
  const adminPasswordMiddleware: express.RequestHandler = (req, res, next) => {
    if (!adminPassword) {
      next();
      return;
    }

    const isAdminPage = req.path === "/setup" || req.path === "/admin" || req.path.startsWith("/admin/");
    const isMutatingApi = req.path.startsWith("/api/v1/") && !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (!isAdminPage && !isMutatingApi) {
      next();
      return;
    }

    const [scheme, encoded] = String(req.headers.authorization ?? "").split(" ");
    const decoded = scheme === "Basic" && encoded ? Buffer.from(encoded, "base64").toString("utf8") : "";
    const [, password] = decoded.split(":");
    if (password === adminPassword) {
      next();
      return;
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="LiveOra Admin"');
    res.status(401).json({ error: { code: "LIVEORA_ADMIN_PASSWORD_REQUIRED", message: "LiveOra admin password required" } });
  };

  app.disable("x-powered-by");
  app.use(adminPasswordMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 240,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get("/health", async (_req, res) => {
    let databaseConnected = false;
    try {
      if (deps.kvStore) {
        databaseConnected = deps.kvStore.ping();
      } else if (deps.pool) {
        await deps.pool.query("SELECT 1");
        databaseConnected = true;
      }
    } catch {
      databaseConnected = false;
    }

    res.json({
      status: "ok",
      ok: true,
      service: env.LIVEORA_MODE === "docker" ? "liveora" : "creator-os-backend",
      mode: env.LIVEORA_MODE,
      database: databaseConnected ? "connected" : "unavailable",
      databaseProvider: env.DATABASE_PROVIDER,
      version: env.VERSION,
      timestamp: new Date().toISOString()
    });
  });

  app.use("/api/v1", createApiRouter(deps));

  const publicDir = path.resolve(__dirname, "../public");
  const adminDir = path.join(publicDir, "admin");
  const overlayDir = path.join(publicDir, "overlay");
  const adminIndex = path.join(adminDir, "index.html");
  const overlayIndex = path.join(overlayDir, "index.html");
  const hasAdminBuild = existsSync(adminIndex);
  const hasOverlayBuild = existsSync(overlayIndex);

  if (hasAdminBuild || hasOverlayBuild) {
    app.get("/", (_req, res) => {
      res.redirect(deps.runtimeSettingsService.getInternalSettings().setupComplete ? "/admin" : "/setup");
    });

    if (hasAdminBuild) {
      app.use("/admin", express.static(adminDir, { redirect: false }));
      app.get(["/admin", "/admin/*", "/setup"], (_req, res) => {
        res.sendFile(adminIndex);
      });
    }

    if (hasOverlayBuild) {
      app.use("/overlay", express.static(overlayDir, { redirect: false }));
      app.get("/overlay/:overlayId", (_req, res) => {
        res.sendFile(overlayIndex);
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
