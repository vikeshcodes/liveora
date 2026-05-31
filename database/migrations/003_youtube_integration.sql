CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS youtube_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  channel_handle TEXT,
  connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (overlay_id)
);

CREATE TABLE IF NOT EXISTS youtube_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_account_id UUID NOT NULL REFERENCES youtube_accounts(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  scope TEXT NOT NULL DEFAULT '',
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expiry_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (youtube_account_id)
);

CREATE TABLE IF NOT EXISTS youtube_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  broadcast_id TEXT NOT NULL,
  video_id TEXT,
  live_chat_id TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (overlay_id, broadcast_id)
);

CREATE TABLE IF NOT EXISTS youtube_event_dedup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, event_type, external_event_id)
);

CREATE INDEX IF NOT EXISTS youtube_event_dedup_overlay_received_idx
  ON youtube_event_dedup (overlay_id, received_at DESC);

CREATE TABLE IF NOT EXISTS youtube_polling_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  poller_name TEXT NOT NULL,
  next_page_token TEXT,
  last_polled_at TIMESTAMPTZ,
  polling_interval_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (overlay_id, poller_name)
);
