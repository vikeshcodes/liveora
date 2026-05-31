import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { Server } from "socket.io";
import { env } from "../config/env";
import { consumeOAuthState, exchangeCodeForTokens, getYouTubeAuthUrl } from "../integrations/youtube/youtube.oauth";
import type { YouTubeService } from "../integrations/youtube/youtube.service";

const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    handler(req, res, next).catch(next);

const adminRedirectUrl = (auth: "success" | "failed", message?: string) => {
  const url = new URL("/admin/youtube", env.ADMIN_URL);
  url.searchParams.set("auth", auth);
  if (message) {
    url.searchParams.set("message", message);
  }
  return url.toString();
};

export const createYouTubeRouter = (youtubeService: YouTubeService, io?: Server) => {
  const router = Router();

  router.get(
    "/auth/start",
    asyncHandler(async (req, res) => {
      const overlayId = String(req.query.overlayId ?? env.YOUTUBE_DEFAULT_OVERLAY_ID);
      const includeMembership = req.query.includeMembership === "true";
      res.redirect(getYouTubeAuthUrl(overlayId, includeMembership));
    })
  );

  router.get(
    "/auth/callback",
    asyncHandler(async (req, res) => {
      const code = String(req.query.code ?? "");
      const state = String(req.query.state ?? "");
      if (!code || !state) {
        io?.to("admins").emit("youtube:error", {
          code: "YOUTUBE_AUTH_FAILED",
          message: "YouTube authentication failed",
          details: "Missing OAuth code or state",
          timestamp: new Date().toISOString()
        });
        res.redirect(adminRedirectUrl("failed", "Missing OAuth code or state"));
        return;
      }

      try {
        const { overlayId } = consumeOAuthState(state);
        const tokens = await exchangeCodeForTokens(code);
        await youtubeService.connectOAuthAccount(overlayId, tokens);
        res.redirect(adminRedirectUrl("success", "YouTube connected successfully"));
      } catch (error) {
        const details = error instanceof Error ? error.message : "Unknown OAuth error";
        io?.to("admins").emit("youtube:error", {
          code: "YOUTUBE_AUTH_FAILED",
          message: "YouTube authentication failed",
          details,
          timestamp: new Date().toISOString()
        });
        res.redirect(adminRedirectUrl("failed", details));
      }
    })
  );

  router.post(
    "/auth/disconnect",
    asyncHandler(async (req, res) => {
      const overlayId = String(req.body.overlayId ?? env.YOUTUBE_DEFAULT_OVERLAY_ID);
      await youtubeService.disconnect(overlayId);
      res.json({ data: await youtubeService.getYouTubeIntegrationStatus(overlayId) });
    })
  );

  router.get(
    "/auth/status",
    asyncHandler(async (req, res) => {
      const overlayId = String(req.query.overlayId ?? env.YOUTUBE_DEFAULT_OVERLAY_ID);
      res.json({ data: await youtubeService.getYouTubeIntegrationStatus(overlayId) });
    })
  );

  router.get(
    "/status/:overlayId",
    asyncHandler(async (req, res) => {
      res.json({ data: await youtubeService.getYouTubeIntegrationStatus(req.params.overlayId) });
    })
  );

  router.post(
    "/start/:overlayId",
    asyncHandler(async (req, res) => {
      res.json({ data: await youtubeService.startYouTubeIntegration(req.params.overlayId) });
    })
  );

  router.post(
    "/stop/:overlayId",
    asyncHandler(async (req, res) => {
      res.json({ data: await youtubeService.stopYouTubeIntegration(req.params.overlayId) });
    })
  );

  router.post(
    "/restart/:overlayId",
    asyncHandler(async (req, res) => {
      res.json({ data: await youtubeService.restartYouTubeIntegration(req.params.overlayId) });
    })
  );

  router.post(
    "/refresh-session/:overlayId",
    asyncHandler(async (req, res) => {
      res.json({ data: await youtubeService.refreshActiveLiveSession(req.params.overlayId) });
    })
  );

  router.get(
    "/events/recent/:overlayId",
    asyncHandler(async (req, res) => {
      const limit = req.query.limit ? Number(req.query.limit) : 25;
      res.json({ data: youtubeService.getRecentEvents(req.params.overlayId, limit) });
    })
  );

  router.post(
    "/test/chat",
    asyncHandler(async (req, res) => {
      const overlayId = String(req.body.overlayId ?? env.YOUTUBE_DEFAULT_OVERLAY_ID);
      res.status(202).json({ data: await youtubeService.emitTestEvent(overlayId, "chat") });
    })
  );

  router.post(
    "/test/superchat",
    asyncHandler(async (req, res) => {
      const overlayId = String(req.body.overlayId ?? env.YOUTUBE_DEFAULT_OVERLAY_ID);
      res.status(202).json({ data: await youtubeService.emitTestEvent(overlayId, "superchat") });
    })
  );

  router.post(
    "/test/viewer-count",
    asyncHandler(async (req, res) => {
      const overlayId = String(req.body.overlayId ?? env.YOUTUBE_DEFAULT_OVERLAY_ID);
      res.status(202).json({ data: await youtubeService.emitTestEvent(overlayId, "viewer_count") });
    })
  );

  router.post(
    "/test/subscriber",
    asyncHandler(async (req, res) => {
      const overlayId = String(req.body.overlayId ?? env.YOUTUBE_DEFAULT_OVERLAY_ID);
      res.status(202).json({ data: await youtubeService.emitTestEvent(overlayId, "subscriber") });
    })
  );

  router.post(
    "/test/membership",
    asyncHandler(async (req, res) => {
      const overlayId = String(req.body.overlayId ?? env.YOUTUBE_DEFAULT_OVERLAY_ID);
      res.status(202).json({ data: await youtubeService.emitTestEvent(overlayId, "membership") });
    })
  );

  return router;
};
