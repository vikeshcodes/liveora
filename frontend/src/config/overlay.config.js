import { DEFAULT_WIDGET_CONFIG } from "./widgets.config";

const sameOriginUrl = window.location.origin;

export const OVERLAY_CONFIG = {
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? sameOriginUrl,
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_BACKEND_URL ?? sameOriginUrl,
  defaultOverlayId: import.meta.env.VITE_DEFAULT_OVERLAY_ID ?? import.meta.env.VITE_ACTIVE_OVERLAY_ID ?? "main-overlay",
  activeOverlayId: import.meta.env.VITE_ACTIVE_OVERLAY_ID ?? import.meta.env.VITE_DEFAULT_OVERLAY_ID ?? "main-overlay",
  defaultLayout: "horizontal",
  defaultAlertDurationMs: 5000,
  defaultQueueMaxLength: 30,
  widgets: DEFAULT_WIDGET_CONFIG
};
