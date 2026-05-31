import assert from "node:assert/strict";
import test from "node:test";
import { YouTubeDedupStore } from "../integrations/youtube/youtube.dedup";
import type { NormalizedYouTubeEvent } from "../integrations/youtube/youtube.types";
import { EventBus } from "./eventBus";
import { OverlayStore } from "./store";

test("EventBus broadcasts accepted events and rejects duplicate IDs", () => {
  const store = new OverlayStore();
  const bus = new EventBus(store);
  const emitted: string[] = [];
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

  assert.equal(first.accepted, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.accepted, false);
  assert.equal(second.duplicate, true);
  assert.deepEqual(emitted, ["manual-dedup-1"]);
});

test("OverlayStore seeds overlays from creator-os.config.json", () => {
  const store = new OverlayStore();
  const overlayIds = store.getOverlays().map((overlay) => overlay.id);

  assert.ok(overlayIds.includes("main-overlay"));
  assert.ok(overlayIds.includes("vertical-overlay"));
  assert.ok(overlayIds.includes("gaming-overlay"));
  assert.equal(store.getConfig("vertical-overlay")?.layout, "vertical");
});

test("OverlayStore activates scene profiles and clears event history", () => {
  const store = new OverlayStore();
  const scene = store.getScene("study");
  assert.ok(scene);

  const activated = store.activateScene("study");
  assert.equal(activated?.active, true);
  assert.equal(store.getConfig("main-overlay")?.themeId, "study-calm-pro");
  assert.equal(store.getConfig("main-overlay")?.widgets.activityFeedWidget.enabled, false);

  const bus = new EventBus(store);
  bus.publish({
    id: "event-clear-1",
    type: "chat",
    overlayId: "main-overlay",
    username: "QA",
    message: "history",
    timestamp: "2026-05-26T08:12:00.000Z",
    meta: {}
  });
  assert.equal(store.getRecentEvents("main-overlay").length, 1);
  assert.equal(store.clearEvents("main-overlay"), 1);
  assert.equal(store.getRecentEvents("main-overlay").length, 0);
});

test("YouTubeDedupStore falls back to in-memory dedup without a database pool", async () => {
  const dedup = new YouTubeDedupStore(null);
  const event: NormalizedYouTubeEvent = {
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

  assert.equal(await dedup.isDuplicateAndRecord(event), false);
  assert.equal(await dedup.isDuplicateAndRecord(event), true);
});
