# Admin Panel

React Vite dashboard for manual events, themes, widgets, goals, timers, and overlay URL generation.

## Run

```bash
cd overlay-system/admin
npm install
cp .env.example .env
npm run dev:local
```

Open:

```text
http://localhost:5160/admin
```

The dashboard expects the backend at `VITE_BACKEND_URL` and Socket.IO at `VITE_SOCKET_URL`.

Use the YouTube Integration section to connect Google OAuth, refresh the active livestream session, start/stop pollers, inspect poller state, and send YouTube test events without going live.

Overlay layout editor:

```text
http://localhost:5160/admin/overlay-editor/main-overlay
```
