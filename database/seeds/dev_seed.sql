INSERT INTO themes (id, name, description, variables)
VALUES
  (
    'liquid-glass-pro',
    'Liquid Glass Pro',
    'Premium glass panels, restrained cyan glow, and liquid gradient accents.',
    '{
      "--bg-dark": "rgba(5, 8, 15, 0)",
      "--glass-bg": "rgba(12, 18, 30, 0.58)",
      "--glass-border": "rgba(150, 225, 255, 0.22)",
      "--text-primary": "#f8fbff",
      "--text-secondary": "#aebbd0",
      "--accent-primary": "#6ee7ff",
      "--accent-secondary": "#a78bfa",
      "--success": "#3ddc97",
      "--warning": "#ffcc66",
      "--danger": "#ff6b7a",
      "--radius-lg": "22px",
      "--blur-strength": "16px",
      "--transition-fast": "160ms ease",
      "--transition-smooth": "420ms cubic-bezier(0.22, 1, 0.36, 1)"
    }'::jsonb
  ),
  (
    'minimal-matte-pro',
    'Minimal Matte Pro',
    'Quiet matte surfaces, thin borders, and crisp professional contrast.',
    '{
      "--bg-dark": "rgba(0, 0, 0, 0)",
      "--glass-bg": "rgba(14, 16, 20, 0.72)",
      "--glass-border": "rgba(255, 255, 255, 0.13)",
      "--text-primary": "#ffffff",
      "--text-secondary": "#b7beca",
      "--accent-primary": "#8bd3ff",
      "--accent-secondary": "#d6b06f",
      "--success": "#61d394",
      "--warning": "#f5c451",
      "--danger": "#ff7474",
      "--radius-lg": "16px",
      "--blur-strength": "10px",
      "--transition-fast": "140ms ease",
      "--transition-smooth": "360ms cubic-bezier(0.22, 1, 0.36, 1)"
    }'::jsonb
  ),
  (
    'coding-focus-pro',
    'Coding Focus Pro',
    'Low-glare developer stream theme with cool cyan focus states and quiet panels.',
    '{
      "--bg-dark": "rgba(3, 7, 12, 0)",
      "--glass-bg": "rgba(9, 15, 22, 0.66)",
      "--glass-border": "rgba(92, 210, 255, 0.2)",
      "--text-primary": "#f4fbff",
      "--text-secondary": "#9fb2c5",
      "--accent-primary": "#5bd7ff",
      "--accent-secondary": "#82f7c6",
      "--success": "#4ade80",
      "--warning": "#ffd166",
      "--danger": "#ff6b7a",
      "--radius-lg": "18px",
      "--blur-strength": "12px",
      "--transition-fast": "140ms ease",
      "--transition-smooth": "380ms cubic-bezier(0.22, 1, 0.36, 1)"
    }'::jsonb
  ),
  (
    'study-calm-pro',
    'Study Calm Pro',
    'Calm teaching and study-stream palette with soft contrast and warm accent balance.',
    '{
      "--bg-dark": "rgba(5, 7, 10, 0)",
      "--glass-bg": "rgba(15, 19, 25, 0.68)",
      "--glass-border": "rgba(189, 215, 255, 0.17)",
      "--text-primary": "#fbfcff",
      "--text-secondary": "#b9c2d0",
      "--accent-primary": "#9cc8ff",
      "--accent-secondary": "#f4d58d",
      "--success": "#70d6a3",
      "--warning": "#f4c95d",
      "--danger": "#ff8080",
      "--radius-lg": "20px",
      "--blur-strength": "10px",
      "--transition-fast": "150ms ease",
      "--transition-smooth": "390ms cubic-bezier(0.22, 1, 0.36, 1)"
    }'::jsonb
  ),
  (
    'cyber-clean-pro',
    'Cyber Clean Pro',
    'Crisp futuristic stream theme with restrained violet and aqua accents.',
    '{
      "--bg-dark": "rgba(2, 5, 12, 0)",
      "--glass-bg": "rgba(11, 13, 28, 0.62)",
      "--glass-border": "rgba(133, 122, 255, 0.2)",
      "--text-primary": "#f7f7ff",
      "--text-secondary": "#b3b9d6",
      "--accent-primary": "#7cf7ff",
      "--accent-secondary": "#b69cff",
      "--success": "#4ef2a7",
      "--warning": "#ffd36e",
      "--danger": "#ff6f91",
      "--radius-lg": "17px",
      "--blur-strength": "14px",
      "--transition-fast": "150ms ease",
      "--transition-smooth": "400ms cubic-bezier(0.22, 1, 0.36, 1)"
    }'::jsonb
  ),
  (
    'vertical-minimal-pro',
    'Vertical Minimal Pro',
    'Compact high-readability theme for vertical live classes, shorts, and phone-first streams.',
    '{
      "--bg-dark": "rgba(0, 0, 0, 0)",
      "--glass-bg": "rgba(10, 12, 16, 0.74)",
      "--glass-border": "rgba(255, 255, 255, 0.14)",
      "--text-primary": "#ffffff",
      "--text-secondary": "#c4cad7",
      "--accent-primary": "#6ee7ff",
      "--accent-secondary": "#f5c451",
      "--success": "#64d99b",
      "--warning": "#ffd166",
      "--danger": "#ff7474",
      "--radius-lg": "14px",
      "--blur-strength": "9px",
      "--transition-fast": "130ms ease",
      "--transition-smooth": "340ms cubic-bezier(0.22, 1, 0.36, 1)"
    }'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  updated_at = now();

INSERT INTO overlays (id, name, slug, layout, theme_id, config)
VALUES (
  'main-overlay',
  'Vikesh Codes Main Overlay',
  'main-overlay',
  'horizontal',
  'liquid-glass-pro',
  '{
    "themeId": "liquid-glass-pro",
    "layout": "horizontal",
    "alertDurationMs": 5000,
    "queueMaxLength": 30,
    "widgets": {
      "alertWidget": { "enabled": true, "duration": 5000, "position": "top-right" },
      "chatWidget": { "enabled": true, "maxMessages": 8, "position": "bottom-left" },
      "goalWidget": { "enabled": true, "position": "top-center" },
      "timerWidget": { "enabled": true, "position": "top-left" },
      "viewerCountWidget": { "enabled": true, "position": "top-left" },
      "activityFeedWidget": { "enabled": true, "maxItems": 6, "position": "middle-right" },
      "nowPlayingWidget": { "enabled": true, "position": "bottom-right" }
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO overlay_tokens (overlay_id, token, label, enabled)
VALUES ('main-overlay', 'dev-overlay-token', 'Development OBS browser source token', true)
ON CONFLICT (token) DO NOTHING;

INSERT INTO widgets (overlay_id, widget_key, enabled, position, config)
VALUES
  ('main-overlay', 'alertWidget', true, 'top-right', '{ "duration": 5000 }'::jsonb),
  ('main-overlay', 'chatWidget', true, 'bottom-left', '{ "maxMessages": 8 }'::jsonb),
  ('main-overlay', 'goalWidget', true, 'top-center', '{}'::jsonb),
  ('main-overlay', 'timerWidget', true, 'top-left', '{}'::jsonb),
  ('main-overlay', 'viewerCountWidget', true, 'top-left', '{}'::jsonb),
  ('main-overlay', 'activityFeedWidget', true, 'middle-right', '{ "maxItems": 6 }'::jsonb),
  ('main-overlay', 'nowPlayingWidget', true, 'bottom-right', '{}'::jsonb)
ON CONFLICT (overlay_id, widget_key) DO NOTHING;

INSERT INTO goals (overlay_id, title, current_value, target_value, currency)
VALUES ('main-overlay', 'Stream Support Goal', 3200, 10000, 'INR')
ON CONFLICT (overlay_id, title) DO NOTHING;
