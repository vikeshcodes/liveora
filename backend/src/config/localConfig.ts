import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface LocalOverlayConfig {
  id: string;
  name: string;
  theme: string;
  layout: string;
  enabled: boolean;
}

export interface CreatorOsLocalConfig {
  projectName: string;
  mode: string;
  owner?: {
    name: string;
    github: string;
    website?: string;
  };
  activeOverlayId: string;
  youtube: {
    channelId: string;
    channelHandle: string;
    defaultOverlayId: string;
    useChatStream: boolean;
    chatPollingEnabled: boolean;
    superchatPollingEnabled: boolean;
    viewerCountPollingEnabled: boolean;
    subscriberPollingEnabled: boolean;
    memberPollingEnabled: boolean;
  };
  ports: {
    frontend: number;
    admin: number;
    backend: number;
    database: number;
  };
  urls: {
    frontend: string;
    admin: string;
    backend: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  overlays: LocalOverlayConfig[];
}

const fallbackConfig: CreatorOsLocalConfig = {
  projectName: "Vikesh Codes Creator OS",
  mode: "local",
  owner: {
    name: "VikeshCodes",
    github: "vikeshcodes",
    website: "https://vikeshcodes.in"
  },
  activeOverlayId: "main-overlay",
  youtube: {
    channelId: "",
    channelHandle: "@VikeshCodes",
    defaultOverlayId: "main-overlay",
    useChatStream: false,
    chatPollingEnabled: true,
    superchatPollingEnabled: true,
    viewerCountPollingEnabled: true,
    subscriberPollingEnabled: false,
    memberPollingEnabled: false
  },
  ports: {
    frontend: 5150,
    admin: 5160,
    backend: 5170,
    database: 5180
  },
  urls: {
    frontend: "http://localhost:5150",
    admin: "http://localhost:5160",
    backend: "http://localhost:5170"
  },
  database: {
    host: "localhost",
    port: 5180,
    name: "creator_os",
    user: "creator_os_user",
    password: "creator_os_password"
  },
  overlays: [
    {
      id: "main-overlay",
      name: "Main Coding Stream Overlay",
      theme: "liquid-glass-pro",
      layout: "desktop-16x9",
      enabled: true
    }
  ]
};

const candidates = () => [
  path.resolve(process.cwd(), "creator-os.config.json"),
  path.resolve(process.cwd(), "../creator-os.config.json"),
  path.resolve(__dirname, "../../../creator-os.config.json"),
  path.resolve(__dirname, "../../../../creator-os.config.json")
];

const normalizeConfig = (parsed: Partial<CreatorOsLocalConfig> & Record<string, any>): CreatorOsLocalConfig => {
  const activeOverlayId = parsed.activeOverlayId ?? parsed.youtube?.defaultOverlayId ?? fallbackConfig.activeOverlayId;
  return {
    ...fallbackConfig,
    ...parsed,
    activeOverlayId,
    owner: {
      name: fallbackConfig.owner?.name ?? "VikeshCodes",
      github: fallbackConfig.owner?.github ?? "vikeshcodes",
      website: fallbackConfig.owner?.website,
      ...(parsed.owner ?? {})
    },
    youtube: {
      ...fallbackConfig.youtube,
      ...(parsed.youtube ?? {}),
      channelId: parsed.youtube?.channelId ?? parsed.youtubeChannelId ?? fallbackConfig.youtube.channelId,
      channelHandle: parsed.youtube?.channelHandle ?? parsed.youtubeChannelHandle ?? fallbackConfig.youtube.channelHandle,
      defaultOverlayId: activeOverlayId
    },
    ports: {
      ...fallbackConfig.ports,
      ...(parsed.ports ?? {})
    },
    urls: {
      ...fallbackConfig.urls,
      ...(parsed.urls ?? {})
    },
    database: {
      ...fallbackConfig.database,
      ...(parsed.database ?? {})
    },
    overlays: parsed.overlays ?? fallbackConfig.overlays
  };
};

const isConfiguredYouTubeChannelId = (value: string | undefined | null) =>
  Boolean(
    value &&
      !value.includes("REPLACE_WITH") &&
      !value.includes("YOUR_YOUTUBE_CHANNEL_ID") &&
      value !== "UC_REPLACE_WITH_MY_CHANNEL_ID"
  );

const isConfiguredYouTubeHandle = (value: string | undefined | null) =>
  Boolean(value && !value.includes("YourChannelHandle") && !value.includes("REPLACE_WITH"));

export const loadCreatorOsConfig = (): CreatorOsLocalConfig => {
  const configPath = candidates().find((candidate) => existsSync(candidate));
  if (!configPath) {
    return fallbackConfig;
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    return normalizeConfig(parsed);
  } catch {
    return fallbackConfig;
  }
};

export const getPublicCreatorOsConfig = () => {
  const config = loadCreatorOsConfig();
  const effectiveYouTubeChannelId = isConfiguredYouTubeChannelId(config.youtube.channelId)
    ? config.youtube.channelId
    : process.env.YOUTUBE_CHANNEL_ID || config.youtube.channelId;
  const effectiveYouTubeChannelHandle = isConfiguredYouTubeHandle(config.youtube.channelHandle)
    ? config.youtube.channelHandle
    : process.env.YOUTUBE_CHANNEL_HANDLE || config.youtube.channelHandle || "";
  const youtubeConfigSource = isConfiguredYouTubeChannelId(config.youtube.channelId)
    ? "creator-os.config.json"
    : isConfiguredYouTubeChannelId(process.env.YOUTUBE_CHANNEL_ID)
      ? "backend/.env.local"
      : "missing";

  return {
    projectName: config.projectName,
    mode: config.mode,
    officialOwner: "VikeshCodes",
    owner: {
      name: config.owner?.name ?? "VikeshCodes",
      github: config.owner?.github ?? "vikeshcodes",
      website: config.owner?.website ?? "https://vikeshcodes.in"
    },
    activeOverlayId: config.activeOverlayId,
    ports: config.ports,
    urls: config.urls,
    youtube: {
      channelId: effectiveYouTubeChannelId,
      channelHandle: effectiveYouTubeChannelHandle,
      configured: isConfiguredYouTubeChannelId(effectiveYouTubeChannelId),
      configSource: youtubeConfigSource,
      defaultOverlayId: config.youtube.defaultOverlayId,
      useChatStream: config.youtube.useChatStream,
      chatPollingEnabled: config.youtube.chatPollingEnabled,
      superchatPollingEnabled: config.youtube.superchatPollingEnabled,
      viewerCountPollingEnabled: config.youtube.viewerCountPollingEnabled,
      subscriberPollingEnabled: config.youtube.subscriberPollingEnabled,
      memberPollingEnabled: config.youtube.memberPollingEnabled
    },
    overlays: config.overlays
  };
};
