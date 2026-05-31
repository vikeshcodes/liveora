import type { Pool } from "pg";
import type { WidgetLayoutRecord } from "../types";
import { OverlayStore } from "./store";
import type { SQLiteKvStore } from "./sqliteKvStore";

const nowIso = () => new Date().toISOString();

const WIDGET_IDS = [
  "alert-widget",
  "superchat-widget",
  "announcement-widget",
  "chat-widget",
  "goal-widget",
  "timer-widget",
  "viewer-count-widget",
  "activity-feed-widget",
  "music-widget"
];

const horizontalDefaults: Omit<WidgetLayoutRecord, "overlayId" | "updatedAt">[] = [
  { widgetId: "timer-widget", x: 44, y: 44, width: 190, height: 120, unit: "px", locked: false, visible: true, zIndex: 20 },
  { widgetId: "viewer-count-widget", x: 44, y: 158, width: 190, height: 64, unit: "px", locked: false, visible: true, zIndex: 20 },
  { widgetId: "goal-widget", x: 680, y: 44, width: 560, height: 128, unit: "px", locked: false, visible: true, zIndex: 18 },
  { widgetId: "alert-widget", x: 700, y: 86, width: 520, height: 160, unit: "px", locked: false, visible: true, zIndex: 40 },
  { widgetId: "superchat-widget", x: 680, y: 360, width: 560, height: 180, unit: "px", locked: false, visible: true, zIndex: 45 },
  { widgetId: "announcement-widget", x: 680, y: 860, width: 560, height: 150, unit: "px", locked: false, visible: true, zIndex: 35 },
  { widgetId: "chat-widget", x: 44, y: 760, width: 430, height: 270, unit: "px", locked: false, visible: true, zIndex: 16 },
  { widgetId: "activity-feed-widget", x: 1546, y: 430, width: 330, height: 390, unit: "px", locked: false, visible: true, zIndex: 16 },
  { widgetId: "music-widget", x: 1596, y: 910, width: 280, height: 100, unit: "px", locked: false, visible: true, zIndex: 14 }
];

const verticalDefaults: Omit<WidgetLayoutRecord, "overlayId" | "updatedAt">[] = [
  { widgetId: "timer-widget", x: 32, y: 32, width: 190, height: 120, unit: "px", locked: false, visible: true, zIndex: 20 },
  { widgetId: "viewer-count-widget", x: 32, y: 164, width: 190, height: 64, unit: "px", locked: false, visible: true, zIndex: 20 },
  { widgetId: "goal-widget", x: 250, y: 32, width: 760, height: 128, unit: "px", locked: false, visible: true, zIndex: 18 },
  { widgetId: "alert-widget", x: 260, y: 220, width: 560, height: 170, unit: "px", locked: false, visible: true, zIndex: 40 },
  { widgetId: "superchat-widget", x: 220, y: 520, width: 640, height: 190, unit: "px", locked: false, visible: true, zIndex: 45 },
  { widgetId: "announcement-widget", x: 180, y: 1660, width: 720, height: 150, unit: "px", locked: false, visible: true, zIndex: 35 },
  { widgetId: "chat-widget", x: 40, y: 1420, width: 620, height: 300, unit: "px", locked: false, visible: true, zIndex: 16 },
  { widgetId: "activity-feed-widget", x: 560, y: 1110, width: 470, height: 420, unit: "px", locked: false, visible: true, zIndex: 16 },
  { widgetId: "music-widget", x: 650, y: 1740, width: 360, height: 110, unit: "px", locked: false, visible: true, zIndex: 14 }
];

const numberOr = (value: unknown, fallback: number, min = 0, max = 4000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const rowToLayout = (row: any): WidgetLayoutRecord => ({
  overlayId: row.overlay_id,
  widgetId: row.widget_id,
  x: Number(row.x),
  y: Number(row.y),
  width: Number(row.width),
  height: Number(row.height),
  unit: "px",
  locked: Boolean(row.locked),
  visible: Boolean(row.visible),
  zIndex: Number(row.z_index),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? nowIso())
});

export class WidgetLayoutService {
  private memory = new Map<string, WidgetLayoutRecord[]>();

  constructor(
    private readonly pool: Pool | null,
    private readonly overlayStore: OverlayStore,
    private readonly kvStore: SQLiteKvStore | null = null
  ) {}

  async getLayout(overlayId: string) {
    const overlay = this.overlayStore.getOverlay(overlayId);
    if (!overlay) {
      throw Object.assign(new Error("Overlay not found"), { statusCode: 404 });
    }

    const defaults = this.defaultLayout(overlayId);
    const saved = await this.loadSaved(overlayId);
    const merged = this.merge(defaults, saved);

    return {
      overlayId,
      baseWidth: overlay.config.layout === "vertical" ? 1080 : 1920,
      baseHeight: overlay.config.layout === "vertical" ? 1920 : 1080,
      widgets: merged
    };
  }

  async replaceLayout(overlayId: string, widgets: unknown[]) {
    const current = await this.getLayout(overlayId);
    const fallbackById = new Map(current.widgets.map((item) => [item.widgetId, item]));
    const next = widgets.map((item) => this.normalize(overlayId, item, fallbackById.get((item as any)?.widgetId)));
    await this.saveAll(overlayId, next);
    return this.getLayout(overlayId);
  }

  async patchWidget(overlayId: string, widgetId: string, patch: unknown) {
    if (!WIDGET_IDS.includes(widgetId)) {
      throw Object.assign(new Error("Unknown widget layout ID"), { statusCode: 400 });
    }

    const current = await this.getLayout(overlayId);
    const existing = current.widgets.find((item) => item.widgetId === widgetId);
    const next = this.normalize(overlayId, { ...(existing ?? {}), ...(patch as Record<string, unknown>), widgetId }, existing);
    await this.saveAll(overlayId, [next]);
    return this.getLayout(overlayId);
  }

  async resetLayout(overlayId: string) {
    const overlay = this.overlayStore.getOverlay(overlayId);
    if (!overlay) {
      throw Object.assign(new Error("Overlay not found"), { statusCode: 404 });
    }

    if (this.pool) {
      await this.pool.query("DELETE FROM widget_layouts WHERE overlay_id = $1", [overlayId]).catch(() => undefined);
    }
    this.memory.delete(overlayId);
    this.kvStore?.delete(this.kvKey(overlayId));
    return this.getLayout(overlayId);
  }

  private defaultLayout(overlayId: string): WidgetLayoutRecord[] {
    const overlay = this.overlayStore.getOverlay(overlayId);
    const source = overlay?.config.layout === "vertical" ? verticalDefaults : horizontalDefaults;
    const updatedAt = nowIso();
    return source.map((item) => ({ ...item, overlayId, updatedAt }));
  }

  private async loadSaved(overlayId: string) {
    if (!this.pool) {
      const cached = this.memory.get(overlayId);
      if (cached) {
        return cached;
      }
      const persisted = this.kvStore?.get<WidgetLayoutRecord[]>(this.kvKey(overlayId)) ?? [];
      if (persisted.length) {
        this.memory.set(overlayId, persisted);
      }
      return persisted;
    }

    try {
      const result = await this.pool.query("SELECT * FROM widget_layouts WHERE overlay_id = $1 ORDER BY z_index, widget_id", [
        overlayId
      ]);
      return result.rows.map(rowToLayout);
    } catch {
      return this.memory.get(overlayId) ?? [];
    }
  }

  private merge(defaults: WidgetLayoutRecord[], saved: WidgetLayoutRecord[]) {
    const byId = new Map(defaults.map((item) => [item.widgetId, item]));
    for (const item of saved) {
      if (WIDGET_IDS.includes(item.widgetId)) {
        byId.set(item.widgetId, { ...(byId.get(item.widgetId) ?? item), ...item });
      }
    }
    return WIDGET_IDS.map((id) => byId.get(id)).filter(Boolean) as WidgetLayoutRecord[];
  }

  private normalize(overlayId: string, input: unknown, fallback?: WidgetLayoutRecord): WidgetLayoutRecord {
    const item = (input ?? {}) as Record<string, unknown>;
    const widgetId = String(item.widgetId ?? fallback?.widgetId ?? "");
    if (!WIDGET_IDS.includes(widgetId)) {
      throw Object.assign(new Error("Unknown widget layout ID"), { statusCode: 400 });
    }

    return {
      overlayId,
      widgetId,
      x: numberOr(item.x, fallback?.x ?? 0),
      y: numberOr(item.y, fallback?.y ?? 0),
      width: numberOr(item.width, fallback?.width ?? 320, 80),
      height: numberOr(item.height, fallback?.height ?? 160, 40),
      unit: "px",
      locked: Boolean(item.locked ?? fallback?.locked ?? false),
      visible: Boolean(item.visible ?? fallback?.visible ?? true),
      zIndex: numberOr(item.zIndex, fallback?.zIndex ?? 10, 0, 200),
      updatedAt: nowIso()
    };
  }

  private async saveAll(overlayId: string, widgets: WidgetLayoutRecord[]) {
    const mergedMemory = this.merge(this.defaultLayout(overlayId), [
      ...(this.memory.get(overlayId) ?? []),
      ...widgets
    ]);
    this.memory.set(overlayId, mergedMemory);
    this.kvStore?.set(this.kvKey(overlayId), mergedMemory);

    if (!this.pool) {
      return;
    }

    try {
      for (const widget of widgets) {
        await this.pool.query(
          `INSERT INTO widget_layouts
          (overlay_id, widget_id, x, y, width, height, unit, locked, visible, z_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (overlay_id, widget_id) DO UPDATE SET
          x = EXCLUDED.x,
          y = EXCLUDED.y,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          unit = EXCLUDED.unit,
          locked = EXCLUDED.locked,
          visible = EXCLUDED.visible,
          z_index = EXCLUDED.z_index,
          updated_at = now()`,
          [
            widget.overlayId,
            widget.widgetId,
            widget.x,
            widget.y,
            widget.width,
            widget.height,
            widget.unit,
            widget.locked,
            widget.visible,
            widget.zIndex
          ]
        );
      }
    } catch {
      return;
    }
  }

  private kvKey(overlayId: string) {
    return `liveora:widget-layout:${overlayId}`;
  }
}
