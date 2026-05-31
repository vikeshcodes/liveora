# LiveOra by Vikesh Codes

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-LTS-339933)
![Local-first](https://img.shields.io/badge/Local--first-yes-0ea5e9)
![OBS Overlay](https://img.shields.io/badge/OBS-Overlay-7c3aed)
![YouTube API Ready](https://img.shields.io/badge/YouTube%20API-ready-red)
![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen)

Docker-first, local-first OBS overlay system with YouTube API integration, WebSocket events, glassmorphism themes, admin controls, multi-overlay support, and a draggable layout editor.

**LiveOra by Vikesh Codes** is the all-in-one Docker packaging of **Vikesh Codes Creator OS**. It is a local-first, open-source, professional OBS livestream overlay system for creators, coders, streamers, students, and educators.

Official project by **VikeshCodes**.

## Docker Quick Start

The easiest way for most users is one container, one port, and one persistent data volume:

```bash
docker run -d \
  --name liveora \
  -p 3080:3080 \
  -v liveora-data:/app/data \
  --restart unless-stopped \
  ghcr.io/vikeshcodes/liveora:latest
```

Then open:

- Home: `http://localhost:3080/`
- Setup wizard: `http://localhost:3080/setup`
- Admin: `http://localhost:3080/admin`
- Overlay: `http://localhost:3080/overlay/main-overlay`
- Debug overlay: `http://localhost:3080/overlay/main-overlay?debug=true`
- Overlay editor: `http://localhost:3080/admin/overlay-editor/main-overlay`
- Health: `http://localhost:3080/health`

Docker mode uses SQLite by default at `/app/data/liveora.db`, so your setup, overlays, themes, layouts, scenes, goals, timers, YouTube token metadata, and local event history survive container restarts.

### Docker Compose

```bash
docker compose up -d --build
docker compose logs -f liveora
docker compose down
```

Backup the local Docker data volume:

```bash
docker run --rm -v liveora_liveora_data:/data -v "$PWD":/backup alpine tar czf /backup/liveora-data-backup.tgz -C /data .
```

Restore:

```bash
docker run --rm -v liveora_liveora_data:/data -v "$PWD":/backup alpine sh -c "cd /data && tar xzf /backup/liveora-data-backup.tgz"
```

Advanced PostgreSQL mode is available with:

```bash
docker compose -f docker-compose.postgres.yml up -d --build
```

## Development Quick Start

Run the local stack and open these URLs to preview the project:

- Overlay: `http://localhost:5150/overlay/main-overlay`
- Admin: `http://localhost:5160/admin`
- Overlay editor: `http://localhost:5160/admin/overlay-editor/main-overlay`

## Features

- Local OBS browser-source overlay
- WebSocket realtime events
- Official YouTube API integration
- Live chat overlay
- Super Chat alerts
- Viewer count widget
- Timer widget
- Goal widget
- Announcement widget
- Multiple overlays
- Scene/profile presets for coding, study, vertical, starting-soon, and BRB workflows
- Liquid Glass Pro theme
- Minimal Matte Pro theme
- Coding Focus Pro, Study Calm Pro, Cyber Clean Pro, and Vertical Minimal Pro themes
- Admin control panel
- Live admin preview with real backend events
- Event history with filtering and clear controls
- Local config system
- One-command local runner

## Local Ports

| Service | Port | URL |
| --- | ---: | --- |
| Frontend overlay | 5150 | `http://localhost:5150` |
| Admin panel | 5160 | `http://localhost:5160/admin` |
| Backend API/WebSocket | 5170 | `http://localhost:5170` |
| PostgreSQL | 5180 | `localhost:5180` |

```bash
git clone https://github.com/vikeshcodes/creator-os.git
cd creator-os
npm run setup
npm run dev:local
```

Then open:

- Admin: `http://localhost:5160/admin`
- Live preview: `http://localhost:5160/admin/preview/main-overlay`
- Overlay: `http://localhost:5150/overlay/main-overlay`
- Backend health: `http://localhost:5170/health`

`npm run setup` creates `creator-os.config.json` from the safe example when it is missing. The local runner generates `.env.local` files from `creator-os.config.json`, preserves existing real secrets, starts PostgreSQL with Docker, applies database migrations/seeds, and starts backend, frontend, and admin on fixed ports.

The admin panel includes a first-run setup checklist so backend, database, config, OAuth, active overlay, and OBS URL state are visible in the UI instead of only in terminal logs.

For the local-first OBS workflow, the admin dashboard does not require a separate admin login/token. Keep the services on localhost and do not expose the backend with tunnels or public networking unless you add authentication in front of it.

## Docker Runtime Configuration

Docker users normally configure the app from the browser at:

```text
http://localhost:3080/setup
http://localhost:3080/admin/settings
```

You do not need to edit `.env` files for normal Docker use. The settings UI stores safe runtime config in the persistent data volume and masks Google client secrets. OAuth tokens stay server-side only.

Admin login is off by default for localhost personal OBS use. If you expose the container beyond your own machine, set an optional password:

```bash
docker run -d --name liveora -p 3080:3080 -v liveora-data:/app/data \
  -e LIVEORA_ADMIN_PASSWORD='choose-a-strong-password' \
  ghcr.io/vikeshcodes/liveora:latest
```

This is optional Basic Auth for the admin/setup pages and mutating local API calls. It is not the old `ADMIN_API_TOKEN` system.

Runtime public config is available at:

```text
http://localhost:3080/api/v1/public-config
```

That endpoint returns only safe public data: app name, mode, URLs, overlay list, themes, widgets, scenes, and whether YouTube/OAuth are configured. It never returns Google client secrets, OAuth access tokens, OAuth refresh tokens, or database credentials.

## OBS Setup

Add an OBS Browser Source:

- URL: `http://localhost:5150/overlay/main-overlay`
- Width: `1920`
- Height: `1080`
- Custom CSS: optional, not required

Debug overlay:

```text
http://localhost:5150/overlay/main-overlay?debug=true
```

## Google OAuth Setup

Create a Google Cloud project, enable **YouTube Data API v3**, and create an OAuth Web Client.

Authorized JavaScript origins:

```text
http://localhost:3080
http://localhost:5150
http://localhost:5160
http://localhost:5170
```

Authorized redirect URI:

```text
Docker: http://localhost:3080/api/v1/youtube/auth/callback
Development: http://localhost:5170/api/v1/youtube/auth/callback
```

In Docker mode, add your YouTube channel ID/handle and Google OAuth client ID/secret in `/setup` or `/admin/settings`.

In development mode, put your real Google OAuth values in:

```text
backend/.env.local
```

Never commit OAuth credentials or tokens.

## Development OAuth Redirect

```text
http://localhost:5170/api/v1/youtube/auth/callback
```

## Configuration

Edit:

```text
creator-os.config.json
```

This is where you set:

- YouTube channel ID
- YouTube channel handle
- Active overlay
- Ports
- Local URLs
- Overlay list
- YouTube polling settings
- Theme selection

The committed safe template is:

```text
creator-os.config.example.json
```

To change YouTube channel, edit only:

```json
{
  "youtube": {
    "channelId": "YOUR_YOUTUBE_CHANNEL_ID",
    "channelHandle": "@YourChannelHandle"
  }
}
```

Do not commit `creator-os.config.json` or `.env.local` files.

## Multiple Overlays

Examples:

```text
http://localhost:5150/overlay/main-overlay
http://localhost:5150/overlay/vertical-overlay
http://localhost:5150/overlay/gaming-overlay
```

To add an overlay, add it to the `overlays` array in `creator-os.config.json`.

## Scenes And Profiles

Scenes are local stream profiles that switch theme and widget visibility for a given overlay. Built-in examples include coding, study/live class, starting soon, be right back, vertical live, and a clean gaming profile.

Scene OBS URLs look like:

```text
http://localhost:5150/overlay/main-overlay?scene=coding
http://localhost:5150/overlay/main-overlay?scene=study
http://localhost:5150/overlay/vertical-overlay?scene=vertical-live
```

Use the admin dashboard to activate, duplicate, preview, and copy scene URLs.

## Overlay Layout Editor

Open:

```text
http://localhost:5160/admin/overlay-editor/main-overlay
```

The editor supports dragging widgets, show/hide, lock/unlock, saving positions, resetting defaults, keyboard nudging, and copying the OBS URL. OBS render mode stays locked and clean at:

```text
http://localhost:5150/overlay/main-overlay
```

Editor shortcuts:

- `Cmd/Ctrl+S`: save layout
- `Cmd/Ctrl+R`: reset layout
- Arrow keys: move selected widget by 1px
- `Shift+Arrow`: move selected widget by 10px
- `?`: show shortcuts

For a full-screen admin preview that renders the actual OBS overlay in an iframe, open:

```text
http://localhost:5160/admin/preview/main-overlay
```

## YouTube API Notes

This project uses official YouTube APIs only. It does not use StreamElements, Streamlabs, Nightbot, or third-party livestream alert services.

Supported events:

- Live chat messages
- Super Chat alerts
- Viewer count
- Stream status
- Best-effort recent subscriber alerts
- Membership updates when the channel and OAuth scope support them
- Manual admin fallback events

Subscriber alerts are best-effort because YouTube does not expose all private subscriber events.

Without real Google OAuth credentials, the app does not crash: YouTube status reports disconnected, pollers stay stopped, and the admin panel shows setup warnings. Use the built-in test buttons to verify OBS widgets before going live.

After OAuth succeeds, the backend redirects to:

```text
http://localhost:5160/admin/youtube?auth=success
```

The admin panel refetches auth/status, shows a success banner, and updates the connected channel/status cards. Failed OAuth redirects to `?auth=failed` with a visible error.

## End-to-End Tested Local Flow

The local stack has been tested with:

- `npm run setup`
- `CREATOR_OS_SAME_TERMINAL=true node start-local.mjs`
- Backend health, status, local config, overlay, theme, and YouTube status routes
- Database migrations and seed reapplication
- WebSocket delivery from backend events to the OBS overlay
- Realtime backend state updates to admin for YouTube auth/status/errors, config changes, theme changes, widget updates, layout saves, and events
- Scene activation, scene-specific OBS URLs, and event history clear/filter controls
- Admin-triggered and backend-triggered test events
- Overlay chat, Super Chat, viewer count, goal, timer, theme, and debug widgets
- Draggable overlay editor save/reset with persistent `widget_layouts` storage

If Docker Desktop is not running, `npm run dev:local` starts backend/frontend/admin and shows a clear database warning. The admin checklist reports PostgreSQL as disconnected until Docker or another local PostgreSQL service is available on port `5180`.

Real YouTube livestream events still require your own Google OAuth credentials, channel access, API quota, and an active livestream with live chat enabled.

## Repository Topics

Suggested GitHub topics:

```text
obs livestream youtube-api overlay websocket socketio vite nodejs creator-tools open-source streaming glassmorphism
```

## Contributing

Community contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

Only VikeshCodes maintainers decide what becomes part of the official project.

## Security

Please do not report security issues publicly. Read [SECURITY.md](SECURITY.md).

## Support

For support options, see [SUPPORT.md](SUPPORT.md).

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

The software code is licensed under the [Apache License 2.0](LICENSE).

## Ownership And Branding

Vikesh Codes Creator OS is the official project of **VikeshCodes**.

The code is open-source, but the names “Vikesh Codes”, “VikeshCodes”, “Vikesh Codes Creator OS”, logos, and official branding are protected project identity. See [TRADEMARKS.md](TRADEMARKS.md).
