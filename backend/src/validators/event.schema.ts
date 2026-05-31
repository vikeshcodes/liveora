import { z } from "zod";
import type { OverlayEvent } from "../types";
import { createEventId } from "../utils/ids";

export const eventTypeSchema = z.enum([
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

export const incomingEventSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  platform: z.string().max(40).optional(),
  type: eventTypeSchema,
  overlayId: z.string().min(1).max(80),
  username: z.string().max(80).nullable().optional(),
  message: z.string().max(500).nullable().optional(),
  amount: z.coerce.number().nonnegative().nullable().optional(),
  currency: z.string().max(12).nullable().optional(),
  displayAmount: z.string().max(80).nullable().optional(),
  amountMicros: z.coerce.number().nonnegative().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  priority: z.coerce.number().int().min(1).max(20).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  count: z.coerce.number().int().nonnegative().nullable().optional(),
  levelName: z.string().max(120).nullable().optional(),
  reliability: z.string().max(40).nullable().optional(),
  isVerified: z.boolean().optional(),
  isChatOwner: z.boolean().optional(),
  isChatSponsor: z.boolean().optional(),
  isChatModerator: z.boolean().optional(),
  timestamp: z.string().datetime().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  raw: z.record(z.string(), z.unknown()).optional()
});

export const normalizeEvent = (input: unknown): OverlayEvent => {
  const parsed = incomingEventSchema.parse(input);
  return {
    id: parsed.id ?? createEventId(),
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
