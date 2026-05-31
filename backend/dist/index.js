"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const socket_io_1 = require("socket.io");
const app_1 = require("./app");
const env_1 = require("./config/env");
const socket_1 = require("./realtime/socket");
const eventBus_1 = require("./services/eventBus");
const store_1 = require("./services/store");
const timerService_1 = require("./services/timerService");
const database_1 = require("./services/database");
const widgetLayoutService_1 = require("./services/widgetLayoutService");
const logger_1 = require("./utils/logger");
const youtube_service_1 = require("./integrations/youtube/youtube.service");
const sqliteKvStore_1 = require("./services/sqliteKvStore");
const runtimeSettingsService_1 = require("./services/runtimeSettingsService");
const youtube_oauth_1 = require("./integrations/youtube/youtube.oauth");
const logger = (0, logger_1.createLogger)("server");
const kvStore = env_1.env.DATABASE_PROVIDER === "sqlite" ? new sqliteKvStore_1.SQLiteKvStore(env_1.env.DATABASE_URL) : null;
const runtimeSettingsService = new runtimeSettingsService_1.RuntimeSettingsService(kvStore);
(0, youtube_oauth_1.setYouTubeOAuthConfigProvider)(() => runtimeSettingsService.getGoogleOAuthConfig());
const store = new store_1.OverlayStore(kvStore);
const timerService = new timerService_1.TimerService(kvStore);
const eventBus = new eventBus_1.EventBus(store);
const pool = (0, database_1.createDatabasePool)();
const widgetLayoutService = new widgetLayoutService_1.WidgetLayoutService(pool, store, kvStore);
const youtubeService = new youtube_service_1.YouTubeService({ pool, eventBus, overlayStore: store, kvStore, runtimeSettings: runtimeSettingsService });
const httpServer = (0, node_http_1.createServer)();
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: env_1.env.SOCKET_ALLOWED_ORIGINS,
        credentials: true
    }
});
eventBus.setEmitter((overlayId, event) => {
    io.to((0, socket_1.roomForOverlay)(overlayId)).emit("overlay:event", event);
    if (event.type === "chat") {
        io.to((0, socket_1.roomForOverlay)(overlayId)).emit("overlay:chat", event);
    }
    if (event.type === "viewer_count") {
        io.to((0, socket_1.roomForOverlay)(overlayId)).emit("overlay:viewer_count", event);
    }
    if (["superchat", "donation", "membership", "subscriber", "announcement", "test_alert"].includes(event.type)) {
        io.to((0, socket_1.roomForOverlay)(overlayId)).emit("overlay:alert", event);
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
const app = (0, app_1.createApp)({ store, eventBus, timerService, widgetLayoutService, io, youtubeService, pool, kvStore, runtimeSettingsService });
httpServer.on("request", app);
(0, socket_1.configureSocket)(io, store, timerService);
httpServer.listen(env_1.env.PORT, env_1.env.HOST, () => {
    logger.info(env_1.env.LIVEORA_MODE === "docker" ? "LiveOra all-in-one server listening" : "Backend listening", {
        host: env_1.env.HOST,
        port: env_1.env.PORT,
        mode: env_1.env.LIVEORA_MODE,
        databaseProvider: env_1.env.DATABASE_PROVIDER,
        nodeEnv: env_1.env.NODE_ENV,
        corsOrigins: env_1.env.CORS_ORIGIN,
        socketOrigins: env_1.env.SOCKET_ALLOWED_ORIGINS
    });
});
