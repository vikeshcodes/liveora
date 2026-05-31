"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEvent = exports.incomingEventSchema = exports.eventTypeSchema = void 0;
const zod_1 = require("zod");
const ids_1 = require("../utils/ids");
exports.eventTypeSchema = zod_1.z.enum([
    "subscriber",
    "superchat",
    "donation",
    "membership",
    "chat",
    "viewer_count",
    "goal_update",
    "timer_start",
    "timer_pause",
    "timer_reset",
    "announcement",
    "test_alert",
    "stream_status"
]);
exports.incomingEventSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(120).optional(),
    platform: zod_1.z.string().max(40).optional(),
    type: exports.eventTypeSchema,
    overlayId: zod_1.z.string().min(1).max(80),
    username: zod_1.z.string().max(80).nullable().optional(),
    message: zod_1.z.string().max(500).nullable().optional(),
    amount: zod_1.z.coerce.number().nonnegative().nullable().optional(),
    currency: zod_1.z.string().max(12).nullable().optional(),
    displayAmount: zod_1.z.string().max(80).nullable().optional(),
    amountMicros: zod_1.z.coerce.number().nonnegative().nullable().optional(),
    avatarUrl: zod_1.z.string().url().nullable().optional(),
    priority: zod_1.z.coerce.number().int().min(1).max(20).optional(),
    publishedAt: zod_1.z.string().datetime().nullable().optional(),
    count: zod_1.z.coerce.number().int().nonnegative().nullable().optional(),
    levelName: zod_1.z.string().max(120).nullable().optional(),
    reliability: zod_1.z.string().max(40).nullable().optional(),
    isVerified: zod_1.z.boolean().optional(),
    isChatOwner: zod_1.z.boolean().optional(),
    isChatSponsor: zod_1.z.boolean().optional(),
    isChatModerator: zod_1.z.boolean().optional(),
    timestamp: zod_1.z.string().datetime().optional(),
    meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    raw: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
const normalizeEvent = (input) => {
    const parsed = exports.incomingEventSchema.parse(input);
    return {
        id: parsed.id ?? (0, ids_1.createEventId)(),
        platform: parsed.platform ?? "manual",
        type: parsed.type,
        overlayId: parsed.overlayId,
        username: parsed.username ?? null,
        message: parsed.message ?? null,
        amount: parsed.amount ?? null,
        currency: parsed.currency ?? null,
        displayAmount: parsed.displayAmount ?? null,
        amountMicros: parsed.amountMicros ?? null,
        avatarUrl: parsed.avatarUrl ?? null,
        priority: parsed.priority,
        publishedAt: parsed.publishedAt ?? parsed.timestamp ?? null,
        count: parsed.count ?? null,
        levelName: parsed.levelName ?? null,
        reliability: parsed.reliability ?? null,
        isVerified: parsed.isVerified ?? false,
        isChatOwner: parsed.isChatOwner ?? false,
        isChatSponsor: parsed.isChatSponsor ?? false,
        isChatModerator: parsed.isChatModerator ?? false,
        timestamp: parsed.timestamp ?? parsed.publishedAt ?? new Date().toISOString(),
        meta: parsed.meta ?? {},
        raw: parsed.raw ?? {}
    };
};
exports.normalizeEvent = normalizeEvent;
