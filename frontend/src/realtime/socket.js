import { io } from "socket.io-client";

export const createOverlaySocket = ({ socketUrl, overlayId, token, handlers }) => {
  const socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 5000,
    auth: {
      overlayId,
      token
    }
  });

  const report = (state, extra = {}) => handlers.onStatus?.({ state, ...extra });

  socket.on("connect", () => report("connected", { socketId: socket.id }));
  socket.on("disconnect", (reason) => report("disconnected", { reason }));
  socket.io.on("reconnect_attempt", (attempt) => report("reconnecting", { attempt }));
  socket.io.on("reconnect", (attempt) => report("connected", { attempt, socketId: socket.id }));
  socket.on("connect_error", (error) => report("error", { message: error.message }));

  socket.on("overlay:ready", (payload) => handlers.onReady?.(payload));
  socket.on("overlay:event", (event) => handlers.onEvent?.(event));
  socket.on("overlay:config", (config) => handlers.onConfig?.(config));
  socket.on("overlay:layout", (layout) => handlers.onLayout?.(layout));
  socket.on("overlay:goal", (goal) => handlers.onGoal?.(goal));
  socket.on("overlay:timer", (timer) => handlers.onTimer?.(timer));
  socket.on("overlay:error", (error) => handlers.onError?.(error));

  return socket;
};
