CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS widget_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
  widget_id TEXT NOT NULL,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 320,
  height INTEGER NOT NULL DEFAULT 160,
  unit TEXT NOT NULL DEFAULT 'px',
  locked BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  z_index INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (overlay_id, widget_id)
);

CREATE INDEX IF NOT EXISTS widget_layouts_overlay_idx
  ON widget_layouts (overlay_id, z_index, widget_id);
