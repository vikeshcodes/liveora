# Frontend Overlay

Vite vanilla JavaScript OBS browser-source overlay.

## Run

```bash
cd overlay-system/frontend
npm install
npm run dev:local
```

Open:

```text
http://localhost:5150/overlay/main-overlay
```

Debug mode:

```text
http://localhost:5150/overlay/main-overlay?debug=true
```

## Notes

- Transparent background for OBS.
- Modular widgets live in `src/widgets/`.
- GSAP is used for transform and opacity based animations.
- Socket.IO handles reconnects automatically.
- YouTube chat metadata supports avatars and owner/moderator/member/verified badges.
- YouTube Super Chat, subscriber, and membership events use the alert queue.
