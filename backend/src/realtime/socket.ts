import type { Server } from "socket.io";
import { env } from "../config/env";
import { OverlayStore } from "../services/store";
import { TimerService } from "../services/timerService";
import { createLogger } from "../utils/logger";

const logger = createLogger("socket");

export const roomForOverlay = (overlayId: string) => `overlay:${overlayId}`;

export const configureSocket = (io: Server, store: OverlayStore, timerService: TimerService) => {
  io.on("connection", (socket) => {
    const role = String(socket.handshake.auth.role ?? socket.handshake.query.role ?? "");

    if (role === "admin") {
      socket.join("admins");
      const statusPayload = {
        connected: true,
        clientId: socket.id,
        serverTime: new Date().toISOString()
      };
      socket.emit("admin:status", statusPayload);
      socket.emit("system:status", {
        ok: true,
        message: "Admin socket connected",
        ...statusPayload
      });
      logger.info("Admin socket connected", { socketId: socket.id });
      return;
    }

    const overlayId = String(socket.handshake.auth.overlayId ?? socket.handshake.query.overlayId ?? "");
    const token = String(socket.handshake.auth.token ?? socket.handshake.query.token ?? "");

    if (!overlayId || !store.getOverlay(overlayId)) {
      socket.emit("overlay:error", { message: "Unknown overlay" });
      socket.disconnect(true);
      return;
    }

    if (!store.validateOverlayToken(overlayId, token || undefined, env.REQUIRE_OVERLAY_TOKEN)) {
      socket.emit("overlay:error", { message: "Invalid overlay token" });
      socket.disconnect(true);
      return;
    }

    const room = roomForOverlay(overlayId);
    socket.join(room);
    socket.emit("overlay:ready", {
      overlayId,
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    });
    socket.emit("overlay:config", store.getConfig(overlayId));
    socket.emit("overlay:goal", store.getGoal(overlayId));
    socket.emit("overlay:timer", timerService.get(overlayId));

    logger.info("Overlay socket connected", { overlayId, socketId: socket.id, room });

    socket.on("disconnect", (reason) => {
      logger.info("Overlay socket disconnected", { overlayId, socketId: socket.id, reason });
    });
  });
};
