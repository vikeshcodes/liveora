import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(rootDir, "creator-os.config.json");
const exampleConfigPath = path.join(rootDir, "creator-os.config.example.json");

const requiredFolders = ["backend", "frontend", "admin", "database"];

const commandExists = (command) => {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const majorNodeVersion = Number(process.versions.node.split(".")[0]);

const normalizeConfig = (config) => ({
  ...config,
  activeOverlayId: config.activeOverlayId ?? config.youtube?.defaultOverlayId ?? "main-overlay",
  youtube: {
    ...(config.youtube ?? {}),
    channelId: config.youtube?.channelId ?? config.youtubeChannelId ?? "",
    channelHandle: config.youtube?.channelHandle ?? config.youtubeChannelHandle ?? "",
    defaultOverlayId: config.activeOverlayId ?? config.youtube?.defaultOverlayId ?? "main-overlay"
  }
});

const readJson = (filePath) => normalizeConfig(JSON.parse(readFileSync(filePath, "utf8")));

const envFileToObject = (filePath) => {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key, rest.join("=")];
      })
  );
};

const isBlankValue = (value) => value === undefined || value === null || String(value).trim() === "";
const isPlaceholderValue = (value) => {
  if (isBlankValue(value)) return true;
  const normalized = String(value).trim();
  return (
    normalized.startsWith("replace_with_") ||
    normalized.includes("REPLACE_WITH") ||
    normalized.includes("YOUR_YOUTUBE_CHANNEL_ID") ||
    normalized === "UC_REPLACE_WITH_MY_CHANNEL_ID"
  );
};
const isRealValue = (value) => !isPlaceholderValue(value);

const writeEnvFile = (filePath, values, preserveKeys = []) => {
  const existing = envFileToObject(filePath);
  const next = { ...values };

  for (const [key, value] of Object.entries(next)) {
    if (isRealValue(existing[key]) && isPlaceholderValue(value)) {
      next[key] = existing[key];
    }
  }

  for (const key of preserveKeys) {
    if (isRealValue(existing[key])) {
      next[key] = existing[key];
    }
  }

  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${Object.entries(next).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
    return;
  }

  writeFileSync(filePath, `${Object.entries(next).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
};

const writeEnvExampleFile = (filePath, values) => {
  writeFileSync(filePath, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
};

const boolEnv = (value) => String(Boolean(value));

const backendEnvValues = (config, { example = false } = {}) => {
  const databaseUrl = `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}`;

  return {
    PORT: config.ports.backend,
    HOST: "127.0.0.1",
    NODE_ENV: "development",
    LIVEORA_MODE: "local",
    APP_BASE_URL: config.urls.backend,
    PUBLIC_APP_URL: config.urls.backend,
    DATABASE_PROVIDER: "postgres",
    LIVEORA_ADMIN_PASSWORD: "",
    GOOGLE_CLIENT_ID: "replace_with_google_client_id",
    GOOGLE_CLIENT_SECRET: "replace_with_google_client_secret",
    GOOGLE_REDIRECT_URI: `${config.urls.backend}/api/v1/youtube/auth/callback`,
    YOUTUBE_CHANNEL_ID: example ? "REPLACE_WITH_YOUR_YOUTUBE_CHANNEL_ID" : config.youtube.channelId,
    YOUTUBE_CHANNEL_HANDLE: example ? "@YourChannelHandle" : config.youtube.channelHandle,
    YOUTUBE_DEFAULT_OVERLAY_ID: config.activeOverlayId,
    YOUTUBE_USE_CHAT_STREAM: boolEnv(config.youtube.useChatStream),
    YOUTUBE_CHAT_POLLING_ENABLED: boolEnv(config.youtube.chatPollingEnabled),
    YOUTUBE_SUPERCHAT_POLLING_ENABLED: boolEnv(config.youtube.superchatPollingEnabled),
    YOUTUBE_VIEWER_COUNT_POLLING_ENABLED: boolEnv(config.youtube.viewerCountPollingEnabled),
    YOUTUBE_SUBSCRIBER_POLLING_ENABLED: boolEnv(config.youtube.subscriberPollingEnabled),
    YOUTUBE_MEMBER_POLLING_ENABLED: boolEnv(config.youtube.memberPollingEnabled),
    FRONTEND_URL: config.urls.frontend,
    ADMIN_URL: config.urls.admin,
    DATABASE_URL: databaseUrl,
    SOCKET_ALLOWED_ORIGINS: `${config.urls.frontend},${config.urls.admin},http://127.0.0.1:${config.ports.frontend},http://127.0.0.1:${config.ports.admin}`,
    CORS_ORIGIN: `${config.urls.frontend},${config.urls.admin},http://127.0.0.1:${config.ports.frontend},http://127.0.0.1:${config.ports.admin}`,
    OVERLAY_TOKEN_SECRET: example ? "replace_with_local_overlay_token_secret" : "local_creator_os_secret",
    REQUIRE_OVERLAY_TOKEN: "false"
  };
};

const generateEnvFiles = (config) => {
  writeEnvExampleFile(path.join(rootDir, "backend", ".env.example"), backendEnvValues(config, { example: true }));

  writeEnvFile(
    path.join(rootDir, "backend", ".env.local"),
    backendEnvValues(config),
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OVERLAY_TOKEN_SECRET"]
  );

  writeEnvFile(path.join(rootDir, "frontend", ".env.local"), {
    VITE_BACKEND_URL: config.urls.backend,
    VITE_SOCKET_URL: config.urls.backend,
    VITE_DEFAULT_OVERLAY_ID: config.activeOverlayId,
    VITE_ACTIVE_OVERLAY_ID: config.activeOverlayId,
    VITE_CREATOR_OS_MODE: "local"
  });

  writeEnvFile(path.join(rootDir, "admin", ".env.local"), {
    VITE_BACKEND_URL: config.urls.backend,
    VITE_SOCKET_URL: config.urls.backend,
    VITE_FRONTEND_URL: config.urls.frontend,
    VITE_DEFAULT_OVERLAY_ID: config.activeOverlayId,
    VITE_ACTIVE_OVERLAY_ID: config.activeOverlayId,
    VITE_CREATOR_OS_MODE: "local"
  });

  writeEnvFile(path.join(rootDir, "database", ".env.local"), {
    POSTGRES_PORT: config.ports.database,
    POSTGRES_DB: config.database.name,
    POSTGRES_USER: config.database.user,
    POSTGRES_PASSWORD: config.database.password
  });
};

console.log("Vikesh Codes Creator OS - Setup");
console.log("");

if (majorNodeVersion < 20) {
  console.warn(`Node.js ${process.versions.node} detected. Node.js 20 LTS or newer is recommended.`);
}

if (!commandExists("npm")) {
  console.error("npm was not found. Install Node.js LTS first.");
  process.exit(1);
}

if (!commandExists("docker")) {
  console.warn("Docker was not found. Install Docker Desktop or configure local PostgreSQL on port 5180.");
} else {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    console.log("Docker found and running. The local runner will use database/docker-compose.yml for PostgreSQL.");
  } catch {
    console.warn("Docker is installed but not running. Start Docker Desktop to enable PostgreSQL on port 5180.");
  }
}

for (const folder of requiredFolders) {
  const folderPath = path.join(rootDir, folder);
  if (!existsSync(folderPath)) {
    console.error(`Missing required folder: ${folder}`);
    process.exit(1);
  }
  if (folder !== "database" && !existsSync(path.join(folderPath, "package.json"))) {
    console.error(`Missing ${folder}/package.json`);
    process.exit(1);
  }
}

if (!existsSync(configPath)) {
  copyFileSync(exampleConfigPath, configPath);
  console.log("Created creator-os.config.json from creator-os.config.example.json");
} else {
  console.log("creator-os.config.json already exists; leaving it unchanged.");
}

const config = readJson(configPath);
generateEnvFiles(config);

for (const folder of ["backend", "frontend", "admin"]) {
  if (!existsSync(path.join(rootDir, folder, "node_modules"))) {
    console.log(`Missing ${folder}/node_modules. Install with: cd ${folder} && npm install`);
  }
}

console.log("");
console.log("Next steps:");
console.log("1. Install dependencies if needed:");
console.log("   cd backend && npm install");
console.log("   cd ../frontend && npm install");
console.log("   cd ../admin && npm install");
console.log("2. Edit creator-os.config.json:");
console.log("   youtube.channelId");
console.log("   youtube.channelHandle");
console.log("3. Add Google OAuth credentials to backend/.env.local if using YouTube:");
console.log("   GOOGLE_CLIENT_ID");
console.log("   GOOGLE_CLIENT_SECRET");
console.log("4. Run: npm run dev:local");
console.log("");
console.log("Local URLs:");
console.log("   Admin:   http://localhost:5160/admin");
console.log("   Overlay: http://localhost:5150/overlay/main-overlay");
console.log("   Preview: http://localhost:5160/admin/preview/main-overlay");
console.log("   Editor:  http://localhost:5160/admin/overlay-editor/main-overlay");
console.log("   Health:  http://localhost:5170/health");
console.log("");
console.log("Google OAuth settings:");
console.log("   Authorized JavaScript origins:");
console.log("   http://localhost:5150");
console.log("   http://localhost:5160");
console.log("   http://localhost:5170");
console.log("   Authorized redirect URI:");
console.log("   http://localhost:5170/api/v1/youtube/auth/callback");
