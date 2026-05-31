import { OVERLAY_CONFIG } from "../config/overlay.config";
import { applyThemeVariables } from "../config/theme.config";
import { DEFAULT_WIDGET_CONFIG } from "../config/widgets.config";
import { EventQueue } from "../queue/EventQueue";
import { createOverlaySocket } from "../realtime/socket";
import { EventDeduper } from "../utils/eventDeduper";
import { ActivityFeedWidget } from "../widgets/activity-feed/ActivityFeedWidget";
import { AlertWidget } from "../widgets/alert/AlertWidget";
import { ChatWidget } from "../widgets/chat/ChatWidget";
import { GoalWidget } from "../widgets/goal/GoalWidget";
import { NowPlayingWidget } from "../widgets/now-playing/NowPlayingWidget";
import { TimerWidget } from "../widgets/timer/TimerWidget";
import { ViewerCountWidget } from "../widgets/viewer-count/ViewerCountWidget";
import { applyWidgetLayout } from "../widgets/widgetUtils";

const ALERT_TYPES = new Set(["subscriber", "superchat", "donation", "membership", "announcement", "test_alert"]);
const WIDGET_LAYOUT_IDS = {
  chatWidget: "chat-widget",
  goalWidget: "goal-widget",
  timerWidget: "timer-widget",
  viewerCountWidget: "viewer-count-widget",
  activityFeedWidget: "activity-feed-widget",
  nowPlayingWidget: "music-widget"
};

const fetchData = async (url, options) => {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed: ${response.status}`);
  }

  return payload.data ?? payload;
};

const parseRoute = () => {
  const url = new URL(window.location.href);
  const parts = url.pathname.split("/").filter(Boolean);
  const overlayIndex = parts.indexOf("overlay");
  const overlayId = parts[overlayIndex + 1] ?? OVERLAY_CONFIG.activeOverlayId;

  return {
    overlayId,
    requestedOverlayId: parts[overlayIndex + 1] ?? null,
    token: url.searchParams.get("token") ?? "",
    debug: url.searchParams.get("debug") === "true",
    scene: url.searchParams.get("scene") ?? "",
    layoutOverride: url.searchParams.get("layout")
  };
};

export class OverlayApp {
  constructor(root) {
    this.root = root;
    this.route = parseRoute();
    this.debug = {
      socket: "initializing",
      backend: "checking",
      overlayId: this.route.overlayId,
      layout: "not loaded",
      configSource: "boot",
      scene: this.route.scene || "active/default",
      lastEvent: "none",
      error: "none",
      queueLength: 0,
      theme: "Liquid Glass Pro",
      fps: 60
    };
    this.deduper = new EventDeduper();
    this.remoteThemes = [];
    this.localConfig = null;
    this.activeScene = null;
    this.config = null;
    this.layout = null;
    this.widgets = {};
    this.alertQueue = null;
  }

  async init() {
    document.body.classList.toggle("debug", this.route.debug);
    this.createShell();
    this.installWidgets();

    await this.loadInitialState();
    this.connectSocket();

    if (this.route.debug) {
      this.startFpsMonitor();
      this.renderDebug();
    }

    window.creatorOverlay = this;
  }

  createShell() {
    this.root.innerHTML = `
      <main class="overlay-stage theme-liquid-glass-pro" data-layout="horizontal">
        <section class="debug-panel" aria-label="Overlay debug panel">
          <div class="debug-row"><span>Socket</span><strong data-debug="socket">initializing</strong></div>
          <div class="debug-row"><span>Backend</span><strong data-debug="backend">checking</strong></div>
          <div class="debug-row"><span>Overlay ID</span><strong data-debug="overlayId">${this.route.overlayId}</strong></div>
          <div class="debug-row"><span>Layout</span><strong data-debug="layout">not loaded</strong></div>
          <div class="debug-row"><span>Config</span><strong data-debug="configSource">boot</strong></div>
          <div class="debug-row"><span>Scene</span><strong data-debug="scene">${this.route.scene || "active/default"}</strong></div>
          <div class="debug-row"><span>Last event</span><strong data-debug="lastEvent">none</strong></div>
          <div class="debug-row"><span>Error</span><strong data-debug="error">none</strong></div>
          <div class="debug-row"><span>Queue</span><strong data-debug="queueLength">0</strong></div>
          <div class="debug-row"><span>Theme</span><strong data-debug="theme">Liquid Glass Pro</strong></div>
          <div class="debug-row"><span>FPS</span><strong data-debug="fps">60</strong></div>
          <div class="debug-warning" data-debug="fpsWarning">Performance warning: FPS is below 45.</div>
        </section>
      </main>
    `;
    this.stage = this.root.querySelector(".overlay-stage");
  }

  installWidgets() {
    this.widgets.alertWidget = new AlertWidget(DEFAULT_WIDGET_CONFIG.alertWidget);
    this.widgets.chatWidget = new ChatWidget(DEFAULT_WIDGET_CONFIG.chatWidget);
    this.widgets.goalWidget = new GoalWidget(DEFAULT_WIDGET_CONFIG.goalWidget);
    this.widgets.timerWidget = new TimerWidget(DEFAULT_WIDGET_CONFIG.timerWidget);
    this.widgets.viewerCountWidget = new ViewerCountWidget(DEFAULT_WIDGET_CONFIG.viewerCountWidget);
    this.widgets.activityFeedWidget = new ActivityFeedWidget(DEFAULT_WIDGET_CONFIG.activityFeedWidget);
    this.widgets.nowPlayingWidget = new NowPlayingWidget(DEFAULT_WIDGET_CONFIG.nowPlayingWidget);

    Object.values(this.widgets).forEach((widget) => widget.render(this.stage));

    this.alertQueue = new EventQueue({
      alertWidget: this.widgets.alertWidget,
      maxLength: OVERLAY_CONFIG.defaultQueueMaxLength,
      durationMs: OVERLAY_CONFIG.defaultAlertDurationMs,
      onChange: (snapshot) => {
        this.debug.queueLength = snapshot.length;
        this.renderDebug();
      }
    });
  }

  async loadInitialState() {
    try {
      this.localConfig = await fetchData(`${OVERLAY_CONFIG.backendUrl}/api/v1/public-config`).catch(() => null);
      this.debug.backend = this.localConfig ? "reachable" : "local-config unavailable";
      const knownOverlay = this.localConfig?.overlays?.find((overlay) => overlay.id === this.route.overlayId);
      if (this.localConfig && this.route.requestedOverlayId && !knownOverlay) {
        this.debug.lastEvent = `Unknown overlay ${this.route.requestedOverlayId}; using ${this.localConfig.activeOverlayId}`;
        this.route.overlayId = this.localConfig.activeOverlayId ?? OVERLAY_CONFIG.activeOverlayId;
        this.debug.overlayId = this.route.overlayId;
      }

      const [themes, config, goal, layout, scene] = await Promise.all([
        this.localConfig?.themes?.length ? Promise.resolve(this.localConfig.themes) : fetchData(`${OVERLAY_CONFIG.backendUrl}/api/v1/themes`),
        fetchData(`${OVERLAY_CONFIG.backendUrl}/api/v1/overlays/${this.route.overlayId}/config`),
        fetchData(`${OVERLAY_CONFIG.backendUrl}/api/v1/goals/${this.route.overlayId}`),
        fetchData(`${OVERLAY_CONFIG.backendUrl}/api/v1/overlays/${this.route.overlayId}/layout`).catch(() => null),
        this.route.scene ? fetchData(`${OVERLAY_CONFIG.backendUrl}/api/v1/scenes/${this.route.scene}`).catch((error) => ({ error })) : null
      ]);

      this.remoteThemes = themes;
      this.debug.configSource = "backend";
      if (scene?.error) {
        this.debug.scene = `not found: ${this.route.scene}`;
      } else if (scene?.overlayId && scene.overlayId !== this.route.overlayId) {
        this.debug.scene = `ignored: ${scene.name}`;
      } else if (scene) {
        this.debug.scene = scene.name;
        this.activeScene = scene;
      }
      this.applyConfig(this.applySceneToConfig(config, this.activeScene));
      this.applyLayout(layout);
      this.widgets.goalWidget.update(goal);
      this.debug.socket = "http ready";
      this.debug.backend = "ready";
      this.debug.error = "none";
    } catch (error) {
      this.debug.socket = "backend unavailable";
      this.debug.backend = "unavailable";
      this.debug.configSource = "fallback";
      this.debug.error = error.message ?? "Initial overlay state failed";
      Object.values(this.widgets).forEach((widget) => widget.element?.classList.add("is-hidden"));
      console.warn("[Creator OS] Initial overlay state failed", error);
      this.renderDebug();
    }
  }

  connectSocket() {
    this.socket = createOverlaySocket({
      socketUrl: OVERLAY_CONFIG.socketUrl,
      overlayId: this.route.overlayId,
      token: this.route.token,
      handlers: {
        onStatus: (status) => {
          this.debug.socket = status.state;
          this.renderDebug();
        },
        onReady: () => {
          this.debug.socket = "connected";
          this.renderDebug();
        },
        onConfig: (config) => this.applyConfig(this.applySceneToConfig(config, this.activeScene)),
        onLayout: (layout) => this.applyLayout(layout),
        onGoal: (goal) => this.widgets.goalWidget.update(goal),
        onTimer: (timer) => this.widgets.timerWidget.update(timer),
        onEvent: (event) => this.handleEvent(event),
        onError: (error) => {
          this.debug.socket = error.message ?? "socket error";
          this.renderDebug();
        }
      }
    });
  }

  applyConfig(config = {}) {
    const widgets = Object.fromEntries(
      Object.entries(DEFAULT_WIDGET_CONFIG).map(([key, value]) => [key, { ...value, ...(config.widgets?.[key] ?? {}) }])
    );

    this.config = {
      themeId: config.themeId ?? "liquid-glass-pro",
      layout: this.route.layoutOverride || config.layout || OVERLAY_CONFIG.defaultLayout,
      alertDurationMs: config.alertDurationMs ?? OVERLAY_CONFIG.defaultAlertDurationMs,
      queueMaxLength: config.queueMaxLength ?? OVERLAY_CONFIG.defaultQueueMaxLength,
      widgets
    };

    const activeTheme = applyThemeVariables(this.stage, this.config.themeId, this.remoteThemes);
    this.debug.theme = activeTheme.name;
    this.stage.dataset.layout = this.config.layout;

    Object.entries(this.widgets).forEach(([key, widget]) => {
      widget.updateConfig?.(this.config.widgets[key]);
    });
    this.applyLayout(this.layout);

    this.alertQueue?.configure({
      durationMs: this.config.alertDurationMs,
      maxLength: this.config.queueMaxLength
    });

    this.renderDebug();
  }

  applySceneToConfig(config = {}, scene = null) {
    if (!scene || scene.error || (scene.overlayId && scene.overlayId !== this.route.overlayId)) {
      return config;
    }

    const widgets = Object.fromEntries(
      Object.entries(config.widgets ?? DEFAULT_WIDGET_CONFIG).map(([key, widgetConfig]) => [
        key,
        {
          ...widgetConfig,
          enabled: scene.widgetVisibility?.[key] ?? widgetConfig.enabled
        }
      ])
    );

    return {
      ...config,
      themeId: scene.themeId ?? config.themeId,
      layout: scene.layout ?? config.layout,
      widgets
    };
  }

  applyLayout(layout) {
    if (layout) {
      this.layout = layout;
      this.debug.layout = "loaded";
    } else if (!this.layout?.widgets?.length) {
      this.debug.layout = "fallback";
    }
    if (!this.layout?.widgets?.length) {
      this.renderDebug();
      return;
    }

    const byId = Object.fromEntries(this.layout.widgets.map((item) => [item.widgetId, item]));
    this.widgets.alertWidget?.updateLayouts?.(byId);
    Object.entries(WIDGET_LAYOUT_IDS).forEach(([widgetKey, widgetId]) => {
      const widget = this.widgets[widgetKey];
      const widgetLayout = byId[widgetId];
      if (widget?.element && widgetLayout) {
        applyWidgetLayout(widget.element, widgetLayout);
        widget.element.classList.toggle("is-hidden", widgetLayout.visible === false || this.config?.widgets?.[widgetKey]?.enabled === false);
      }
    });
    this.renderDebug();
  }

  handleEvent(event) {
    if (!this.deduper.remember(event.id)) {
      return;
    }

    this.debug.lastEvent = `${event.type} at ${new Date(event.timestamp).toLocaleTimeString()}`;
    this.renderDebug();

    if (event.type === "chat") {
      this.widgets.chatWidget.addMessage(event);
      this.widgets.activityFeedWidget.addEvent(event);
      return;
    }

    if (event.type === "viewer_count") {
      this.widgets.viewerCountWidget.update(event.count ?? event.meta?.viewerCount ?? event.amount ?? 0);
      return;
    }

    if (event.type === "goal_update") {
      this.widgets.goalWidget.update(event.meta?.goal);
      this.widgets.activityFeedWidget.addEvent(event);
      return;
    }

    if (event.type.startsWith("timer_")) {
      this.widgets.timerWidget.handleEvent(event);
      this.widgets.activityFeedWidget.addEvent(event);
      return;
    }

    if (ALERT_TYPES.has(event.type)) {
      this.widgets.activityFeedWidget.addEvent(event);
      this.alertQueue.enqueue(event);
    }
  }

  startFpsMonitor() {
    let frames = 0;
    let last = performance.now();

    const tick = (now) => {
      frames += 1;
      if (now - last >= 1000) {
        this.debug.fps = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
        this.renderDebug();
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  renderDebug() {
    if (!this.route.debug || !this.stage) {
      return;
    }

    Object.entries(this.debug).forEach(([key, value]) => {
      const node = this.stage.querySelector(`[data-debug="${key}"]`);
      if (node) {
        node.textContent = String(value);
      }
    });

    const warning = this.stage.querySelector('[data-debug="fpsWarning"]');
    warning?.classList.toggle("is-visible", this.debug.fps < 45);
  }
}
