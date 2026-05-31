# Changelog

## Unreleased

- Initial open-source structure
- Local runner
- YouTube integration foundation
- OBS overlay system
- Fixed local runner database migration/seed bootstrap for PostgreSQL on port 5180
- Fixed local stop script to safely stop project-owned dev processes on ports 5150, 5160, and 5170
- Fixed admin OBS URL generation for the local frontend port 5150
- Fixed YouTube missing-credentials/start failure status handling
- Added backend tests for YouTube event normalization, event deduplication, and overlay config seeding
- Documented the end-to-end tested local OBS flow
- Added public themes/widgets to the safe local-config API response
- Added admin setup checklist for backend, database, config, OAuth, YouTube auth, active overlay, and OBS URL readiness
- Added visible admin notices for backend-driven YouTube auth/status/errors, config, widget, theme, and layout updates
- Changed YouTube OAuth callback to redirect back to the admin UI with success/failed status
- Added draggable overlay editor save/reset verification and persistent `widget_layouts` storage
- Removed obsolete placeholder adapter stubs so production code reflects the official YouTube/manual event flow only
- Fixed public local config to show the effective non-secret YouTube channel ID source when `.env.local` preserves a real value
- Fixed YouTube active broadcast refresh to avoid the invalid `broadcastStatus` + `mine` API parameter combination
- Fixed YouTube poller stop-state races so admin does not show stale running pollers after integration stop
- Added first-run admin quick actions for opening the debug overlay and sending chat, Super Chat, and viewer-count test events
- Replaced fake now-playing copy with an honest local placeholder state
- Added scene/profile presets with activation, duplication, scene-specific OBS URLs, and backend realtime admin updates
- Added a live admin preview route that embeds the real overlay and can trigger test chat, Super Chat, and viewer-count events
- Added event history filtering and clear controls backed by `/api/v1/events/recent/:overlayId` and `/api/v1/events/clear/:overlayId`
- Added four professional theme presets: Coding Focus Pro, Study Calm Pro, Cyber Clean Pro, and Vertical Minimal Pro
- Added overlay editor keyboard shortcuts and unsaved-change protection
- Made the local runner continue starting backend/frontend/admin with a visible database warning when Docker Desktop is not running
- Added Docker-first LiveOra all-in-one mode on port 3080 with backend-served admin, setup wizard, overlay, API, and Socket.IO
- Added SQLite runtime persistence for Docker mode using `/app/data/liveora.db`
- Added runtime `/api/v1/public-config`, `/api/v1/setup`, and `/api/v1/settings` endpoints with masked Google OAuth secret state
- Added Dockerfile, Docker Compose files, Docker ignore file, and GHCR publish workflow
