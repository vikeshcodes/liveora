"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiRouter = void 0;
const express_1 = require("express");
const env_1 = require("../config/env");
const socket_1 = require("../realtime/socket");
const youtube_1 = require("./youtube");
const defaults_1 = require("../services/defaults");
const asyncHandler = (handler) => (req, res, next) => handler(req, res, next).catch(next);
const sampleForType = (type, overlayId) => {
    const base = { type, overlayId, username: "Test Viewer", timestamp: new Date().toISOString(), meta: { source: "admin-test" } };
    switch (type) {
        case "superchat":
            return {
                ...base,
                username: "Super Chat Test",
                message: "This is a local Super Chat test event.",
                amount: 499,
                currency: "INR"
            };
        case "donation":
            return {
                ...base,
                username: "Donation Test",
                message: "This is a local donation test event.",
                amount: 10,
                currency: "USD"
            };
        case "chat":
            return {
                ...base,
                username: "Chat Test",
                message: "This is a local chat test message."
            };
        case "announcement":
            return {
                ...base,
                username: "Creator OS",
                message: "This is a local announcement test."
            };
        default:
            return {
                ...base,
                message: "subscribed to the channel"
            };
    }
};
const publicWidgets = () => Object.entries(defaults_1.DEFAULT_WIDGETS).map(([id, config]) => ({
    id,
    name: id
        .replace(/Widget$/, "")
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (letter) => letter.toUpperCase())
        .trim(),
    config
}));
const nowPayload = (payload = {}) => ({
    ...payload,
    timestamp: new Date().toISOString()
});
const createApiRouter = ({ store, eventBus, timerService, widgetLayoutService, io, youtubeService, pool, kvStore, runtimeSettingsService }) => {
    const router = (0, express_1.Router)();
    const publicConfigPayload = () => runtimeSettingsService.getPublicSettings(store.getThemes(), publicWidgets(), store.getScenes());
    const checkDatabase = async () => {
        if (kvStore) {
            return kvStore.ping();
        }
        if (!pool) {
            return false;
        }
        await pool.query("SELECT 1");
        return true;
    };
    router.get("/status", asyncHandler(async (_req, res) => {
        let databaseConnected = false;
        try {
            databaseConnected = await checkDatabase();
        }
        catch {
            databaseConnected = false;
        }
        res.json({
            ok: true,
            service: env_1.env.LIVEORA_MODE === "docker" ? "LiveOra by Vikesh Codes" : "Vikesh Codes Creator OS backend",
            version: env_1.env.VERSION,
            mode: env_1.env.LIVEORA_MODE,
            databaseProvider: env_1.env.DATABASE_PROVIDER,
            uptimeSeconds: Math.round(process.uptime()),
            socketClients: io.engine.clientsCount,
            databaseConfigured: Boolean(env_1.env.DATABASE_URL) || Boolean(kvStore),
            databaseConnected,
            timestamp: new Date().toISOString()
        });
    }));
    router.get("/version", (_req, res) => {
        res.json({
            name: env_1.env.LIVEORA_MODE === "docker" ? "LiveOra by Vikesh Codes" : "Vikesh Codes Creator OS",
            version: env_1.env.VERSION
        });
    });
    router.get("/local-config", (_req, res) => {
        res.json({
            data: publicConfigPayload()
        });
    });
    router.get("/public-config", (_req, res) => {
        res.json({ data: publicConfigPayload() });
    });
    router.get("/setup/status", async (_req, res) => {
        let databaseConnected = false;
        try {
            databaseConnected = await checkDatabase();
        }
        catch {
            databaseConnected = false;
        }
        const publicConfig = publicConfigPayload();
        res.json({
            data: {
                setupComplete: publicConfig.setupComplete,
                mode: publicConfig.mode,
                databaseConnected,
                youtubeConfigured: publicConfig.youtube.configured,
                googleOAuthConfigured: publicConfig.youtube.googleClientIdConfigured && publicConfig.youtube.googleClientSecretConfigured,
                appBaseUrl: publicConfig.urls.backend,
                oauthRedirectUri: `${publicConfig.urls.backend}/api/v1/youtube/auth/callback`
            }
        });
    });
    router.post("/setup", (req, res) => {
        const settings = runtimeSettingsService.completeSetup({
            appName: req.body.appName,
            projectName: req.body.appName,
            activeOverlayId: req.body.activeOverlayId,
            appBaseUrl: req.body.appBaseUrl,
            youtube: req.body.youtube,
            overlays: req.body.overlays
        });
        io.to("admins").emit("config:updated", nowPayload({ config: publicConfigPayload(), message: "LiveOra setup saved" }));
        res.status(201).json({ data: { ...publicConfigPayload(), setupComplete: settings.setupComplete } });
    });
    router.get("/settings", (_req, res) => {
        res.json({ data: publicConfigPayload() });
    });
    router.put("/settings", (req, res) => {
        runtimeSettingsService.updateSettings({
            appName: req.body.appName,
            projectName: req.body.appName,
            activeOverlayId: req.body.activeOverlayId,
            appBaseUrl: req.body.appBaseUrl,
            youtube: req.body.youtube,
            overlays: req.body.overlays
        });
        const publicConfig = publicConfigPayload();
        io.to("admins").emit("config:updated", nowPayload({ config: publicConfig, message: "Settings saved" }));
        res.json({ data: publicConfig });
    });
    router.put("/local-config/active-overlay", (_req, res) => {
        res.status(501).json({
            error: {
                code: "LOCAL_CONFIG_WRITE_NOT_ENABLED",
                message: "Edit creator-os.config.json and rerun node start-local.mjs to switch the active overlay."
            }
        });
    });
    router.get("/overlays", (_req, res) => {
        res.json({ data: store.getOverlays() });
    });
    router.post("/overlays", (req, res) => {
        const name = String(req.body.name ?? "").trim();
        if (!name) {
            res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Overlay name is required" } });
            return;
        }
        const overlay = store.createOverlay({ id: req.body.id, name });
        io.to("admins").emit("overlay:updated", nowPayload({ overlay, message: "Overlay created" }));
        res.status(201).json({ data: overlay });
    });
    router.get("/overlays/:id/config", (req, res) => {
        const config = store.getConfig(req.params.id);
        if (!config) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Overlay not found" } });
            return;
        }
        res.json({ data: config });
    });
    router.put("/overlays/:id/config", (req, res) => {
        const config = store.updateConfig(req.params.id, req.body);
        if (!config) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Overlay not found" } });
            return;
        }
        io.to((0, socket_1.roomForOverlay)(req.params.id)).emit("overlay:config", config);
        io.to("admins").emit("config:updated", nowPayload({ overlayId: req.params.id, config, message: "Overlay config saved" }));
        io.to("admins").emit("overlay:updated", nowPayload({ overlayId: req.params.id, config }));
        res.json({ data: config });
    });
    router.get("/overlays/:id/layout", asyncHandler(async (req, res) => {
        res.json({ data: await widgetLayoutService.getLayout(req.params.id) });
    }));
    router.put("/overlays/:id/layout", asyncHandler(async (req, res) => {
        const widgets = Array.isArray(req.body) ? req.body : req.body.widgets;
        if (!Array.isArray(widgets)) {
            res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Layout widgets array is required" } });
            return;
        }
        const layout = await widgetLayoutService.replaceLayout(req.params.id, widgets);
        io.to((0, socket_1.roomForOverlay)(req.params.id)).emit("overlay:layout", layout);
        io.to("admins").emit("admin:layout", layout);
        io.to("admins").emit("overlay:layout:updated", nowPayload({ overlayId: req.params.id, layout, message: "Overlay layout saved" }));
        res.json({ data: layout });
    }));
    router.patch("/overlays/:id/layout/:widgetId", asyncHandler(async (req, res) => {
        const layout = await widgetLayoutService.patchWidget(req.params.id, req.params.widgetId, req.body);
        io.to((0, socket_1.roomForOverlay)(req.params.id)).emit("overlay:layout", layout);
        io.to("admins").emit("admin:layout", layout);
        io.to("admins").emit("overlay:layout:updated", nowPayload({ overlayId: req.params.id, layout, message: "Overlay widget layout saved" }));
        res.json({ data: layout });
    }));
    router.post("/overlays/:id/layout/reset", asyncHandler(async (req, res) => {
        const layout = await widgetLayoutService.resetLayout(req.params.id);
        io.to((0, socket_1.roomForOverlay)(req.params.id)).emit("overlay:layout", layout);
        io.to("admins").emit("admin:layout", layout);
        io.to("admins").emit("overlay:layout:updated", nowPayload({ overlayId: req.params.id, layout, message: "Overlay layout reset" }));
        res.json({ data: layout });
    }));
    router.get("/overlays/:id", (req, res) => {
        const overlay = store.getOverlay(req.params.id);
        if (!overlay) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Overlay not found" } });
            return;
        }
        res.json({ data: overlay });
    });
    router.post("/events/test", (req, res) => {
        const overlayId = String(req.body.overlayId ?? publicConfigPayload().activeOverlayId);
        const type = String(req.body.type ?? "subscriber");
        const result = eventBus.publish(sampleForType(type, overlayId));
        res.status(result.accepted ? 202 : 200).json({ data: result });
    });
    router.post("/events/manual", (req, res) => {
        const result = eventBus.publish(req.body);
        res.status(result.accepted ? 202 : 200).json({ data: result });
    });
    router.get("/events/recent", (req, res) => {
        const overlayId = typeof req.query.overlayId === "string" ? req.query.overlayId : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : 25;
        res.json({ data: store.getRecentEvents(overlayId, limit) });
    });
    router.get("/events/recent/:overlayId", (req, res) => {
        const limit = req.query.limit ? Number(req.query.limit) : 25;
        res.json({ data: store.getRecentEvents(req.params.overlayId, limit) });
    });
    router.delete("/events/clear/:overlayId", (req, res) => {
        const cleared = store.clearEvents(req.params.overlayId);
        io.to("admins").emit("events:cleared", nowPayload({ overlayId: req.params.overlayId, cleared, message: "Event history cleared" }));
        res.json({ data: { overlayId: req.params.overlayId, cleared } });
    });
    router.get("/themes", (_req, res) => {
        res.json({ data: store.getThemes() });
    });
    router.put("/overlays/:id/theme", (req, res) => {
        const themeId = String(req.body.themeId ?? "");
        const config = store.setTheme(req.params.id, themeId);
        if (!config) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Overlay not found" } });
            return;
        }
        io.to((0, socket_1.roomForOverlay)(req.params.id)).emit("overlay:config", config);
        io.to("admins").emit("theme:updated", nowPayload({ overlayId: req.params.id, themeId, config, message: "Theme updated" }));
        io.to("admins").emit("config:updated", nowPayload({ overlayId: req.params.id, config }));
        res.json({ data: config });
    });
    router.get("/scenes", (req, res) => {
        const overlayId = typeof req.query.overlayId === "string" ? req.query.overlayId : undefined;
        res.json({ data: store.getScenes(overlayId) });
    });
    router.get("/scenes/:sceneId", (req, res) => {
        const scene = store.getScene(req.params.sceneId);
        if (!scene) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Scene not found" } });
            return;
        }
        res.json({ data: scene });
    });
    router.post("/scenes", (req, res) => {
        const scene = store.createScene(req.body ?? {});
        io.to("admins").emit("scene:updated", nowPayload({ scene, message: "Scene created" }));
        res.status(201).json({ data: scene });
    });
    router.post("/scenes/:sceneId/duplicate", (req, res) => {
        const scene = store.duplicateScene(req.params.sceneId);
        io.to("admins").emit("scene:updated", nowPayload({ scene, message: "Scene duplicated" }));
        res.status(201).json({ data: scene });
    });
    router.put("/scenes/:sceneId", (req, res) => {
        const scene = store.updateScene(req.params.sceneId, req.body ?? {});
        if (!scene) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Scene not found" } });
            return;
        }
        io.to("admins").emit("scene:updated", nowPayload({ scene, message: "Scene updated" }));
        res.json({ data: scene });
    });
    router.delete("/scenes/:sceneId", (req, res) => {
        const scene = store.deleteScene(req.params.sceneId);
        if (!scene) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Scene not found" } });
            return;
        }
        io.to("admins").emit("scene:updated", nowPayload({ scene, deleted: true, message: "Scene deleted" }));
        res.json({ data: scene });
    });
    router.post("/scenes/:sceneId/activate", (req, res) => {
        const scene = store.activateScene(req.params.sceneId);
        if (!scene) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Scene not found" } });
            return;
        }
        const config = store.getConfig(scene.overlayId);
        io.to((0, socket_1.roomForOverlay)(scene.overlayId)).emit("overlay:config", config);
        io.to("admins").emit("scene:activated", nowPayload({ scene, config, message: `Scene activated: ${scene.name}` }));
        io.to("admins").emit("config:updated", nowPayload({ overlayId: scene.overlayId, config, message: "Overlay config updated from scene" }));
        res.json({ data: scene });
    });
    router.get("/goals/:overlayId", (req, res) => {
        const goal = store.getGoal(req.params.overlayId);
        if (!goal) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Goal not found" } });
            return;
        }
        res.json({ data: goal });
    });
    router.put("/goals/:overlayId", (req, res) => {
        const goal = store.updateGoal(req.params.overlayId, req.body);
        const result = eventBus.publish({
            type: "goal_update",
            overlayId: req.params.overlayId,
            username: "Goal",
            message: goal.title,
            amount: goal.currentValue,
            currency: goal.currency,
            meta: { goal }
        });
        io.to((0, socket_1.roomForOverlay)(req.params.overlayId)).emit("overlay:goal", goal);
        io.to("admins").emit("widget:updated", nowPayload({ overlayId: req.params.overlayId, widget: "goalWidget", goal, message: "Goal updated" }));
        res.json({ data: goal, event: result.event });
    });
    router.post("/timer/:overlayId/start", (req, res) => {
        const state = timerService.start(req.params.overlayId, req.body.durationSeconds);
        const result = eventBus.publish({
            type: "timer_start",
            overlayId: req.params.overlayId,
            username: "Timer",
            message: "Timer started",
            meta: { timer: state }
        });
        io.to((0, socket_1.roomForOverlay)(req.params.overlayId)).emit("overlay:timer", state);
        io.to("admins").emit("widget:updated", nowPayload({ overlayId: req.params.overlayId, widget: "timerWidget", timer: state, message: "Timer started" }));
        res.json({ data: state, event: result.event });
    });
    router.post("/timer/:overlayId/pause", (req, res) => {
        const state = timerService.pause(req.params.overlayId);
        const result = eventBus.publish({
            type: "timer_pause",
            overlayId: req.params.overlayId,
            username: "Timer",
            message: "Timer paused",
            meta: { timer: state }
        });
        io.to((0, socket_1.roomForOverlay)(req.params.overlayId)).emit("overlay:timer", state);
        io.to("admins").emit("widget:updated", nowPayload({ overlayId: req.params.overlayId, widget: "timerWidget", timer: state, message: "Timer paused" }));
        res.json({ data: state, event: result.event });
    });
    router.post("/timer/:overlayId/reset", (req, res) => {
        const state = timerService.reset(req.params.overlayId, req.body.durationSeconds);
        const result = eventBus.publish({
            type: "timer_reset",
            overlayId: req.params.overlayId,
            username: "Timer",
            message: "Timer reset",
            meta: { timer: state }
        });
        io.to((0, socket_1.roomForOverlay)(req.params.overlayId)).emit("overlay:timer", state);
        io.to("admins").emit("widget:updated", nowPayload({ overlayId: req.params.overlayId, widget: "timerWidget", timer: state, message: "Timer reset" }));
        res.json({ data: state, event: result.event });
    });
    router.use("/youtube", (0, youtube_1.createYouTubeRouter)(youtubeService, io));
    return router;
};
exports.createApiRouter = createApiRouter;
