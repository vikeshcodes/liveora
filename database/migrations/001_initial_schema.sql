CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS overlays (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  layout TEXT NOT NULL DEFAULT 'horizontal',
  theme_id TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS overlay_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'OBS browser source token',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  position TEXT NOT NULL DEFAULT 'top-right',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (overlay_id, widget_key)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  username TEXT,
  message TEXT,
  amount NUMERIC(12, 2),
  currency TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_overlay_created_idx ON events (overlay_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_type_idx ON events (type);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  current_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  target_value NUMERIC(12, 2) NOT NULL DEFAULT 1,
  currency TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (overlay_id, title)
);

CREATE TABLE IF NOT EXISTS stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
