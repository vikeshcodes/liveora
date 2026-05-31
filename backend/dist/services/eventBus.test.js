"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const youtube_dedup_1 = require("../integrations/youtube/youtube.dedup");
const eventBus_1 = require("./eventBus");
const store_1 = require("./store");
(0, node_test_1.default)("EventBus broadcasts accepted events and rejects duplicate IDs", () => {
    const store = new store_1.OverlayStore();
    const bus = new eventBus_1.EventBus(store);
    const emitted = [];
    bus.setEmitter((_overlayId, event) => emitted.push(event.id));
    const event = {
        id: "manual-dedup-1",
        type: "subscriber",
        overlayId: "main-overlay",
        username: "QA",
        message: "subscribed",
        timestamp: "2026-05-26T08:10:00.000Z",
        meta: {}
    };
    const first = bus.publish(event);
    const second = bus.publish(event);
    strict_1.default.equal(first.accepted, true);
    strict_1.default.equal(first.duplicate, false);
    strict_1.default.equal(second.accepted, false);
    strict_1.default.equal(second.duplicate, true);
    strict_1.default.deepEqual(emitted, ["manual-dedup-1"]);
});
(0, node_test_1.default)("OverlayStore seeds overlays from creator-os.config.json", () => {
    const store = new store_1.OverlayStore();
    const overlayIds = store.getOverlays().map((overlay) => overlay.id);
    strict_1.default.ok(overlayIds.includes("main-overlay"));
    strict_1.default.ok(overlayIds.includes("vertical-overlay"));
    strict_1.default.ok(overlayIds.includes("gaming-overlay"));
    strict_1.default.equal(store.getConfig("vertical-overlay")?.layout, "vertical");
});
(0, node_test_1.default)("OverlayStore activates scene profiles and clears event history", () => {
    const store = new store_1.OverlayStore();
    const scene = store.getScene("study");
    strict_1.default.ok(scene);
    const activated = store.activateScene("study");
    strict_1.default.equal(activated?.active, true);
    strict_1.default.equal(store.getConfig("main-overlay")?.themeId, "study-calm-pro");
    strict_1.default.equal(store.getConfig("main-overlay")?.widgets.activityFeedWidget.enabled, false);
    const bus = new eventBus_1.EventBus(store);
    bus.publish({
        id: "event-clear-1",
        type: "chat",
        overlayId: "main-overlay",
        username: "QA",
        message: "history",
        timestamp: "2026-05-26T08:12:00.000Z",
        meta: {}
    });
    strict_1.default.equal(store.getRecentEvents("main-overlay").length, 1);
    strict_1.default.equal(store.clearEvents("main-overlay"), 1);
    strict_1.default.equal(store.getRecentEvents("main-overlay").length, 0);
});
(0, node_test_1.default)("YouTubeDedupStore falls back to in-memory dedup without a database pool", async () => {
    const dedup = new youtube_dedup_1.YouTubeDedupStore(null);
    const event = {
        id: "youtube-event-1",
        platform: "youtube",
        type: "chat",
        overlayId: "main-overlay",
        priority: 5,
        username: "Viewer",
        message: "Hello",
        amount: null,
        currency: null,
        displayAmount: null,
        avatarUrl: null,
        publishedAt: "2026-05-26T08:11:00.000Z",
        meta: {},
        raw: {}
    };
    strict_1.default.equal(await dedup.isDuplicateAndRecord(event), false);
    strict_1.default.equal(await dedup.isDuplicateAndRecord(event), true);
});
