"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOverlayEvent = void 0;
const toOverlayEvent = (event) => ({
    id: event.id,
    platform: "youtube",
    type: event.type,
    overlayId: event.overlayId,
    username: event.username,
    message: event.message,
    amount: event.amount,
    currency: event.currency,
    displayAmount: event.displayAmount,
    amountMicros: event.amountMicros ?? null,
    avatarUrl: event.avatarUrl,
    priority: event.priority,
    publishedAt: event.publishedAt,
    count: event.count ?? null,
    levelName: event.levelName ?? null,
    reliability: event.reliability ?? "official",
    isVerified: event.isVerified ?? false,
    isChatOwner: event.isChatOwner ?? false,
    isChatSponsor: event.isChatSponsor ?? false,
    isChatModerator: event.isChatModerator ?? false,
    timestamp: event.publishedAt,
    meta: event.meta,
    raw: event.raw
});
exports.toOverlayEvent = toOverlayEvent;
