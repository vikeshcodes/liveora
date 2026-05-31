import type {
  GoalRecord,
  OverlayConfig,
  OverlayEvent,
  OverlayRecord,
  OverlayTokenRecord,
  SceneRecord,
  ThemeRecord
} from "../types";
import { loadCreatorOsConfig } from "../config/localConfig";
import { createOverlayToken, toSlug } from "../utils/ids";
import { DEFAULT_CONFIG, DEFAULT_GOAL, DEFAULT_OVERLAY, DEFAULT_SCENES, DEFAULT_THEMES, DEFAULT_TOKEN } from "./defaults";
import type { SQLiteKvStore } from "./sqliteKvStore";

interface OverlayStoreSnapshot {
  overlays: OverlayRecord[];
  tokens: OverlayTokenRecord[];
  themes: ThemeRecord[];
  goals: GoalRecord[];
  scenes: SceneRecord[];
  events: OverlayEvent[];
  recentEventIds: string[];
}

const STORE_KEY = "liveora:overlay-store";

export class OverlayStore {
  private overlays = new Map<string, OverlayRecord>();
  private tokens = new Map<string, OverlayTokenRecord>();
  private themes = new Map<string, ThemeRecord>();
  private goals = new Map<string, GoalRecord>();
  private scenes = new Map<string, SceneRecord>();
  private events: OverlayEvent[] = [];
  private recentEventIds = new Set<string>();
  private readonly maxRecentIds = 500;

  constructor(private readonly kvStore: SQLiteKvStore | null = null) {
    this.seed();
    this.loadSnapshot();
  }

  private seed() {
    this.overlays.set(DEFAULT_OVERLAY.id, structuredClone(DEFAULT_OVERLAY));
    this.tokens.set(DEFAULT_TOKEN.overlayId, structuredClone(DEFAULT_TOKEN));
    this.goals.set(DEFAULT_GOAL.overlayId, structuredClone(DEFAULT_GOAL));
    DEFAULT_THEMES.forEach((theme) => this.themes.set(theme.id, structuredClone(theme)));
    DEFAULT_SCENES.forEach((scene) => this.scenes.set(scene.id, structuredClone(scene)));
    this.seedFromLocalConfig();
  }

  private seedFromLocalConfig() {
    const config = loadCreatorOsConfig();
    const now = new Date().toISOString();

    for (const localOverlay of config.overlays ?? []) {
      const overlayConfig: OverlayConfig = {
        ...structuredClone(DEFAULT_CONFIG),
        themeId: localOverlay.theme || DEFAULT_CONFIG.themeId,
        layout: localOverlay.layout?.includes("vertical") ? "vertical" : "horizontal"
      };

      this.overlays.set(localOverlay.id, {
        id: localOverlay.id,
        name: localOverlay.name,
        slug: localOverlay.id,
        config: overlayConfig,
        createdAt: now,
        updatedAt: now
      });

      if (!this.tokens.has(localOverlay.id)) {
        this.tokens.set(localOverlay.id, {
          overlayId: localOverlay.id,
          token: localOverlay.id === "main-overlay" ? DEFAULT_TOKEN.token : createOverlayToken(),
          label: "Local OBS browser source token",
          enabled: true,
          createdAt: now
        });
      }

      if (!this.goals.has(localOverlay.id)) {
        this.goals.set(localOverlay.id, {
          ...structuredClone(DEFAULT_GOAL),
          overlayId: localOverlay.id,
          updatedAt: now
        });
      }

      if (!this.getScenes(localOverlay.id).length) {
        const sceneId = `${localOverlay.id}-default`;
        this.scenes.set(sceneId, {
          id: sceneId,
          overlayId: localOverlay.id,
          name: `${localOverlay.name} Default`,
          description: "Default scene generated from creator-os.config.json.",
          themeId: localOverlay.theme || DEFAULT_CONFIG.themeId,
          layout: localOverlay.layout?.includes("vertical") ? "vertical" : "horizontal",
          active: true,
          widgetVisibility: Object.fromEntries(Object.keys(DEFAULT_CONFIG.widgets).map((key) => [key, true])),
          createdAt: now,
          updatedAt: now
        });
      }
    }
  }

  getOverlays() {
    return [...this.overlays.values()].map((overlay) => ({
      ...overlay,
      token: this.tokens.get(overlay.id)?.token ?? null
    }));
  }

  getOverlay(id: string) {
    const overlay = this.overlays.get(id);
    if (!overlay) {
      return null;
    }

    return {
      ...overlay,
      token: this.tokens.get(id)?.token ?? null
    };
  }

  createOverlay(input: { id?: string; name: string }) {
    const now = new Date().toISOString();
    const id = input.id ? toSlug(input.id) : toSlug(input.name);
    const overlayId = id || `overlay-${Date.now()}`;

    if (this.overlays.has(overlayId)) {
      throw Object.assign(new Error("Overlay already exists"), { statusCode: 409 });
    }

    const overlay: OverlayRecord = {
      id: overlayId,
      name: input.name,
      slug: overlayId,
      config: structuredClone(DEFAULT_CONFIG),
      createdAt: now,
      updatedAt: now
    };

    const token: OverlayTokenRecord = {
      overlayId,
      token: createOverlayToken(),
      label: "OBS browser source token",
      enabled: true,
      createdAt: now
    };

    this.overlays.set(overlayId, overlay);
    this.tokens.set(overlayId, token);
    this.goals.set(overlayId, {
      ...structuredClone(DEFAULT_GOAL),
      overlayId,
      updatedAt: now
    });

    this.persist();
    return this.getOverlay(overlayId);
  }

  getConfig(overlayId: string) {
    return this.overlays.get(overlayId)?.config ?? null;
  }

  updateConfig(overlayId: string, patch: Partial<OverlayConfig>) {
    const overlay = this.overlays.get(overlayId);
    if (!overlay) {
      return null;
    }

    const nextConfig: OverlayConfig = {
      ...overlay.config,
      ...patch,
      widgets: {
        ...overlay.config.widgets,
        ...(patch.widgets ?? {})
      }
    };

    overlay.config = nextConfig;
    overlay.updatedAt = new Date().toISOString();
    this.overlays.set(overlayId, overlay);
    this.persist();
    return nextConfig;
  }

  getThemes() {
    return [...this.themes.values()];
  }

  getScenes(overlayId?: string) {
    return [...this.scenes.values()].filter((scene) => (overlayId ? scene.overlayId === overlayId : true));
  }

  getScene(sceneId: string) {
    return this.scenes.get(sceneId) ?? null;
  }

  getActiveScene(overlayId: string) {
    return this.getScenes(overlayId).find((scene) => scene.active) ?? null;
  }

  createScene(input: Partial<SceneRecord> & { name?: string; overlayId?: string }) {
    const overlayId = input.overlayId ?? "main-overlay";
    const overlay = this.overlays.get(overlayId);
    if (!overlay) {
      throw Object.assign(new Error("Overlay not found"), { statusCode: 404 });
    }

    const now = new Date().toISOString();
    const baseName = String(input.name ?? "New Scene").trim() || "New Scene";
    let id = toSlug(input.id ?? baseName);
    if (!id) id = `scene-${Date.now()}`;
    if (this.scenes.has(id)) id = `${id}-${Date.now()}`;

    const scene: SceneRecord = {
      id,
      overlayId,
      name: baseName,
      description: String(input.description ?? ""),
      themeId: input.themeId ?? overlay.config.themeId,
      layout: input.layout ?? overlay.config.layout,
      active: Boolean(input.active ?? false),
      widgetVisibility: {
        ...Object.fromEntries(Object.keys(DEFAULT_CONFIG.widgets).map((key) => [key, true])),
        ...(input.widgetVisibility ?? {})
      },
      createdAt: now,
      updatedAt: now
    };

    if (scene.active) {
      this.markActiveScene(scene.overlayId, scene.id);
    }
    this.scenes.set(scene.id, scene);
    this.persist();
    return scene;
  }

  duplicateScene(sceneId: string) {
    const source = this.scenes.get(sceneId);
    if (!source) {
      throw Object.assign(new Error("Scene not found"), { statusCode: 404 });
    }

    return this.createScene({
      ...source,
      id: `${source.id}-copy`,
      name: `${source.name} Copy`,
      active: false
    });
  }

  updateScene(sceneId: string, patch: Partial<SceneRecord>) {
    const current = this.scenes.get(sceneId);
    if (!current) {
      return null;
    }

    if (patch.overlayId && !this.overlays.has(patch.overlayId)) {
      throw Object.assign(new Error("Overlay not found"), { statusCode: 404 });
    }

    const next: SceneRecord = {
      ...current,
      ...patch,
      id: current.id,
      overlayId: patch.overlayId ?? current.overlayId,
      widgetVisibility: {
        ...current.widgetVisibility,
        ...(patch.widgetVisibility ?? {})
      },
      updatedAt: new Date().toISOString()
    };

    if (next.active) {
      this.markActiveScene(next.overlayId, next.id);
    }
    this.scenes.set(sceneId, next);
    this.persist();
    return next;
  }

  deleteScene(sceneId: string) {
    const current = this.scenes.get(sceneId);
    if (!current) {
      return null;
    }

    this.scenes.delete(sceneId);
    if (current.active) {
      const fallback = this.getScenes(current.overlayId)[0];
      if (fallback) {
        this.activateScene(fallback.id);
      }
    }
    this.persist();
    return current;
  }

  activateScene(sceneId: string) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return null;
    }

    this.markActiveScene(scene.overlayId, scene.id);
    const active = this.scenes.get(scene.id) ?? scene;
    this.applySceneToOverlay(active);
    this.persist();
    return active;
  }

  private markActiveScene(overlayId: string, sceneId: string) {
    const now = new Date().toISOString();
    for (const [id, scene] of this.scenes.entries()) {
      if (scene.overlayId === overlayId) {
        this.scenes.set(id, {
          ...scene,
          active: id === sceneId,
          updatedAt: id === sceneId ? now : scene.updatedAt
        });
      }
    }
  }

  private applySceneToOverlay(scene: SceneRecord) {
    const overlay = this.overlays.get(scene.overlayId);
    if (!overlay) {
      return null;
    }

    const widgets = Object.fromEntries(
      Object.entries(overlay.config.widgets).map(([key, config]) => [
        key,
        {
          ...config,
          enabled: scene.widgetVisibility[key] ?? config.enabled
        }
      ])
    );

    overlay.config = {
      ...overlay.config,
      themeId: scene.themeId,
      layout: scene.layout,
      widgets
    };
    overlay.updatedAt = new Date().toISOString();
    this.overlays.set(scene.overlayId, overlay);
    return overlay.config;
  }

  setTheme(overlayId: string, themeId: string) {
    if (!this.themes.has(themeId)) {
      throw Object.assign(new Error("Theme not found"), { statusCode: 404 });
    }

    return this.updateConfig(overlayId, { themeId });
  }

  getGoal(overlayId: string) {
    return this.goals.get(overlayId) ?? null;
  }

  updateGoal(overlayId: string, patch: Partial<GoalRecord>) {
    const current = this.goals.get(overlayId) ?? {
      ...structuredClone(DEFAULT_GOAL),
      overlayId
    };

    const next = {
      ...current,
      ...patch,
      overlayId,
      currentValue: Number(patch.currentValue ?? current.currentValue),
      targetValue: Number(patch.targetValue ?? current.targetValue),
      updatedAt: new Date().toISOString()
    };

    this.goals.set(overlayId, next);
    this.persist();
    return next;
  }

  validateOverlayToken(overlayId: string, token: string | undefined, requireToken: boolean) {
    const tokenRecord = this.tokens.get(overlayId);
    if (!token) {
      return !requireToken;
    }

    return Boolean(tokenRecord?.enabled && tokenRecord.token === token);
  }

  recordEvent(event: OverlayEvent) {
    if (this.recentEventIds.has(event.id)) {
      return false;
    }

    this.events.unshift(event);
    this.recentEventIds.add(event.id);

    if (this.events.length > 200) {
      this.events.length = 200;
    }

    if (this.recentEventIds.size > this.maxRecentIds) {
      const idsToKeep = this.events.slice(0, this.maxRecentIds).map((item) => item.id);
      this.recentEventIds = new Set(idsToKeep);
    }

    this.persist();
    return true;
  }

  getRecentEvents(overlayId?: string, limit = 25) {
    return this.events
      .filter((event) => (overlayId ? event.overlayId === overlayId : true))
      .slice(0, Math.min(limit, 100));
  }

  clearEvents(overlayId?: string) {
    const before = this.events.length;
    this.events = this.events.filter((event) => (overlayId ? event.overlayId !== overlayId : false));
    this.recentEventIds = new Set(this.events.map((event) => event.id).slice(0, this.maxRecentIds));
    this.persist();
    return before - this.events.length;
  }

  private snapshot(): OverlayStoreSnapshot {
    return {
      overlays: [...this.overlays.values()],
      tokens: [...this.tokens.values()],
      themes: [...this.themes.values()],
      goals: [...this.goals.values()],
      scenes: [...this.scenes.values()],
      events: this.events,
      recentEventIds: [...this.recentEventIds]
    };
  }

  private loadSnapshot() {
    const snapshot = this.kvStore?.get<OverlayStoreSnapshot>(STORE_KEY);
    if (!snapshot) {
      return;
    }

    this.overlays = new Map((snapshot.overlays ?? []).map((item) => [item.id, item]));
    this.tokens = new Map((snapshot.tokens ?? []).map((item) => [item.overlayId, item]));
    this.themes = new Map((snapshot.themes ?? []).map((item) => [item.id, item]));
    this.goals = new Map((snapshot.goals ?? []).map((item) => [item.overlayId, item]));
    this.scenes = new Map((snapshot.scenes ?? []).map((item) => [item.id, item]));
    this.events = snapshot.events ?? [];
    this.recentEventIds = new Set(snapshot.recentEventIds ?? this.events.map((event) => event.id));
    this.seedFromLocalConfig();
  }

  private persist() {
    this.kvStore?.set(STORE_KEY, this.snapshot());
  }
}
