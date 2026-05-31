import { randomUUID } from "node:crypto";

export const createEventId = () => `evt_${randomUUID()}`;

export const createOverlayToken = () => `ovl_${randomUUID().replace(/-/g, "")}`;

export const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
