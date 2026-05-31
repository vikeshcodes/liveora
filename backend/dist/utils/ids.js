"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSlug = exports.createOverlayToken = exports.createEventId = void 0;
const node_crypto_1 = require("node:crypto");
const createEventId = () => `evt_${(0, node_crypto_1.randomUUID)()}`;
exports.createEventId = createEventId;
const createOverlayToken = () => `ovl_${(0, node_crypto_1.randomUUID)().replace(/-/g, "")}`;
exports.createOverlayToken = createOverlayToken;
const toSlug = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
exports.toSlug = toSlug;
