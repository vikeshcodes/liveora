export type EventType =
  | "subscriber"
  | "superchat"
  | "donation"
  | "membership"
  | "chat"
  | "viewer_count"
  | "goal_update"
  | "timer_start"
  | "timer_pause"
  | "timer_reset"
  | "announcement"
  | "test_alert"
  | "stream_status";

export interface OverlayEvent {
  id: string;
  platform?: "manual" | "youtube" | string;
  type: EventType;
  overlayId: string;
  username: string | null;
  message: string | null;
  amount: number | null;
  currency: string | null;
  displayAmount?: string | null;
  amountMicros?: number | null;
  avatarUrl?: string | null;
  priority?: number;
  publishedAt?: string | null;
  count?: number | null;
  levelName?: string | null;
  reliability?: "best_effort" | "official" | string | null;
  isVerified?: boolean;
  isChatOwner?: boolean;
  isChatSponsor?: boolean;
  isChatModerator?: boolean;
  timestamp: string;
  meta: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface WidgetConfig {
  enabled: boolean;
  position: string;
  duration?: number;
  maxMessages?: number;
  maxItems?: number;
}

export interface OverlayConfig {
  themeId: string;
  layout: "horizontal" | "vertical";
  alertDurationMs: number;
  queueMaxLength: number;
  widgets: Record<string, WidgetConfig>;
}

export interface OverlayRecord {
  id: string;
  name: string;
  slug: string;
  config: OverlayConfig;
  createdAt: string;
  updatedAt: string;
}

export interface OverlayTokenRecord {
  overlayId: string;
  token: string;
  label: string;
  enabled: boolean;
  createdAt: string;
}

export interface ThemeRecord {
  id: string;
  name: string;
  description: string;
  variables: Record<string, string>;
}

export interface GoalRecord {
  overlayId: string;
  title: string;
  currentValue: number;
  targetValue: number;
  currency: string | null;
  updatedAt: string;
}

export interface TimerState {
  overlayId: string;
  status: "idle" | "running" | "paused";
  durationMs: number;
  remainingMs: number;
  startedAt: string | null;
  endsAt: string | null;
  updatedAt: string;
}

export interface WidgetLayoutRecord {
  overlayId: string;
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  unit: "px";
  locked: boolean;
  visible: boolean;
  zIndex: number;
  updatedAt: string;
}

export interface SceneRecord {
  id: string;
  overlayId: string;
  name: string;
  description: string;
  themeId: string;
  layout: "horizontal" | "vertical";
  active: boolean;
  widgetVisibility: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}
