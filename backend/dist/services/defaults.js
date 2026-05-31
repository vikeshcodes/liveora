"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GOAL = exports.DEFAULT_TOKEN = exports.DEFAULT_OVERLAY = exports.DEFAULT_SCENES = exports.DEFAULT_THEMES = exports.DEFAULT_CONFIG = exports.DEFAULT_WIDGETS = void 0;
exports.DEFAULT_WIDGETS = {
    alertWidget: {
        enabled: true,
        duration: 5000,
        position: "top-right"
    },
    chatWidget: {
        enabled: true,
        maxMessages: 8,
        position: "bottom-left"
    },
    goalWidget: {
        enabled: true,
        position: "top-center"
    },
    timerWidget: {
        enabled: true,
        position: "top-left"
    },
    viewerCountWidget: {
        enabled: true,
        position: "top-left"
    },
    activityFeedWidget: {
        enabled: true,
        maxItems: 6,
        position: "middle-right"
    },
    nowPlayingWidget: {
        enabled: true,
        position: "bottom-right"
    }
};
exports.DEFAULT_CONFIG = {
    themeId: "liquid-glass-pro",
    layout: "horizontal",
    alertDurationMs: 5000,
    queueMaxLength: 30,
    widgets: exports.DEFAULT_WIDGETS
};
exports.DEFAULT_THEMES = [
    {
        id: "liquid-glass-pro",
        name: "Liquid Glass Pro",
        description: "Premium glass panels, restrained cyan glow, and liquid gradient accents.",
        variables: {
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
        }
    },
    {
        id: "minimal-matte-pro",
        name: "Minimal Matte Pro",
        description: "Quiet matte surfaces, thin borders, and crisp professional contrast.",
        variables: {
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
        }
    },
    {
        id: "coding-focus-pro",
        name: "Coding Focus Pro",
        description: "Low-glare developer stream theme with cool cyan focus states and quiet panels.",
        variables: {
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
        }
    },
    {
        id: "study-calm-pro",
        name: "Study Calm Pro",
        description: "Calm teaching and study-stream palette with soft contrast and warm accent balance.",
        variables: {
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
        }
    },
    {
        id: "cyber-clean-pro",
        name: "Cyber Clean Pro",
        description: "Crisp futuristic stream theme with restrained violet and aqua accents.",
        variables: {
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
        }
    },
    {
        id: "vertical-minimal-pro",
        name: "Vertical Minimal Pro",
        description: "Compact high-readability theme for vertical live classes, shorts, and phone-first streams.",
        variables: {
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
        }
    }
];
exports.DEFAULT_SCENES = [
    {
        id: "coding",
        overlayId: "main-overlay",
        name: "Coding Focus",
        description: "Default coding livestream layout with chat, timer, goal, alerts, and activity visible.",
        themeId: "liquid-glass-pro",
        layout: "horizontal",
        active: true,
        widgetVisibility: {
            alertWidget: true,
            chatWidget: true,
            goalWidget: true,
            timerWidget: true,
            viewerCountWidget: true,
            activityFeedWidget: true,
            nowPlayingWidget: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: "study",
        overlayId: "main-overlay",
        name: "Study / Live Class",
        description: "Quiet teaching scene with chat, timer, goal, and viewer count visible.",
        themeId: "study-calm-pro",
        layout: "horizontal",
        active: false,
        widgetVisibility: {
            alertWidget: true,
            chatWidget: true,
            goalWidget: true,
            timerWidget: true,
            viewerCountWidget: true,
            activityFeedWidget: false,
            nowPlayingWidget: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: "starting-soon",
        overlayId: "main-overlay",
        name: "Starting Soon",
        description: "Pre-stream scene with timer, goal, now playing, and alerts.",
        themeId: "cyber-clean-pro",
        layout: "horizontal",
        active: false,
        widgetVisibility: {
            alertWidget: true,
            chatWidget: false,
            goalWidget: true,
            timerWidget: true,
            viewerCountWidget: false,
            activityFeedWidget: false,
            nowPlayingWidget: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: "be-right-back",
        overlayId: "main-overlay",
        name: "Be Right Back",
        description: "Break scene with minimal widgets so the stream stays calm.",
        themeId: "minimal-matte-pro",
        layout: "horizontal",
        active: false,
        widgetVisibility: {
            alertWidget: true,
            chatWidget: false,
            goalWidget: false,
            timerWidget: true,
            viewerCountWidget: true,
            activityFeedWidget: false,
            nowPlayingWidget: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: "vertical-live",
        overlayId: "vertical-overlay",
        name: "Vertical Live",
        description: "Phone-first 9:16 scene for shorts-style streams and vertical live classes.",
        themeId: "vertical-minimal-pro",
        layout: "vertical",
        active: true,
        widgetVisibility: {
            alertWidget: true,
            chatWidget: true,
            goalWidget: true,
            timerWidget: true,
            viewerCountWidget: true,
            activityFeedWidget: false,
            nowPlayingWidget: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: "gaming-clean",
        overlayId: "gaming-overlay",
        name: "Gaming Clean",
        description: "A restrained gaming scene that keeps alerts and chat readable without noisy visuals.",
        themeId: "cyber-clean-pro",
        layout: "horizontal",
        active: true,
        widgetVisibility: {
            alertWidget: true,
            chatWidget: true,
            goalWidget: false,
            timerWidget: false,
            viewerCountWidget: true,
            activityFeedWidget: true,
            nowPlayingWidget: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];
exports.DEFAULT_OVERLAY = {
    id: "main-overlay",
    name: "Vikesh Codes Main Overlay",
    slug: "main-overlay",
    config: exports.DEFAULT_CONFIG,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};
exports.DEFAULT_TOKEN = {
    overlayId: "main-overlay",
    token: "dev-overlay-token",
    label: "Development OBS browser source token",
    enabled: true,
    createdAt: new Date().toISOString()
};
exports.DEFAULT_GOAL = {
    overlayId: "main-overlay",
    title: "Stream Support Goal",
    currentValue: 3200,
    targetValue: 10000,
    currency: "INR",
    updatedAt: new Date().toISOString()
};
