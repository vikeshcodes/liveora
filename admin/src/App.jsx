import {
  Bell,
  Check,
  AlertTriangle,
  ExternalLink,
  Copy,
  Eye,
  Gauge,
  History,
  Keyboard,
  Layers,
  Megaphone,
  MessageSquare,
  MonitorPlay,
  Moon,
  Pause,
  Play,
  PlugZap,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  Timer,
  Trash2,
  Users,
  Wifi,
  Zap
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const SAME_ORIGIN_URL = window.location.origin;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? SAME_ORIGIN_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? BACKEND_URL;
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ?? SAME_ORIGIN_URL;

const WIDGET_LABELS = {
  alertWidget: "Alerts",
  chatWidget: "Chat",
  goalWidget: "Goal",
  timerWidget: "Timer",
  viewerCountWidget: "Viewer Count",
  activityFeedWidget: "Activity Feed",
  nowPlayingWidget: "Now Playing"
};

const LAYOUT_WIDGET_LABELS = {
  "alert-widget": "Subscriber Alert",
  "superchat-widget": "Super Chat Alert",
  "announcement-widget": "Announcement",
  "chat-widget": "Live Chat",
  "goal-widget": "Goal Progress",
  "timer-widget": "Timer",
  "viewer-count-widget": "Viewer Count",
  "activity-feed-widget": "Activity Feed",
  "music-widget": "Music / Now Playing"
};

const api = async (path, options = {}) => {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...Object.fromEntries(Object.entries(options).filter(([key]) => key !== "headers"))
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed: ${response.status}`);
  }

  return payload.data ?? payload;
};

const ActionButton = ({ icon: Icon, children, tone = "default", ...props }) => (
  <button className={`button button-${tone}`} type="button" {...props}>
    <Icon size={17} />
    <span>{children}</span>
  </button>
);

const Toggle = ({ checked, onChange }) => (
  <button
    className={`toggle ${checked ? "is-on" : ""}`}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
  >
    <span />
  </button>
);

const isConfiguredYouTubeChannelId = (value) =>
  Boolean(value && !value.includes("REPLACE_WITH") && !value.includes("YOUR_YOUTUBE_CHANNEL_ID") && value !== "UC_REPLACE_WITH_MY_CHANNEL_ID");

const setupTone = (state) => (state === "success" ? "success" : state === "warning" ? "warning" : "danger");

const writeClipboardText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export default function App() {
  const editorMatch = window.location.pathname.match(/^\/admin\/overlay-editor\/([^/]+)/);
  if (editorMatch) {
    return <OverlayEditor initialOverlayId={decodeURIComponent(editorMatch[1])} />;
  }

  const previewMatch = window.location.pathname.match(/^\/admin\/preview\/([^/]+)/);
  if (previewMatch) {
    return <OverlayPreview initialOverlayId={decodeURIComponent(previewMatch[1])} />;
  }

  if (window.location.pathname === "/setup") {
    return <SetupWizard />;
  }

  if (window.location.pathname === "/admin/settings") {
    return <SettingsPage />;
  }

  return <Dashboard />;
}

function Dashboard() {
  const [overlays, setOverlays] = useState([]);
  const [localConfig, setLocalConfig] = useState(null);
  const [themes, setThemes] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState("main-overlay");
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [config, setConfig] = useState(null);
  const [goal, setGoal] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [youtubeStatus, setYoutubeStatus] = useState(null);
  const [youtubeEvents, setYoutubeEvents] = useState([]);
  const [backendInfo, setBackendInfo] = useState(null);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [announcement, setAnnouncement] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const selectedOverlay = overlays.find((overlay) => overlay.id === selectedOverlayId) ?? overlays[0];
  const overlayScenes = scenes.filter((scene) => scene.overlayId === selectedOverlayId);
  const selectedScene = overlayScenes.find((scene) => scene.id === selectedSceneId) ?? overlayScenes.find((scene) => scene.active) ?? overlayScenes[0];
  const publicWidgetsById = useMemo(
    () => Object.fromEntries((localConfig?.widgets ?? []).map((widget) => [widget.id, widget])),
    [localConfig?.widgets]
  );
  const widgetLabelFor = (key) => publicWidgetsById[key]?.name ?? WIDGET_LABELS[key] ?? key;
  const showNotice = (tone, message) => {
    setNotice({ tone, message, timestamp: new Date().toISOString() });
    window.setTimeout(() => setNotice(null), 4200);
  };

  const overlayUrl = useMemo(() => {
    if (!selectedOverlay) {
      return "";
    }

    const url = new URL(`/overlay/${selectedOverlay.id}`, localConfig?.urls?.frontend ?? FRONTEND_URL);
    return url.toString();
  }, [localConfig?.urls?.frontend, selectedOverlay]);

  const previewUrl = useMemo(() => {
    if (!selectedOverlay) {
      return "";
    }

    const url = new URL(`/overlay/${selectedOverlay.id}`, localConfig?.urls?.frontend ?? FRONTEND_URL);
    if (selectedScene?.id) {
      url.searchParams.set("scene", selectedScene.id);
    }
    return url.toString();
  }, [localConfig?.urls?.frontend, selectedOverlay, selectedScene]);

  const filteredEvents = useMemo(
    () => (eventTypeFilter === "all" ? events : events.filter((event) => event.type === eventTypeFilter)),
    [eventTypeFilter, events]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [status, config] = await Promise.all([
          api("/api/v1/status"),
          api("/api/v1/public-config")
        ]);

        const overlayList = config.overlays ?? [];
        setOverlays(overlayList);
        setThemes(config.themes ?? []);
        setScenes(config.scenes ?? []);
        setLocalConfig(config);
        setBackendInfo(status);
        setBackendStatus(status.ok ? "online" : "degraded");
        setSelectedOverlayId(config.activeOverlayId ?? overlayList[0]?.id ?? "main-overlay");
        setSelectedSceneId((config.scenes ?? []).find((scene) => scene.overlayId === (config.activeOverlayId ?? overlayList[0]?.id) && scene.active)?.id ?? "");
      } catch (loadError) {
        setBackendStatus("offline");
        setError(loadError.message);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (!auth) {
      return;
    }

    if (auth === "success") {
      showNotice("success", "YouTube connected successfully.");
    } else if (auth === "failed") {
      showNotice("danger", params.get("message") || "YouTube authentication failed.");
    }
    window.history.replaceState(null, "", "/admin/youtube");
    window.setTimeout(() => {
      document.getElementById("youtube")?.scrollIntoView({ behavior: "smooth", block: "start" });
      void refreshYouTubeStatus();
    }, 100);
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { role: "admin" }
    });

    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("connect_error", () => setSocketStatus("error"));
    socket.on("system:status", (status) => {
      setBackendInfo((current) => ({ ...(current ?? {}), ...status }));
    });
    socket.on("system:error", (payload) => {
      setError(payload.message ?? "Backend system error");
      showNotice("danger", payload.message ?? "Backend system error");
    });
    socket.on("admin:event", (event) => {
      setEvents((current) => [event, ...current].slice(0, 25));
    });
    socket.on("events:cleared", (payload) => {
      if (payload.overlayId === selectedOverlayId) {
        setEvents([]);
      }
      showNotice("success", payload.message ?? "Event history cleared");
    });
    socket.on("youtube:status", (status) => {
      setYoutubeStatus(status);
    });
    socket.on("youtube:status:updated", (status) => {
      setYoutubeStatus(status);
    });
    socket.on("youtube:auth:updated", (payload) => {
      setYoutubeStatus((current) => (current ? { ...current, ...payload } : current));
      showNotice(payload.connected ? "success" : "warning", payload.message ?? "YouTube auth changed");
      void refreshYouTubeStatus(payload.overlayId ?? selectedOverlayId);
    });
    socket.on("youtube:error", (payload) => {
      setYoutubeStatus((current) => (current ? { ...current, lastError: payload.message } : current));
      showNotice("danger", payload.details ?? payload.message ?? "YouTube error");
    });
    socket.on("youtube:session:updated", (payload) => {
      showNotice(payload.session?.status === "no_active_broadcast" ? "warning" : "success", payload.message ?? "YouTube session updated");
      void refreshYouTubeStatus(payload.overlayId ?? selectedOverlayId);
    });
    socket.on("youtube:event", (payload) => {
      const event = payload.event ?? payload;
      setYoutubeEvents((current) => [event, ...current].slice(0, 8));
    });
    socket.on("config:updated", (payload) => {
      if (payload.overlayId === selectedOverlayId) {
        setConfig(payload.config);
      }
      showNotice("success", payload.message ?? "Config updated");
    });
    socket.on("theme:updated", (payload) => {
      if (payload.overlayId === selectedOverlayId) {
        setConfig(payload.config);
      }
      showNotice("success", payload.message ?? "Theme updated");
    });
    socket.on("widget:updated", (payload) => {
      showNotice("success", payload.message ?? "Widget updated");
    });
    socket.on("overlay:updated", () => {
      void api("/api/v1/public-config")
        .then((config) => {
          setLocalConfig(config);
          setOverlays(config.overlays ?? []);
          setThemes(config.themes ?? []);
        })
        .catch(() => undefined);
    });
    socket.on("overlay:layout:updated", (payload) => {
      showNotice("success", payload.message ?? "Overlay layout updated");
    });
    socket.on("scene:updated", (payload) => {
      showNotice("success", payload.message ?? "Scene updated");
      void refreshScenes(payload.scene?.overlayId ?? selectedOverlayId);
    });
    socket.on("scene:activated", (payload) => {
      if (payload.scene?.overlayId === selectedOverlayId) {
        setSelectedSceneId(payload.scene.id);
        setConfig(payload.config);
      }
      showNotice("success", payload.message ?? "Scene activated");
      void refreshScenes(payload.scene?.overlayId ?? selectedOverlayId);
    });

    return () => socket.disconnect();
  }, [selectedOverlayId]);

  useEffect(() => {
    if (!selectedOverlayId) {
      return;
    }

    const loadOverlayState = async () => {
      try {
        const [nextConfig, nextGoal, recentEvents, nextScenes] = await Promise.all([
          api(`/api/v1/overlays/${selectedOverlayId}/config`),
          api(`/api/v1/goals/${selectedOverlayId}`),
          api(`/api/v1/events/recent?overlayId=${selectedOverlayId}&limit=25`),
          api(`/api/v1/scenes?overlayId=${selectedOverlayId}`)
        ]);
        setConfig(nextConfig);
        setGoal(nextGoal);
        setEvents(recentEvents);
        setScenes((current) => [...current.filter((scene) => scene.overlayId !== selectedOverlayId), ...nextScenes]);
        setSelectedSceneId(nextScenes.find((scene) => scene.active)?.id ?? nextScenes[0]?.id ?? "");
        await refreshYouTubeStatus(selectedOverlayId);
        setError("");
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    void loadOverlayState();
  }, [selectedOverlayId]);

  const run = async (action) => {
    try {
      setError("");
      return await action();
    } catch (actionError) {
      setError(actionError.message);
      showNotice("danger", actionError.message);
      return null;
    }
  };

  const triggerTest = (type) =>
    run(() =>
      api("/api/v1/events/test", {
        method: "POST",
        body: JSON.stringify({ overlayId: selectedOverlayId, type })
      })
    );

  const refreshYouTubeStatus = async (overlayId = selectedOverlayId) =>
    run(async () => {
      const [status, recent] = await Promise.all([
        api(`/api/v1/youtube/status/${overlayId}`),
        api(`/api/v1/youtube/events/recent/${overlayId}?limit=8`)
      ]);
      setYoutubeStatus(status);
      setYoutubeEvents(recent);
      return status;
    });

  const refreshScenes = async (overlayId = selectedOverlayId) =>
    run(async () => {
      const nextScenes = await api(`/api/v1/scenes?overlayId=${overlayId}`);
      setScenes((current) => [...current.filter((scene) => scene.overlayId !== overlayId), ...nextScenes]);
      setSelectedSceneId((current) => current || nextScenes.find((scene) => scene.active)?.id || nextScenes[0]?.id || "");
      return nextScenes;
    });

  const activateScene = (sceneId) =>
    run(async () => {
      const scene = await api(`/api/v1/scenes/${sceneId}/activate`, { method: "POST" });
      setSelectedSceneId(scene.id);
      await refreshScenes(scene.overlayId);
      const nextConfig = await api(`/api/v1/overlays/${scene.overlayId}/config`);
      setConfig(nextConfig);
      showNotice("success", `Scene activated: ${scene.name}`);
    });

  const duplicateScene = (sceneId) =>
    run(async () => {
      const scene = await api(`/api/v1/scenes/${sceneId}/duplicate`, { method: "POST" });
      setSelectedSceneId(scene.id);
      await refreshScenes(scene.overlayId);
      showNotice("success", "Scene duplicated");
    });

  const createScene = () =>
    run(async () => {
      const scene = await api("/api/v1/scenes", {
        method: "POST",
        body: JSON.stringify({
          overlayId: selectedOverlayId,
          name: `Custom Scene ${overlayScenes.length + 1}`,
          description: "Local custom scene",
          themeId: config?.themeId ?? "liquid-glass-pro",
          layout: config?.layout ?? "horizontal"
        })
      });
      setSelectedSceneId(scene.id);
      await refreshScenes(scene.overlayId);
      showNotice("success", "Scene created");
    });

  const youtubePost = (path, body = {}) =>
    run(async () => {
      const result = await api(path, {
        method: "POST",
        body: JSON.stringify(body)
      });
      await refreshYouTubeStatus();
      return result;
    });

  const connectYouTube = (includeMembership = false) => {
    const url = new URL(`${BACKEND_URL}/api/v1/youtube/auth/start`);
    url.searchParams.set("overlayId", selectedOverlayId);
    if (includeMembership) {
      url.searchParams.set("includeMembership", "true");
    }
    window.location.href = url.toString();
  };

  const triggerChat = () =>
    run(() => {
      if (!chatMessage.trim()) {
        throw new Error("Enter a chat message before sending.");
      }
      return api("/api/v1/events/manual", {
        method: "POST",
        body: JSON.stringify({
          type: "chat",
          overlayId: selectedOverlayId,
          username: "Manual Admin",
          message: chatMessage.trim(),
          meta: { source: "admin" }
        })
      });
    });

  const triggerAnnouncement = () =>
    run(() => {
      if (!announcement.trim()) {
        throw new Error("Enter an announcement before sending.");
      }
      return api("/api/v1/events/manual", {
        method: "POST",
        body: JSON.stringify({
          type: "announcement",
          overlayId: selectedOverlayId,
          username: localConfig?.youtube?.channelHandle || localConfig?.projectName || "Creator OS Admin",
          message: announcement.trim(),
          meta: { source: "admin" }
        })
      });
    });

  const updateGoal = (patch) =>
    run(async () => {
      if (!patch) {
        return;
      }

      const nextGoal = await api(`/api/v1/goals/${selectedOverlayId}`, {
        method: "PUT",
        body: JSON.stringify({ ...(goal ?? {}), ...patch })
      });
      setGoal(nextGoal);
    });

  const updateTheme = (themeId) =>
    run(async () => {
      const nextConfig = await api(`/api/v1/overlays/${selectedOverlayId}/theme`, {
        method: "PUT",
        body: JSON.stringify({ themeId })
      });
      setConfig(nextConfig);
      showNotice("success", "Theme updated");
    });

  const updateWidget = (key, enabled) =>
    run(async () => {
      const nextConfig = {
        ...config,
        widgets: {
          ...config.widgets,
          [key]: {
            ...config.widgets[key],
            enabled
          }
        }
      };

      const saved = await api(`/api/v1/overlays/${selectedOverlayId}/config`, {
        method: "PUT",
        body: JSON.stringify(nextConfig)
      });
      setConfig(saved);
      showNotice("success", `${widgetLabelFor(key)} ${enabled ? "enabled" : "disabled"}`);
    });

  const timerAction = (action) =>
    run(() =>
      api(`/api/v1/timer/${selectedOverlayId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ durationSeconds: Number(timerMinutes) * 60 })
      })
    );

  const copyOverlayUrl = async () => {
    const copiedToClipboard = await writeClipboardText(overlayUrl);
    setCopied(copiedToClipboard);
    showNotice(copiedToClipboard ? "success" : "warning", copiedToClipboard ? "OBS URL copied" : "Clipboard blocked. Select the URL and copy it manually.");
    window.setTimeout(() => setCopied(false), 1400);
  };

  const copyText = async (text) => {
    const copiedToClipboard = await writeClipboardText(text);
    setCopied(copiedToClipboard);
    showNotice(copiedToClipboard ? "success" : "warning", copiedToClipboard ? "Copied to clipboard" : "Clipboard blocked. Select and copy it manually.");
    window.setTimeout(() => setCopied(false), 1400);
  };

  const clearEventHistory = () =>
    run(async () => {
      await api(`/api/v1/events/clear/${selectedOverlayId}`, { method: "DELETE" });
      setEvents([]);
      showNotice("success", "Event history cleared");
    });

  const urlForOverlay = (overlayId) => new URL(`/overlay/${overlayId}`, localConfig?.urls?.frontend ?? FRONTEND_URL).toString();
  const urlForScene = (scene) => {
    const url = new URL(`/overlay/${scene.overlayId}`, localConfig?.urls?.frontend ?? FRONTEND_URL);
    url.searchParams.set("scene", scene.id);
    return url.toString();
  };
  const debugOverlayUrl = overlayUrl ? `${overlayUrl}${overlayUrl.includes("?") ? "&" : "?"}debug=true` : "";
  const oauthOrigins = [localConfig?.urls?.frontend, localConfig?.urls?.admin, localConfig?.urls?.backend].filter(Boolean).join("\n");
  const oauthRedirectUri = `${localConfig?.urls?.backend ?? BACKEND_URL}/api/v1/youtube/auth/callback`;
  const setupItems = [
    {
      label: "Backend running",
      state: backendStatus === "online" ? "success" : backendStatus === "checking" ? "warning" : "error",
      detail: backendStatus === "online" ? "Backend API is responding." : "Start the backend with npm run dev:local."
    },
    {
      label: "Database connected",
      state: backendInfo?.databaseConnected ? "success" : "warning",
      detail: backendInfo?.databaseConnected ? "PostgreSQL is reachable." : "Start Docker/PostgreSQL on port 5180."
    },
    {
      label: "Config file found",
      state: localConfig ? "success" : "error",
      detail: localConfig ? "creator-os.config.json is loaded." : "Run npm run setup."
    },
    {
      label: "YouTube channel ID configured",
      state: localConfig?.youtube?.configured || isConfiguredYouTubeChannelId(localConfig?.youtube?.channelId) ? "success" : "warning",
      detail:
        localConfig?.youtube?.configured || isConfiguredYouTubeChannelId(localConfig?.youtube?.channelId)
          ? `${localConfig.youtube.channelId} (${localConfig.youtube.configSource ?? "config"})`
          : "Add youtube.channelId in creator-os.config.json."
    },
    {
      label: "Google OAuth credentials added",
      state: (youtubeStatus?.warnings ?? []).some((warning) => warning.includes("Google OAuth credentials are missing")) ? "warning" : "success",
      detail: (youtubeStatus?.warnings ?? []).some((warning) => warning.includes("Google OAuth credentials are missing"))
        ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.local."
        : "Backend has OAuth credentials configured."
    },
    {
      label: "YouTube authenticated",
      state: youtubeStatus?.connected ? "success" : "warning",
      detail: youtubeStatus?.connected ? `Connected to ${youtubeStatus.channelTitle ?? "YouTube"}.` : "Click Connect YouTube."
    },
    {
      label: "Active overlay selected",
      state: selectedOverlay ? "success" : "error",
      detail: selectedOverlay ? selectedOverlay.name : "Choose an overlay."
    },
    {
      label: "OBS URL ready",
      state: overlayUrl ? "success" : "error",
      detail: overlayUrl || "Overlay URL unavailable."
    }
  ];

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>{localConfig?.appName ?? "LiveOra"}</strong>
            <span>by Vikesh Codes</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <a className="is-active" href="#control">
            <Radio size={17} />
            Control Room
          </a>
          <a href="#widgets">
            <Settings size={17} />
            Widgets
          </a>
          <a href="#preview">
            <Eye size={17} />
            Preview
          </a>
          <a href="#scenes">
            <Layers size={17} />
            Scenes
          </a>
          <a href={`/admin/preview/${selectedOverlayId}`}>
            <MonitorPlay size={17} />
            Live Preview
          </a>
          <a href={`/admin/overlay-editor/${selectedOverlayId}`}>
            <Settings size={17} />
            Overlay Editor
          </a>
          <a href="#youtube">
            <PlugZap size={17} />
            YouTube
          </a>
          <a href="/admin/settings">
            <Settings size={17} />
            Settings
          </a>
        </nav>

        <div className="status-stack">
          <div className="status-pill">
            <Wifi size={15} />
            <span>API {backendStatus}</span>
          </div>
          <div className="status-pill">
            <Zap size={15} />
            <span>Socket {socketStatus}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Premium OBS browser-source system</p>
            <h1>{localConfig?.appName ?? localConfig?.projectName ?? "LiveOra by Vikesh Codes"}</h1>
          </div>

          <label className="select-field">
            <span>Overlay</span>
            <select value={selectedOverlayId} onChange={(event) => setSelectedOverlayId(event.target.value)}>
              {overlays.map((overlay) => (
                <option key={overlay.id} value={overlay.id}>
                  {overlay.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {notice ? <div className={`notice-banner notice-${notice.tone}`}>{notice.message}</div> : null}

        <section className="panel panel-wide setup-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">First Run</span>
              <h2>Setup Checklist</h2>
            </div>
            <ActionButton icon={RefreshCw} onClick={() => window.location.reload()} tone="ghost">
              Recheck
            </ActionButton>
          </div>
          <div className="setup-grid">
            {setupItems.map((item) => (
              <div className={`setup-item setup-${setupTone(item.state)}`} key={item.label}>
                {item.state === "success" ? <Check size={18} /> : <AlertTriangle size={18} />}
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="button-grid setup-actions">
            <ActionButton icon={Copy} onClick={copyOverlayUrl} tone="ghost">
              Copy OBS URL
            </ActionButton>
            <ActionButton icon={Copy} onClick={() => copyText(oauthRedirectUri)} tone="ghost">
              Copy Redirect URI
            </ActionButton>
            <ActionButton icon={Copy} onClick={() => copyText(oauthOrigins)} tone="ghost">
              Copy OAuth Origins
            </ActionButton>
            <ActionButton icon={ExternalLink} onClick={() => window.open(overlayUrl, "_blank", "noopener")} tone="ghost">
              Open Overlay
            </ActionButton>
            <ActionButton icon={Eye} onClick={() => window.open(debugOverlayUrl, "_blank", "noopener")} tone="ghost">
              Open Debug Overlay
            </ActionButton>
            <ActionButton icon={MonitorPlay} onClick={() => (window.location.href = `/admin/preview/${selectedOverlayId}`)} tone="ghost">
              Open Live Preview
            </ActionButton>
            <ActionButton icon={Settings} onClick={() => (window.location.href = `/admin/overlay-editor/${selectedOverlayId}`)} tone="ghost">
              Open Editor
            </ActionButton>
            <ActionButton icon={PlugZap} onClick={() => connectYouTube(false)} tone="success">
              Connect YouTube
            </ActionButton>
            <ActionButton icon={Bell} onClick={() => triggerTest("subscriber")} tone="warm">
              Test Alert
            </ActionButton>
            <ActionButton icon={MessageSquare} onClick={() => youtubePost("/api/v1/youtube/test/chat", { overlayId: selectedOverlayId })} tone="ghost">
              Test Chat
            </ActionButton>
            <ActionButton icon={Gauge} onClick={() => youtubePost("/api/v1/youtube/test/superchat", { overlayId: selectedOverlayId })} tone="warm">
              Test Super Chat
            </ActionButton>
            <ActionButton icon={Users} onClick={() => youtubePost("/api/v1/youtube/test/viewer-count", { overlayId: selectedOverlayId })} tone="success">
              Test Viewer Count
            </ActionButton>
          </div>
        </section>

        <div className="grid-main" id="control">
          <section className="panel panel-wide">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">OBS Source</span>
                <h2>Browser URL</h2>
              </div>
              <ActionButton icon={copied ? Check : Copy} onClick={copyOverlayUrl} tone="ghost">
                {copied ? "Copied" : "Copy"}
              </ActionButton>
            </div>
            <code className="url-box">{overlayUrl}</code>
          </section>

          <section className="panel panel-wide local-config-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Local Setup</span>
                <h2>Runner Config</h2>
              </div>
            </div>
            <div className="youtube-status-grid">
              <StatusCard label="Active Overlay" value={localConfig?.activeOverlayId ?? selectedOverlayId} />
              <StatusCard label="YouTube Channel" value={localConfig?.youtube?.channelHandle || "Not set"} />
              <StatusCard label="Channel ID" value={localConfig?.youtube?.channelId ?? "Not set"} />
              <StatusCard label="Channel Config" value={localConfig?.youtube?.configSource ?? "unknown"} />
              <StatusCard label="Frontend Port" value={String(localConfig?.ports?.frontend ?? "5150")} />
              <StatusCard label="Admin Port" value={String(localConfig?.ports?.admin ?? "5160")} />
              <StatusCard label="Backend Port" value={String(localConfig?.ports?.backend ?? "5170")} />
              <StatusCard label="Database Port" value={String(localConfig?.ports?.database ?? "5180")} />
              <StatusCard label="Backend" value={backendStatus} />
            </div>
            <div className="overlay-url-list">
              {(localConfig?.overlays ?? overlays).map((overlay) => (
                <div className="overlay-url-row" key={overlay.id}>
                  <div>
                    <strong>{overlay.name}</strong>
                    <span>{urlForOverlay(overlay.id)}</span>
                  </div>
                  <ActionButton icon={Copy} onClick={() => copyText(urlForOverlay(overlay.id))} tone="ghost">
                    Copy OBS URL
                  </ActionButton>
                </div>
              ))}
            </div>
            <p className="muted">
              In Docker mode you can change this in Settings. In dev mode, edit creator-os.config.json and rerun node start-local.mjs.
            </p>
          </section>

          <section className="panel panel-wide scenes-panel" id="scenes">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Profiles</span>
                <h2>Scenes</h2>
              </div>
              <ActionButton icon={Layers} onClick={createScene} tone="ghost">
                New Scene
              </ActionButton>
            </div>
            <div className="scene-grid">
              {overlayScenes.length ? (
                overlayScenes.map((scene) => (
                  <button
                    className={`scene-card ${selectedScene?.id === scene.id ? "is-selected" : ""}`}
                    key={scene.id}
                    type="button"
                    onClick={() => setSelectedSceneId(scene.id)}
                  >
                    <strong>{scene.name}</strong>
                    <span>{scene.description || "Local scene profile"}</span>
                    <small>{scene.themeId} · {scene.layout} {scene.active ? "· active" : ""}</small>
                  </button>
                ))
              ) : (
                <p className="muted">No scenes for this overlay yet. Create one to save a stream profile.</p>
              )}
            </div>
            {selectedScene ? (
              <div className="scene-actions">
                <ActionButton icon={Play} onClick={() => activateScene(selectedScene.id)} tone="success">
                  Activate Scene
                </ActionButton>
                <ActionButton icon={Copy} onClick={() => copyText(urlForScene(selectedScene))} tone="ghost">
                  Copy Scene OBS URL
                </ActionButton>
                <ActionButton icon={MonitorPlay} onClick={() => (window.location.href = `/admin/preview/${selectedOverlayId}`)} tone="ghost">
                  Preview Scene
                </ActionButton>
                <ActionButton icon={Copy} onClick={() => duplicateScene(selectedScene.id)} tone="warm">
                  Duplicate
                </ActionButton>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Events</span>
                <h2>Test Alerts</h2>
              </div>
            </div>
            <div className="button-grid">
              <ActionButton icon={Bell} onClick={() => triggerTest("subscriber")}>
                Subscriber
              </ActionButton>
              <ActionButton icon={Gauge} onClick={() => triggerTest("superchat")} tone="warm">
                Superchat
              </ActionButton>
              <ActionButton icon={Users} onClick={() => triggerTest("donation")} tone="success">
                Donation
              </ActionButton>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Live</span>
                <h2>Manual Messages</h2>
              </div>
            </div>
            <label className="field">
              <span>Chat Message</span>
              <input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Type a manual chat message" />
            </label>
            <ActionButton icon={MessageSquare} onClick={triggerChat} tone="ghost">
              Send Chat
            </ActionButton>
            <label className="field">
              <span>Announcement</span>
              <input value={announcement} onChange={(event) => setAnnouncement(event.target.value)} placeholder="Type an announcement" />
            </label>
            <ActionButton icon={Megaphone} onClick={triggerAnnouncement}>
              Announce
            </ActionButton>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Goal</span>
                <h2>Progress</h2>
              </div>
            </div>
            <label className="field">
              <span>Title</span>
              <input value={goal?.title ?? ""} onChange={(event) => setGoal({ ...(goal ?? {}), title: event.target.value })} />
            </label>
            <div className="split-fields">
              <label className="field">
                <span>Current</span>
                <input
                  type="number"
                  value={goal?.currentValue ?? 0}
                  onChange={(event) => setGoal({ ...(goal ?? {}), currentValue: Number(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Target</span>
                <input
                  type="number"
                  value={goal?.targetValue ?? 1}
                  onChange={(event) => setGoal({ ...(goal ?? {}), targetValue: Number(event.target.value) })}
                />
              </label>
            </div>
            <ActionButton icon={RefreshCw} onClick={() => updateGoal(goal)} tone="success">
              Update Goal
            </ActionButton>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Timer</span>
                <h2>Focus Control</h2>
              </div>
              <Timer size={20} />
            </div>
            <label className="field">
              <span>Minutes</span>
              <input type="number" min="1" value={timerMinutes} onChange={(event) => setTimerMinutes(event.target.value)} />
            </label>
            <div className="button-grid">
              <ActionButton icon={Play} onClick={() => timerAction("start")} tone="success">
                Start
              </ActionButton>
              <ActionButton icon={Pause} onClick={() => timerAction("pause")} tone="ghost">
                Pause
              </ActionButton>
              <ActionButton icon={RotateCcw} onClick={() => timerAction("reset")} tone="warm">
                Reset
              </ActionButton>
            </div>
          </section>

          <section className="panel" id="widgets">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Theme</span>
                <h2>Visual System</h2>
              </div>
              <Moon size={20} />
            </div>
            <label className="select-field full">
              <span>Theme</span>
              <select value={config?.themeId ?? "liquid-glass-pro"} onChange={(event) => updateTheme(event.target.value)}>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="widget-toggles">
              {Object.entries(config?.widgets ?? {}).map(([key, value]) => (
                <div className="toggle-row" key={key}>
                  <span>{widgetLabelFor(key)}</span>
                  <Toggle checked={value.enabled} onChange={(enabled) => updateWidget(key, enabled)} />
                </div>
              ))}
            </div>
          </section>

          <section className="panel panel-wide" id="preview">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Layout</span>
                <h2>Live Preview</h2>
              </div>
              <ActionButton icon={ExternalLink} onClick={() => window.open(previewUrl, "_blank", "noopener")} tone="ghost">
                Open
              </ActionButton>
            </div>
            <div className="preview-stage preview-iframe-wrap">
              {previewUrl ? <iframe title="Overlay preview" src={`${previewUrl}${previewUrl.includes("?") ? "&" : "?"}debug=true`} /> : null}
            </div>
          </section>

          <section className="panel panel-wide youtube-panel" id="youtube">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Official API</span>
                <h2>YouTube Integration</h2>
              </div>
              <ActionButton icon={RefreshCw} onClick={() => refreshYouTubeStatus()} tone="ghost">
                Refresh
              </ActionButton>
            </div>

            <div className="warning-stack">
              <p>Subscriber alerts are best-effort due to YouTube privacy limitations.</p>
              <p>Membership alerts require channel eligibility and correct OAuth scope.</p>
              <p>Live chat needs an active livestream with live chat enabled.</p>
              {(youtubeStatus?.warnings ?? [])
                .filter(
                  (warning) =>
                    !warning.startsWith("Subscriber alerts") &&
                    !warning.startsWith("Membership alerts") &&
                    !warning.startsWith("Live chat needs")
                )
                .map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
            </div>

            <div className="youtube-status-grid">
              <StatusCard label="Connection" value={youtubeStatus?.connected ? "Connected" : "Not connected"} />
              <StatusCard label="Channel" value={youtubeStatus?.channelTitle ?? "None"} />
              <StatusCard label="Channel ID" value={youtubeStatus?.channelId ?? "Not available"} />
              <StatusCard label="Channel Handle" value={youtubeStatus?.channelHandle ?? localConfig?.youtube?.channelHandle ?? "Not available"} />
              <StatusCard label="OAuth Scope" value={youtubeStatus?.scope ?? "Hidden"} />
              <StatusCard label="Integration" value={youtubeStatus?.state ?? "stopped"} />
              <StatusCard label="Broadcast" value={youtubeStatus?.liveSession?.status ?? "No active session"} />
              <StatusCard label="Video ID" value={youtubeStatus?.liveSession?.videoId ?? "Not available"} />
              <StatusCard label="Live Chat ID" value={youtubeStatus?.liveSession?.liveChatId ?? "Not available"} />
              <StatusCard label="Quota" value={`${youtubeStatus?.quota?.totalApproxUnits ?? 0} approx units`} />
              <StatusCard label="Last Event" value={youtubeStatus?.lastEvent?.type ?? "None"} />
              <StatusCard label="Last Error" value={youtubeStatus?.lastError ?? "None"} tone={youtubeStatus?.lastError ? "danger" : ""} />
            </div>

            <div className="button-grid youtube-actions">
              <ActionButton icon={PlugZap} onClick={() => connectYouTube(false)}>
                Connect YouTube
              </ActionButton>
              <ActionButton icon={PlugZap} onClick={() => connectYouTube(true)} tone="warm">
                Connect + Members
              </ActionButton>
              <ActionButton
                icon={RotateCcw}
                onClick={() => youtubePost("/api/v1/youtube/auth/disconnect", { overlayId: selectedOverlayId })}
                tone="ghost"
              >
                Disconnect
              </ActionButton>
              <ActionButton icon={Play} onClick={() => youtubePost(`/api/v1/youtube/start/${selectedOverlayId}`)} tone="success">
                Start Integration
              </ActionButton>
              <ActionButton icon={Pause} onClick={() => youtubePost(`/api/v1/youtube/stop/${selectedOverlayId}`)} tone="ghost">
                Stop Integration
              </ActionButton>
              <ActionButton icon={RefreshCw} onClick={() => youtubePost(`/api/v1/youtube/restart/${selectedOverlayId}`)} tone="warm">
                Restart Integration
              </ActionButton>
              <ActionButton icon={Radio} onClick={() => youtubePost(`/api/v1/youtube/refresh-session/${selectedOverlayId}`)} tone="ghost">
                Refresh Live Session
              </ActionButton>
            </div>

            <div className="oauth-help">
              <strong>Google OAuth settings</strong>
              <span>Authorized JavaScript origins</span>
              <code>{oauthOrigins}</code>
              <span>Authorized redirect URI</span>
              <code>{oauthRedirectUri}</code>
            </div>

            <div className="poller-grid">
              {Object.values(youtubeStatus?.pollers ?? {}).map((poller) => (
                <div className="poller-card" key={poller.name}>
                  <strong>{poller.name.replace("_", " ")}</strong>
                  <span>{poller.status}</span>
                  <small>{poller.errorMessage ?? poller.lastPolledAt ?? "Waiting"}</small>
                </div>
              ))}
            </div>

            <div className="button-grid youtube-actions">
              <ActionButton
                icon={MessageSquare}
                onClick={() => youtubePost("/api/v1/youtube/test/chat", { overlayId: selectedOverlayId })}
                tone="ghost"
              >
                Send Test Chat
              </ActionButton>
              <ActionButton
                icon={Gauge}
                onClick={() => youtubePost("/api/v1/youtube/test/superchat", { overlayId: selectedOverlayId })}
                tone="warm"
              >
                Send Test Super Chat
              </ActionButton>
              <ActionButton
                icon={Users}
                onClick={() => youtubePost("/api/v1/youtube/test/viewer-count", { overlayId: selectedOverlayId })}
                tone="success"
              >
                Send Test Viewer Count
              </ActionButton>
              <ActionButton
                icon={Bell}
                onClick={() => youtubePost("/api/v1/youtube/test/subscriber", { overlayId: selectedOverlayId })}
              >
                Send Test Subscriber
              </ActionButton>
              <ActionButton
                icon={Sparkles}
                onClick={() => youtubePost("/api/v1/youtube/test/membership", { overlayId: selectedOverlayId })}
              >
                Send Test Membership
              </ActionButton>
            </div>

            <div className="event-list">
              {(youtubeEvents.length ? youtubeEvents : youtubeStatus?.lastEvent ? [youtubeStatus.lastEvent] : []).map((event) => (
                <div className="event-row" key={event.id}>
                  <strong>{event.type}</strong>
                  <span>{event.username ?? event.message ?? event.id}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Recent</span>
                <h2>Event History</h2>
              </div>
              <ActionButton icon={Trash2} onClick={clearEventHistory} tone="ghost">
                Clear
              </ActionButton>
            </div>
            <label className="select-field full">
              <span>Filter</span>
              <select value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value)}>
                <option value="all">All events</option>
                {[...new Set(events.map((event) => event.type))].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <div className="event-list">
              {filteredEvents.length ? (
                filteredEvents.map((event) => (
                  <div className="event-row" key={event.id}>
                    <strong>{event.type}</strong>
                    <span>{event.username ?? event.message ?? "System"} · {new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))
              ) : (
                <p className="muted">No events yet.</p>
              )}
            </div>
          </section>
        </div>

        <footer className="admin-footer">
          LiveOra by Vikesh Codes — Open-source project by VikeshCodes
        </footer>
      </section>
    </main>
  );
}

const StatusCard = ({ label, value, tone = "" }) => (
  <div className={`status-card ${tone ? `status-card-${tone}` : ""}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const SetupWizard = () => {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    appName: "LiveOra by Vikesh Codes",
    appBaseUrl: window.location.origin,
    activeOverlayId: "main-overlay",
    youtube: {
      channelId: "",
      channelHandle: "",
      googleClientId: "",
      googleClientSecret: ""
    }
  });
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/v1/public-config")
      .then((config) => {
        setSettings(config);
        setForm((current) => ({
          ...current,
          appName: config.appName ?? config.projectName ?? current.appName,
          appBaseUrl: config.urls?.backend ?? current.appBaseUrl,
          activeOverlayId: config.activeOverlayId ?? current.activeOverlayId,
          youtube: {
            ...current.youtube,
            channelId: config.youtube?.channelId ?? "",
            channelHandle: config.youtube?.channelHandle ?? "",
            googleClientId: config.youtube?.googleClientIdMasked ? "" : ""
          }
        }));
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const updateYoutube = (key, value) => {
    setForm((current) => ({ ...current, youtube: { ...current.youtube, [key]: value } }));
  };

  const finishSetup = async () => {
    try {
      const payload = {
        ...form,
        youtube: {
          ...form.youtube,
          googleClientSecret: form.youtube.googleClientSecret.trim() || undefined
        }
      };
      await api("/api/v1/setup", { method: "POST", body: JSON.stringify(payload) });
      setNotice({ tone: "success", message: "Setup saved. Opening admin dashboard..." });
      window.setTimeout(() => {
        window.location.href = "/admin";
      }, 900);
    } catch (setupError) {
      setError(setupError.message);
      setNotice({ tone: "danger", message: setupError.message });
    }
  };

  const origins = [window.location.origin].join("\n");
  const redirectUri = `${form.appBaseUrl.replace(/\/$/, "")}/api/v1/youtube/auth/callback`;

  return (
    <main className="setup-wizard-shell">
      <section className="panel setup-wizard-card">
        <div className="brand setup-brand">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <strong>LiveOra</strong>
            <span>by Vikesh Codes</span>
          </div>
        </div>
        <p className="eyebrow">Docker-first local OBS setup</p>
        <h1>Set Up Your Creator Overlay</h1>
        <p className="muted">Configure the essentials once. Your values are saved server-side in the Docker data volume.</p>

        {error ? <div className="error-banner">{error}</div> : null}
        {notice ? <div className={`notice-banner notice-${notice.tone}`}>{notice.message}</div> : null}

        <div className="settings-grid">
          <label className="field">
            <span>App name</span>
            <input value={form.appName} onChange={(event) => setForm({ ...form, appName: event.target.value })} />
          </label>
          <label className="field">
            <span>App URL</span>
            <input value={form.appBaseUrl} onChange={(event) => setForm({ ...form, appBaseUrl: event.target.value })} />
          </label>
          <label className="select-field full">
            <span>Active overlay</span>
            <select value={form.activeOverlayId} onChange={(event) => setForm({ ...form, activeOverlayId: event.target.value })}>
              {(settings?.overlays ?? []).map((overlay) => (
                <option key={overlay.id} value={overlay.id}>
                  {overlay.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>YouTube channel ID</span>
            <input value={form.youtube.channelId} onChange={(event) => updateYoutube("channelId", event.target.value)} placeholder="UC..." />
          </label>
          <label className="field">
            <span>YouTube handle</span>
            <input value={form.youtube.channelHandle} onChange={(event) => updateYoutube("channelHandle", event.target.value)} placeholder="@YourChannel" />
          </label>
          <label className="field">
            <span>Google client ID</span>
            <input value={form.youtube.googleClientId} onChange={(event) => updateYoutube("googleClientId", event.target.value)} placeholder="Optional now" />
          </label>
          <label className="field">
            <span>Google client secret</span>
            <input
              type="password"
              value={form.youtube.googleClientSecret}
              onChange={(event) => updateYoutube("googleClientSecret", event.target.value)}
              placeholder="Optional now"
            />
          </label>
        </div>

        <div className="oauth-help">
          <strong>Google OAuth settings</strong>
          <span>Authorized JavaScript origin</span>
          <code>{origins}</code>
          <span>Authorized redirect URI</span>
          <code>{redirectUri}</code>
        </div>

        <div className="button-grid setup-actions">
          <ActionButton icon={Check} onClick={finishSetup} tone="success">
            Finish Setup
          </ActionButton>
          <ActionButton icon={ExternalLink} onClick={() => window.open(`/overlay/${form.activeOverlayId}`, "_blank", "noopener")} tone="ghost">
            Open Overlay
          </ActionButton>
        </div>
      </section>
    </main>
  );
};

const SettingsPage = () => {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/v1/settings")
      .then((payload) => {
        setConfig(payload);
        setForm({
          appName: payload.appName ?? payload.projectName ?? "LiveOra by Vikesh Codes",
          appBaseUrl: payload.urls?.backend ?? window.location.origin,
          activeOverlayId: payload.activeOverlayId ?? "main-overlay",
          youtube: {
            channelId: payload.youtube?.channelId ?? "",
            channelHandle: payload.youtube?.channelHandle ?? "",
            googleClientId: "",
            googleClientSecret: "",
            useChatStream: Boolean(payload.youtube?.useChatStream),
            chatPollingEnabled: Boolean(payload.youtube?.chatPollingEnabled),
            superchatPollingEnabled: Boolean(payload.youtube?.superchatPollingEnabled),
            viewerCountPollingEnabled: Boolean(payload.youtube?.viewerCountPollingEnabled),
            subscriberPollingEnabled: Boolean(payload.youtube?.subscriberPollingEnabled),
            memberPollingEnabled: Boolean(payload.youtube?.memberPollingEnabled)
          }
        });
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const updateYoutube = (key, value) => {
    setForm((current) => ({ ...current, youtube: { ...current.youtube, [key]: value } }));
  };

  const saveSettings = async () => {
    try {
      const payload = {
        ...form,
        youtube: {
          ...form.youtube,
          googleClientId: form.youtube.googleClientId.trim() || undefined,
          googleClientSecret: form.youtube.googleClientSecret.trim() || undefined
        }
      };
      const saved = await api("/api/v1/settings", { method: "PUT", body: JSON.stringify(payload) });
      setConfig(saved);
      setNotice({ tone: "success", message: "Settings saved" });
      window.setTimeout(() => setNotice(null), 3600);
    } catch (saveError) {
      setError(saveError.message);
      setNotice({ tone: "danger", message: saveError.message });
    }
  };

  if (!form) {
    return (
      <main className="admin-shell single-page-shell">
        <section className="panel">
          <h1>Loading settings...</h1>
          {error ? <div className="error-banner">{error}</div> : null}
        </section>
      </main>
    );
  }

  const redirectUri = `${form.appBaseUrl.replace(/\/$/, "")}/api/v1/youtube/auth/callback`;

  return (
    <main className="admin-shell single-page-shell">
      <section className="panel panel-wide settings-page-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Self-hosted Settings</span>
            <h1>LiveOra Settings</h1>
          </div>
          <a className="back-link" href="/admin">
            Back to control room
          </a>
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
        {notice ? <div className={`notice-banner notice-${notice.tone}`}>{notice.message}</div> : null}

        <div className="settings-grid">
          <label className="field">
            <span>App name</span>
            <input value={form.appName} onChange={(event) => setForm({ ...form, appName: event.target.value })} />
          </label>
          <label className="field">
            <span>App base URL</span>
            <input value={form.appBaseUrl} onChange={(event) => setForm({ ...form, appBaseUrl: event.target.value })} />
          </label>
          <label className="select-field full">
            <span>Active overlay</span>
            <select value={form.activeOverlayId} onChange={(event) => setForm({ ...form, activeOverlayId: event.target.value })}>
              {(config?.overlays ?? []).map((overlay) => (
                <option key={overlay.id} value={overlay.id}>
                  {overlay.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>YouTube channel ID</span>
            <input value={form.youtube.channelId} onChange={(event) => updateYoutube("channelId", event.target.value)} />
          </label>
          <label className="field">
            <span>YouTube handle</span>
            <input value={form.youtube.channelHandle} onChange={(event) => updateYoutube("channelHandle", event.target.value)} />
          </label>
          <label className="field">
            <span>Google client ID</span>
            <input
              value={form.youtube.googleClientId}
              onChange={(event) => updateYoutube("googleClientId", event.target.value)}
              placeholder={config?.youtube?.googleClientIdConfigured ? config.youtube.googleClientIdMasked : "Not configured"}
            />
          </label>
          <label className="field">
            <span>Google client secret</span>
            <input
              type="password"
              value={form.youtube.googleClientSecret}
              onChange={(event) => updateYoutube("googleClientSecret", event.target.value)}
              placeholder={config?.youtube?.googleClientSecretConfigured ? config.youtube.googleClientSecretMasked : "Not configured"}
            />
          </label>
        </div>

        <div className="widget-toggles settings-toggle-list">
          {[
            ["useChatStream", "Use chat stream when available"],
            ["chatPollingEnabled", "Chat polling"],
            ["superchatPollingEnabled", "Super Chat polling"],
            ["viewerCountPollingEnabled", "Viewer count polling"],
            ["subscriberPollingEnabled", "Subscriber polling (best effort)"],
            ["memberPollingEnabled", "Membership polling"]
          ].map(([key, label]) => (
            <div className="toggle-row" key={key}>
              <span>{label}</span>
              <Toggle checked={Boolean(form.youtube[key])} onChange={(value) => updateYoutube(key, value)} />
            </div>
          ))}
        </div>

        <div className="oauth-help">
          <strong>Google OAuth settings</strong>
          <span>Authorized JavaScript origin</span>
          <code>{form.appBaseUrl}</code>
          <span>Authorized redirect URI</span>
          <code>{redirectUri}</code>
        </div>

        <div className="button-grid setup-actions">
          <ActionButton icon={Check} onClick={saveSettings} tone="success">
            Save Settings
          </ActionButton>
          <ActionButton icon={PlugZap} onClick={() => (window.location.href = `${BACKEND_URL}/api/v1/youtube/auth/start?overlayId=${form.activeOverlayId}`)} tone="ghost">
            Connect YouTube
          </ActionButton>
        </div>
      </section>
    </main>
  );
};

const OverlayPreview = ({ initialOverlayId }) => {
  const [localConfig, setLocalConfig] = useState(null);
  const [overlays, setOverlays] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState(initialOverlayId || "main-overlay");
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [lastEvent, setLastEvent] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const selectedOverlay = overlays.find((overlay) => overlay.id === selectedOverlayId);
  const overlayScenes = scenes.filter((scene) => scene.overlayId === selectedOverlayId);
  const selectedScene = overlayScenes.find((scene) => scene.id === selectedSceneId) ?? overlayScenes.find((scene) => scene.active) ?? overlayScenes[0];

  const showPreviewNotice = (tone, message) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 3600);
  };

  const previewUrl = useMemo(() => {
    const url = new URL(`/overlay/${selectedOverlayId}`, localConfig?.urls?.frontend ?? FRONTEND_URL);
    if (selectedScene?.id) {
      url.searchParams.set("scene", selectedScene.id);
    }
    return url.toString();
  }, [localConfig?.urls?.frontend, selectedOverlayId, selectedScene]);

  useEffect(() => {
    const load = async () => {
      try {
        const [status, config, sceneList] = await Promise.all([
          api("/api/v1/status"),
          api("/api/v1/public-config"),
          api(`/api/v1/scenes?overlayId=${selectedOverlayId}`)
        ]);
        setBackendStatus(status.ok ? "online" : "degraded");
        setLocalConfig(config);
        setOverlays(config.overlays ?? []);
        setScenes(sceneList);
        setSelectedSceneId(sceneList.find((scene) => scene.active)?.id ?? sceneList[0]?.id ?? "");
        setError("");
      } catch (loadError) {
        setBackendStatus("offline");
        setError(loadError.message);
      }
    };

    void load();
  }, [selectedOverlayId]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { role: "admin" }
    });

    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("connect_error", () => setSocketStatus("error"));
    socket.on("admin:event", (event) => setLastEvent(event));
    socket.on("overlay:layout:updated", (payload) => {
      if (payload.overlayId === selectedOverlayId) {
        setReloadKey((key) => key + 1);
        showPreviewNotice("success", payload.message ?? "Overlay layout updated");
      }
    });
    socket.on("scene:activated", (payload) => {
      if (payload.scene?.overlayId === selectedOverlayId) {
        setSelectedSceneId(payload.scene.id);
        setReloadKey((key) => key + 1);
      }
    });
    socket.on("system:error", (payload) => {
      showPreviewNotice("danger", payload.message ?? "Backend system error");
    });

    return () => socket.disconnect();
  }, [selectedOverlayId]);

  const runPreview = async (action) => {
    try {
      setError("");
      return await action();
    } catch (actionError) {
      setError(actionError.message);
      showPreviewNotice("danger", actionError.message);
      return null;
    }
  };

  const triggerYouTubeTest = (path) =>
    runPreview(() =>
      api(path, {
        method: "POST",
        body: JSON.stringify({ overlayId: selectedOverlayId })
      })
    );

  const activateScene = () =>
    selectedScene
      ? runPreview(async () => {
          await api(`/api/v1/scenes/${selectedScene.id}/activate`, { method: "POST" });
          setReloadKey((key) => key + 1);
          showPreviewNotice("success", `Scene activated: ${selectedScene.name}`);
        })
      : null;

  const copyPreviewUrl = async () => {
    const copied = await writeClipboardText(previewUrl);
    showPreviewNotice(copied ? "success" : "warning", copied ? "OBS URL copied" : "Clipboard blocked. Select the URL and copy it manually.");
  };

  return (
    <main className="preview-shell">
      <header className="preview-toolbar">
        <div>
          <p className="eyebrow">Live admin preview</p>
          <h1>{selectedOverlay?.name ?? selectedOverlayId}</h1>
          <p className="muted">This page previews the real OBS overlay route with backend events.</p>
        </div>
        <div className="preview-toolbar-actions">
          <ActionButton icon={Copy} onClick={copyPreviewUrl} tone="ghost">
            Copy OBS URL
          </ActionButton>
          <ActionButton icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} tone="ghost">
            Refresh Preview
          </ActionButton>
          <ActionButton icon={Settings} onClick={() => (window.location.href = `/admin/overlay-editor/${selectedOverlayId}`)} tone="ghost">
            Editor
          </ActionButton>
          <a className="back-link" href="/admin">
            Back to control room
          </a>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className={`notice-banner notice-${notice.tone}`}>{notice.message}</div> : null}

      <section className="panel preview-control-panel">
        <label className="select-field">
          <span>Overlay</span>
          <select value={selectedOverlayId} onChange={(event) => setSelectedOverlayId(event.target.value)}>
            {overlays.map((overlay) => (
              <option key={overlay.id} value={overlay.id}>
                {overlay.name}
              </option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span>Scene</span>
          <select value={selectedScene?.id ?? ""} onChange={(event) => setSelectedSceneId(event.target.value)}>
            {overlayScenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.name}
              </option>
            ))}
          </select>
        </label>
        <ActionButton icon={Play} onClick={activateScene} tone="success">
          Activate Scene
        </ActionButton>
        <ActionButton icon={MessageSquare} onClick={() => triggerYouTubeTest("/api/v1/youtube/test/chat")} tone="ghost">
          Test Chat
        </ActionButton>
        <ActionButton icon={Gauge} onClick={() => triggerYouTubeTest("/api/v1/youtube/test/superchat")} tone="warm">
          Test Super Chat
        </ActionButton>
        <ActionButton icon={Users} onClick={() => triggerYouTubeTest("/api/v1/youtube/test/viewer-count")} tone="success">
          Test Viewer Count
        </ActionButton>
      </section>

      <section className="preview-status-row">
        <StatusCard label="Backend" value={backendStatus} />
        <StatusCard label="Socket" value={socketStatus} />
        <StatusCard label="Scene" value={selectedScene?.name ?? "Default"} />
        <StatusCard label="Last Event" value={lastEvent?.type ?? "None"} />
      </section>

      <section className="preview-frame-panel">
        <iframe key={`${reloadKey}-${previewUrl}`} title="OBS overlay live preview" src={`${previewUrl}${previewUrl.includes("?") ? "&" : "?"}debug=true`} />
      </section>
    </main>
  );
};

const OverlayEditor = ({ initialOverlayId }) => {
  const [overlays, setOverlays] = useState([]);
  const [localConfig, setLocalConfig] = useState(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState(initialOverlayId || "main-overlay");
  const [layout, setLayout] = useState(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState("chat-widget");
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const dragRef = useRef(null);

  const selectedOverlay = overlays.find((overlay) => overlay.id === selectedOverlayId);
  const configuredOverlay = localConfig?.overlays?.find((overlay) => overlay.id === selectedOverlayId);
  const obsUrl = new URL(`/overlay/${selectedOverlayId}`, localConfig?.urls?.frontend ?? FRONTEND_URL).toString();
  const isVertical =
    configuredOverlay?.layout?.includes("vertical") || selectedOverlay?.config?.layout === "vertical" || layout?.baseHeight > layout?.baseWidth;
  const canvas = isVertical ? { width: 360, height: 640 } : { width: 960, height: 540 };
  const scaleX = canvas.width / (layout?.baseWidth ?? (isVertical ? 1080 : 1920));
  const scaleY = canvas.height / (layout?.baseHeight ?? (isVertical ? 1920 : 1080));
  const selectedWidget = layout?.widgets?.find((widget) => widget.widgetId === selectedWidgetId) ?? layout?.widgets?.[0];
  const showEditorNotice = (tone, message) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 3600);
  };

  useEffect(() => {
    const loadShell = async () => {
      try {
        const [overlayList, config] = await Promise.all([api("/api/v1/overlays"), api("/api/v1/public-config")]);
        setOverlays(overlayList);
        setLocalConfig(config);
        if (!overlayList.some((overlay) => overlay.id === selectedOverlayId)) {
          setSelectedOverlayId(config.activeOverlayId ?? overlayList[0]?.id ?? "main-overlay");
        }
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    void loadShell();
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { role: "admin" }
    });

    socket.on("overlay:layout:updated", (payload) => {
      if (payload.overlayId === selectedOverlayId) {
        showEditorNotice("success", payload.message ?? "Overlay layout updated");
      }
    });
    socket.on("system:error", (payload) => {
      showEditorNotice("danger", payload.message ?? "Backend system error");
    });

    return () => socket.disconnect();
  }, [selectedOverlayId]);

  useEffect(() => {
    if (!selectedOverlayId) {
      return;
    }

    const loadLayout = async () => {
      try {
        const nextLayout = await api(`/api/v1/overlays/${selectedOverlayId}/layout`);
        setLayout(nextLayout);
        setSelectedWidgetId(nextLayout.widgets?.[0]?.widgetId ?? "chat-widget");
        setDirty(false);
        setError("");
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    void loadLayout();
  }, [selectedOverlayId]);

  useEffect(() => {
    const move = (event) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const dx = (event.clientX - drag.startPointerX) / scaleX;
      const dy = (event.clientY - drag.startPointerY) / scaleY;
      updateWidgetLocal(drag.widgetId, {
        x: Math.max(0, Math.round(drag.startX + dx)),
        y: Math.max(0, Math.round(drag.startY + dy))
      });
    };
    const stop = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [scaleX, scaleY]);

  const chooseOverlay = (overlayId) => {
    setSelectedOverlayId(overlayId);
    window.history.replaceState(null, "", `/admin/overlay-editor/${overlayId}`);
  };

  const updateWidgetLocal = (widgetId, patch) => {
    setLayout((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        widgets: current.widgets.map((widget) => (widget.widgetId === widgetId ? { ...widget, ...patch } : widget))
      };
    });
    setDirty(true);
  };

  const startDrag = (event, widget) => {
    if (widget.locked) {
      return;
    }

    event.preventDefault();
    setSelectedWidgetId(widget.widgetId);
    dragRef.current = {
      widgetId: widget.widgetId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: widget.x,
      startY: widget.y
    };
  };

  const saveLayout = async () => {
    if (!layout) {
      return;
    }
    try {
      const saved = await api(`/api/v1/overlays/${selectedOverlayId}/layout`, {
        method: "PUT",
        body: JSON.stringify({ widgets: layout.widgets })
      });
      setLayout(saved);
      setDirty(false);
      setError("");
      showEditorNotice("success", "Overlay layout saved");
    } catch (saveError) {
      setError(saveError.message);
      showEditorNotice("danger", saveError.message);
    }
  };

  const resetLayout = async () => {
    try {
      const reset = await api(`/api/v1/overlays/${selectedOverlayId}/layout/reset`, { method: "POST" });
      setLayout(reset);
      setSelectedWidgetId(reset.widgets?.[0]?.widgetId ?? "chat-widget");
      setDirty(false);
      setError("");
      showEditorNotice("success", "Overlay layout reset");
    } catch (resetError) {
      setError(resetError.message);
      showEditorNotice("danger", resetError.message);
    }
  };

  const copyObsUrl = async () => {
    const copiedToClipboard = await writeClipboardText(obsUrl);
    setCopied(copiedToClipboard);
    showEditorNotice(copiedToClipboard ? "success" : "warning", copiedToClipboard ? "OBS URL copied" : "Clipboard blocked. Select the URL and copy it manually.");
    window.setTimeout(() => setCopied(false), 1400);
  };

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!dirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA";

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveLayout();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        void resetLayout();
        return;
      }

      if (event.key === "?") {
        setShortcutsOpen((open) => !open);
        return;
      }

      if (event.key === "Escape") {
        setShortcutsOpen(false);
        return;
      }

      if (isTyping || !selectedWidgetId || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const delta = {
        ArrowUp: { y: -step },
        ArrowDown: { y: step },
        ArrowLeft: { x: -step },
        ArrowRight: { x: step }
      }[event.key];
      const current = layout?.widgets?.find((widget) => widget.widgetId === selectedWidgetId);
      if (!current || current.locked) {
        return;
      }
      updateWidgetLocal(selectedWidgetId, {
        x: Math.max(0, current.x + (delta.x ?? 0)),
        y: Math.max(0, current.y + (delta.y ?? 0))
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  return (
    <main className="editor-shell">
      <aside className="editor-sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>Overlay Editor</strong>
            <span>Drag layout for OBS</span>
          </div>
        </div>

        <label className="select-field full">
          <span>Overlay</span>
          <select value={selectedOverlayId} onChange={(event) => chooseOverlay(event.target.value)}>
            {overlays.map((overlay) => (
              <option key={overlay.id} value={overlay.id}>
                {overlay.name}
              </option>
            ))}
          </select>
        </label>

        <div className="editor-actions">
          <ActionButton icon={Check} onClick={saveLayout} tone="success" disabled={!dirty}>
            Save Layout
          </ActionButton>
          <ActionButton icon={RotateCcw} onClick={resetLayout} tone="warm">
            Reset Layout
          </ActionButton>
          <ActionButton icon={copied ? Check : Copy} onClick={copyObsUrl} tone="ghost">
            {copied ? "Copied" : "Copy OBS URL"}
          </ActionButton>
          <ActionButton icon={Keyboard} onClick={() => setShortcutsOpen((open) => !open)} tone="ghost">
            Shortcuts
          </ActionButton>
        </div>

        <code className="url-box">{obsUrl}</code>

        <div className="editor-widget-list">
          {(layout?.widgets ?? []).map((widget) => (
            <button
              className={`editor-widget-button ${selectedWidgetId === widget.widgetId ? "is-selected" : ""}`}
              key={widget.widgetId}
              type="button"
              onClick={() => setSelectedWidgetId(widget.widgetId)}
            >
              <span>{LAYOUT_WIDGET_LABELS[widget.widgetId] ?? widget.widgetId}</span>
              <small>{widget.visible ? "Visible" : "Hidden"} · {widget.locked ? "Locked" : "Unlocked"}</small>
            </button>
          ))}
        </div>

        {selectedWidget ? (
          <div className="editor-inspector">
            <h2>{LAYOUT_WIDGET_LABELS[selectedWidget.widgetId] ?? selectedWidget.widgetId}</h2>
            <div className="split-fields">
              <label className="field">
                <span>X</span>
                <input
                  type="number"
                  value={selectedWidget.x}
                  onChange={(event) => updateWidgetLocal(selectedWidget.widgetId, { x: Number(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Y</span>
                <input
                  type="number"
                  value={selectedWidget.y}
                  onChange={(event) => updateWidgetLocal(selectedWidget.widgetId, { y: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="split-fields">
              <label className="field">
                <span>Width</span>
                <input
                  type="number"
                  value={selectedWidget.width}
                  onChange={(event) => updateWidgetLocal(selectedWidget.widgetId, { width: Number(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Height</span>
                <input
                  type="number"
                  value={selectedWidget.height}
                  onChange={(event) => updateWidgetLocal(selectedWidget.widgetId, { height: Number(event.target.value) })}
                />
              </label>
            </div>
            <label className="field">
              <span>Z Index</span>
              <input
                type="number"
                value={selectedWidget.zIndex}
                onChange={(event) => updateWidgetLocal(selectedWidget.widgetId, { zIndex: Number(event.target.value) })}
              />
            </label>
            <div className="toggle-row">
              <span>Visible</span>
              <Toggle checked={selectedWidget.visible} onChange={(visible) => updateWidgetLocal(selectedWidget.widgetId, { visible })} />
            </div>
            <div className="toggle-row">
              <span>Locked</span>
              <Toggle checked={selectedWidget.locked} onChange={(locked) => updateWidgetLocal(selectedWidget.widgetId, { locked })} />
            </div>
          </div>
        ) : null}

        <a className="back-link" href="/admin">
          Back to control room
        </a>
      </aside>

      <section className="editor-workspace">
        <header className="editor-header">
          <div>
            <p className="eyebrow">Admin Editor = draggable · OBS Overlay = locked render</p>
            <h1>{selectedOverlay?.name ?? selectedOverlayId}</h1>
            <p className="muted">Theme: {configuredOverlay?.theme ?? selectedOverlay?.config?.themeId ?? "default"}</p>
          </div>
          <span className={`dirty-pill ${dirty ? "is-dirty" : ""}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {notice ? <div className={`notice-banner notice-${notice.tone}`}>{notice.message}</div> : null}
        {shortcutsOpen ? (
          <div className="shortcut-panel">
            <strong>Editor shortcuts</strong>
            <span>Cmd/Ctrl+S saves layout</span>
            <span>Cmd/Ctrl+R resets layout</span>
            <span>Arrow keys move selected widget by 1px</span>
            <span>Shift+Arrow moves by 10px</span>
            <span>Esc closes this panel</span>
          </div>
        ) : null}

        <div className="editor-canvas-wrap">
          <div
            className={`editor-canvas ${isVertical ? "is-vertical" : ""}`}
            style={{ width: canvas.width, height: canvas.height }}
          >
            {(layout?.widgets ?? []).map((widget) => (
              <div
                className={`editor-widget ${selectedWidgetId === widget.widgetId ? "is-selected" : ""} ${
                  widget.locked ? "is-locked" : ""
                } ${widget.visible ? "" : "is-hidden-preview"}`}
                key={widget.widgetId}
                role="button"
                tabIndex={0}
                onPointerDown={(event) => startDrag(event, widget)}
                onClick={() => setSelectedWidgetId(widget.widgetId)}
                style={{
                  transform: `translate3d(${widget.x * scaleX}px, ${widget.y * scaleY}px, 0)`,
                  width: widget.width * scaleX,
                  height: widget.height * scaleY,
                  zIndex: widget.zIndex
                }}
              >
                <strong>{LAYOUT_WIDGET_LABELS[widget.widgetId] ?? widget.widgetId}</strong>
                <span>
                  {Math.round(widget.x)}, {Math.round(widget.y)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};
