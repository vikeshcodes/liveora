# Backend Event Server

Node.js, Express, TypeScript, and Socket.IO event server.

## Run

```bash
cd overlay-system/backend
npm install
cp .env.example .env
npm run dev
```

## Endpoints

- `GET /health`
- `GET /api/v1/status`
- `GET /api/v1/version`
- `GET /api/v1/overlays`
- `GET /api/v1/overlays/:id/config`
- `PUT /api/v1/overlays/:id/config`
- `POST /api/v1/events/test`
- `POST /api/v1/events/manual`
- `GET /api/v1/events/recent`
- `GET /api/v1/themes`
- `PUT /api/v1/overlays/:id/theme`
- `GET /api/v1/goals/:overlayId`
- `PUT /api/v1/goals/:overlayId`
- `POST /api/v1/timer/:overlayId/start`
- `POST /api/v1/timer/:overlayId/pause`
- `POST /api/v1/timer/:overlayId/reset`
- `GET /api/v1/youtube/auth/start`
- `GET /api/v1/youtube/auth/callback`
- `POST /api/v1/youtube/auth/disconnect`
- `GET /api/v1/youtube/auth/status`
- `GET /api/v1/youtube/status/:overlayId`
- `POST /api/v1/youtube/start/:overlayId`
- `POST /api/v1/youtube/stop/:overlayId`
- `POST /api/v1/youtube/restart/:overlayId`
- `POST /api/v1/youtube/refresh-session/:overlayId`
- `GET /api/v1/youtube/events/recent/:overlayId`
- `POST /api/v1/youtube/test/chat`
- `POST /api/v1/youtube/test/superchat`
- `POST /api/v1/youtube/test/viewer-count`
- `POST /api/v1/youtube/test/subscriber`
- `POST /api/v1/youtube/test/membership`

## Security

Secrets belong only in backend environment variables. Do not expose Google OAuth credentials, YouTube API tokens, or signing secrets in frontend or admin builds.

Google OAuth tokens are encrypted before PostgreSQL storage when `DATABASE_URL` is configured. The local admin routes are intentionally token-free for personal localhost OBS use, while CORS and Socket.IO origins are restricted to the local frontend/admin ports.
