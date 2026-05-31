# Database

PostgreSQL schema and development seed data.

## Apply

```bash
psql "$DATABASE_URL" -f database/migrations/001_initial_schema.sql
psql "$DATABASE_URL" -f database/migrations/003_youtube_integration.sql
psql "$DATABASE_URL" -f database/migrations/004_widget_layouts.sql
psql "$DATABASE_URL" -f database/seeds/dev_seed.sql
```

## Tables

- `overlays`
- `overlay_tokens`
- `themes`
- `widgets`
- `widget_layouts`
- `events`
- `goals`
- `stream_sessions`
- `admin_settings`
- `youtube_accounts`
- `youtube_oauth_tokens`
- `youtube_live_sessions`
- `youtube_event_dedup`
- `youtube_polling_state`
