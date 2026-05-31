"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middleware/errorHandler");
const api_1 = require("./routes/api");
const createApp = (deps) => {
    const app = (0, express_1.default)();
    const adminPassword = env_1.env.LIVEORA_ADMIN_PASSWORD;
    const adminPasswordMiddleware = (req, res, next) => {
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
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
    app.use((0, cors_1.default)({
        origin: env_1.env.CORS_ORIGIN,
        credentials: true
    }));
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use((0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 240,
        standardHeaders: true,
        legacyHeaders: false
    }));
    app.get("/health", async (_req, res) => {
        let databaseConnected = false;
        try {
            if (deps.kvStore) {
                databaseConnected = deps.kvStore.ping();
            }
            else if (deps.pool) {
                await deps.pool.query("SELECT 1");
                databaseConnected = true;
            }
        }
        catch {
            databaseConnected = false;
        }
        res.json({
            status: "ok",
            ok: true,
            service: env_1.env.LIVEORA_MODE === "docker" ? "liveora" : "creator-os-backend",
            mode: env_1.env.LIVEORA_MODE,
            database: databaseConnected ? "connected" : "unavailable",
            databaseProvider: env_1.env.DATABASE_PROVIDER,
            version: env_1.env.VERSION,
            timestamp: new Date().toISOString()
        });
    });
    app.use("/api/v1", (0, api_1.createApiRouter)(deps));
    const publicDir = node_path_1.default.resolve(__dirname, "../public");
    const adminDir = node_path_1.default.join(publicDir, "admin");
    const overlayDir = node_path_1.default.join(publicDir, "overlay");
    const adminIndex = node_path_1.default.join(adminDir, "index.html");
    const overlayIndex = node_path_1.default.join(overlayDir, "index.html");
    const hasAdminBuild = (0, node_fs_1.existsSync)(adminIndex);
    const hasOverlayBuild = (0, node_fs_1.existsSync)(overlayIndex);
    if (hasAdminBuild || hasOverlayBuild) {
        app.get("/", (_req, res) => {
            res.redirect(deps.runtimeSettingsService.getInternalSettings().setupComplete ? "/admin" : "/setup");
        });
        if (hasAdminBuild) {
            app.use("/admin", express_1.default.static(adminDir, { redirect: false }));
            app.get(["/admin", "/admin/*", "/setup"], (_req, res) => {
                res.sendFile(adminIndex);
            });
        }
        if (hasOverlayBuild) {
            app.use("/overlay", express_1.default.static(overlayDir, { redirect: false }));
            app.get("/overlay/:overlayId", (_req, res) => {
                res.sendFile(overlayIndex);
            });
        }
    }
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
};
exports.createApp = createApp;
