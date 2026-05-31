import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { env } from "./config/env";
import { configureSocket, roomForOverlay } from "./realtime/socket";
import { EventBus } from "./services/eventBus";
import { OverlayStore } from "./services/store";
import { TimerService } from "./services/timerService";
import { createDatabasePool } from "./services/database";
import { WidgetLayoutService } from "./services/widgetLayoutService";
import { createLogger } from "./utils/logger";
import { YouTubeService } from "./integrations/youtube/youtube.service";
import { SQLiteKvStore } from "./services/sqliteKvStore";
import { RuntimeSettingsService } from "./services/runtimeSettingsService";
import { setYouTubeOAuthConfigProvider } from "./integrations/youtube/youtube.oauth";

const logger = createLogger("server");
const kvStore = env.DATABASE_PROVIDER === "sqlite" ? new SQLiteKvStore(env.DATABASE_URL) : null;
const runtimeSettingsService = new RuntimeSettingsService(kvStore);
setYouTubeOAuthConfigProvider(() => runtimeSettingsService.getGoogleOAuthConfig());

const store = new OverlayStore(kvStore);
const timerService = new TimerService(kvStore);
const eventBus = new EventBus(store);
const pool = createDatabasePool();
const widgetLayoutService = new WidgetLayoutService(pool, store, kvStore);
const youtubeService = new YouTubeService({ pool, eventBus, overlayStore: store, kvStore, runtimeSettings: runtimeSettingsService });

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: env.SOCKET_ALLOWED_ORIGINS,
    credentials: true
  }
});

eventBus.setEmitter((overlayId, event) => {
  io.to(roomForOverlay(overlayId)).emit("overlay:event", event);
  if (event.type === "chat") {
    io.to(roomForOverlay(overlayId)).emit("overlay:chat", event);
  }
  if (event.type === "viewer_count") {
    io.to(roomForOverlay(overlayId)).emit("overlay:viewer_count", event);
  }
  if (["superchat", "donation", "membership", "subscriber", "announcement", "test_alert"].includes(event.type)) {
    io.to(roomForOverlay(overlayId)).emit("overlay:alert", event);
  }
  io.to("admins").emit("admin:event", event);
  io.to("admins").emit("youtube:event", {
    overlayId,
    event,
    timestamp: new Date().toISOString()
  });
  io.to("admins").emit("system:status", {
    ok: true,
    message: "Overlay event broadcasted",
    overlayId,
    eventType: event.type,
    timestamp: new Date().toISOString()
  });
});

youtubeService.setSocketEmitter((eventName, payload) => {
  io.to("admins").emit(eventName, payload);
});

const app = createApp({ store, eventBus, timerService, widgetLayoutService, io, youtubeService, pool, kvStore, runtimeSettingsService });
httpServer.on("request", app);
configureSocket(io, store, timerService);

httpServer.listen(env.PORT, env.HOST, () => {
  logger.info(env.LIVEORA_MODE === "docker" ? "LiveOra all-in-one server listening" : "Backend listening", {
    host: env.HOST,
    port: env.PORT,
    mode: env.LIVEORA_MODE,
    databaseProvider: env.DATABASE_PROVIDER,
    nodeEnv: env.NODE_ENV,
    corsOrigins: env.CORS_ORIGIN,
    socketOrigins: env.SOCKET_ALLOWED_ORIGINS
  });
});
