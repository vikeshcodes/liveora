# Vikesh Codes Creator OS Local Runner

This is a local-only OBS setup. It starts the overlay frontend, admin panel, backend WebSocket/API server, and PostgreSQL database on fixed ports.

The admin panel does not require a login or admin token by default because this project is meant for personal localhost OBS use. Do not expose the backend with ngrok, tunnels, port forwarding, or public deployment unless you add authentication in front of it. Google OAuth credentials and YouTube tokens still stay server-side in `backend/.env.local` and PostgreSQL.

For the simplest single-port Docker experience, use **LiveOra by Vikesh Codes**:

```bash
docker compose up -d --build
```

Docker mode opens everything on `http://localhost:3080`, stores data in SQLite at `/app/data/liveora.db`, and lets you configure YouTube/OAuth from `/setup` or `/admin/settings`.

## Ports

- Frontend overlay: `5150`
- Admin panel: `5160`
- Backend API/WebSocket: `5170`
- PostgreSQL: `5180`

Docker all-in-one mode:

- App/Admin/Overlay/API/WebSocket: `3080`
- SQLite data volume: `/app/data`

## Run Everything

```bash
cd overlay-system
npm run setup
npm run dev:local
```

You can also run the runner directly:

```bash
node start-local.mjs
```

Local URLs:

- Overlay: `http://localhost:5150/overlay/main-overlay`
- Debug overlay: `http://localhost:5150/overlay/main-overlay?debug=true`
- Admin: `http://localhost:5160/admin`
- Live preview: `http://localhost:5160/admin/preview/main-overlay`
- Overlay editor: `http://localhost:5160/admin/overlay-editor/main-overlay`
- Backend health: `http://localhost:5170/health`
- Database: `localhost:5180`

## OBS Browser Sources

Main overlay:

```text
http://localhost:5150/overlay/main-overlay
```

Vertical overlay:

```text
http://localhost:5150/overlay/vertical-overlay
```

Scene/profile URLs:

```text
http://localhost:5150/overlay/main-overlay?scene=coding
http://localhost:5150/overlay/main-overlay?scene=study
http://localhost:5150/overlay/main-overlay?scene=starting-soon
http://localhost:5150/overlay/vertical-overlay?scene=vertical-live
```

Debug overlay:

```text
http://localhost:5150/overlay/main-overlay?debug=true
```

## End-to-End Tested Local Flow

This local flow has been tested with the fixed ports:

1. `npm run setup`
2. `CREATOR_OS_SAME_TERMINAL=true node start-local.mjs`
3. Open admin: `http://localhost:5160/admin`
4. Open debug overlay: `http://localhost:5150/overlay/main-overlay?debug=true`
5. Send test events from admin or the backend test endpoints.
6. Confirm the overlay receives Super Chat, chat, viewer count, goal, timer, and theme updates.
7. Open the overlay editor, drag a widget, save, refresh the editor, and confirm the position persists.
8. Open the OBS overlay URL and confirm widgets render in the saved positions without drag handles.
9. Open the live preview and confirm test events render through the real overlay route.
10. Activate a scene and confirm the overlay updates theme/widget visibility.

Useful backend checks:

```bash
node -e "fetch('http://localhost:5170/health').then(r=>r.json()).then(console.log)"
node -e "fetch('http://localhost:5170/api/v1/status').then(r=>r.json()).then(console.log)"
node -e "fetch('http://localhost:5170/api/v1/local-config').then(r=>r.json()).then(console.log)"
node -e "fetch('http://localhost:5170/api/v1/overlays/main-overlay/layout').then(r=>r.json()).then(console.log)"
node -e "fetch('http://localhost:5170/api/v1/youtube/status/main-overlay').then(r=>r.json()).then(console.log)"
```

Manual event test:

```bash
node -e "fetch('http://localhost:5170/api/v1/youtube/test/superchat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({overlayId:'main-overlay'})}).then(r=>r.json()).then(console.log)"
```

Real YouTube events require real Google OAuth credentials and an active livestream with live chat enabled.

## Overlay Layout Editor

OBS render mode is locked and clean:

```text
http://localhost:5150/overlay/main-overlay
```

Editor mode lives in admin:

```text
http://localhost:5160/admin/overlay-editor/main-overlay
```

Use the editor to:

- Drag widgets around the preview canvas.
- Select a widget from the sidebar.
- Adjust X, Y, width, height, z-index, visible, and locked values.
- Save layout so OBS uses the new positions.
- Reset layout back to the default 16:9 or 9:16 positions.
- Copy the OBS browser-source URL.
- Use `Cmd/Ctrl+S` to save, `Cmd/Ctrl+R` to reset, arrow keys to nudge, and `?` to show shortcuts.

Saved layout is stored in PostgreSQL in the `widget_layouts` table. If the database is unavailable, the backend falls back to its default layout so the overlay does not blank out.

Layout endpoints:

```text
GET  http://localhost:5170/api/v1/overlays/main-overlay/layout
PUT  http://localhost:5170/api/v1/overlays/main-overlay/layout
PATCH http://localhost:5170/api/v1/overlays/main-overlay/layout/chat-widget
POST http://localhost:5170/api/v1/overlays/main-overlay/layout/reset
```

## Scenes And Live Preview

Open the live preview:

```text
http://localhost:5160/admin/preview/main-overlay
```

The preview renders the actual overlay URL in an iframe and listens to backend events. Use it to:

- Switch scene/profile.
- Activate a scene.
- Send test chat, Super Chat, and viewer-count events.
- Refresh the overlay iframe after layout/theme changes.
- Copy the scene-specific OBS URL.

The dashboard also includes scene cards for coding, study/live class, starting soon, be right back, vertical live, and clean gaming profiles. Scene activation emits backend events so admin status updates immediately and connected overlays receive the new config.

## Event History

Recent stream events are loaded from:

```text
GET http://localhost:5170/api/v1/events/recent/main-overlay
```

The admin dashboard can filter the event list by type and clear local history:

```text
DELETE http://localhost:5170/api/v1/events/clear/main-overlay
```

## Change YouTube Channel

Edit only [creator-os.config.json](/Users/vikeshyadav/Desktop/OverLay/overlay-system/creator-os.config.json):

```json
{
  "youtube": {
    "channelId": "UC_REPLACE_WITH_MY_CHANNEL_ID",
    "channelHandle": "@VikeshCodes"
  }
}
```

The runner regenerates `backend/.env.local`, `frontend/.env.local`, `admin/.env.local`, and `database/.env.local`.

Real existing `.env.local` values are kept in memory during generation. If the config has a blank or placeholder value, the runner will not replace a real existing env value with that blank/placeholder. Google client ID, Google client secret, and overlay token secrets are always preserved when they already contain real values.

If `youtube.channelId` is missing or still uses the placeholder value, the admin YouTube panel and backend status endpoint show:

```text
YouTube channel ID is missing. Add it in creator-os.config.json.
```

## Add New Overlay

Add to the `overlays` array:

```json
{
  "id": "study-overlay",
  "name": "Study With Me Overlay",
  "theme": "minimal-matte-pro",
  "layout": "desktop-16x9",
  "enabled": true
}
```

OBS URL:

```text
http://localhost:5150/overlay/study-overlay
```

To change the default overlay, edit:

```json
{
  "activeOverlayId": "study-overlay"
}
```

## Google OAuth Settings

In Google Cloud OAuth Client:

Authorized JavaScript origins:

```text
http://localhost:5150
http://localhost:5160
http://localhost:5170
```

Authorized redirect URI:

```text
http://localhost:5170/api/v1/youtube/auth/callback
```

Put your Google client ID and secret in `backend/.env.local` after the first run. The runner preserves existing real values.

Without real credentials, YouTube routes stay safe: auth status reports disconnected, pollers do not start, and the admin panel shows setup warnings. Mock/test YouTube endpoints still work so you can verify OBS widgets before going live.

The local admin UI can call backend control routes without an admin token. Local safety comes from binding services to `127.0.0.1`, allowing only localhost CORS/Socket.IO origins, and keeping all OAuth secrets out of frontend/admin builds.

## Stop Services

If services were started in same-terminal fallback mode:

```bash
node stop-local.mjs
```

If macOS Terminal windows were opened, close those windows or press `Ctrl+C` in each service window.

Stop database:

```bash
cd database
docker compose down
```

## Troubleshooting

- Missing dependencies: run `npm install` inside `backend`, `frontend`, and `admin`.
- Docker error: start Docker Desktop, then rerun `node start-local.mjs`.
- If Docker is not running, backend/frontend/admin still start and the admin setup checklist shows PostgreSQL as disconnected. Start Docker Desktop to enable persistent database-backed layout storage.
- Busy port: stop the old process or run `node stop-local.mjs`.
- Network exposure warning: keep the backend on `127.0.0.1` for personal OBS use. If you intentionally expose it to another machine or the internet, add authentication first.
- OAuth redirect mismatch: make sure Google Cloud uses port `5170`, not the old backend port.
- Blank overlay: open `http://localhost:5150/overlay/main-overlay?debug=true` and check Socket status.
- YouTube says disconnected: add real `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `backend/.env.local`, then reconnect from admin.
- Layout did not update in OBS: save in `http://localhost:5160/admin/overlay-editor/main-overlay`, then refresh your OBS browser source.
- Widget will not drag: make sure the widget is unlocked in the editor inspector. OBS render mode is intentionally not draggable.
