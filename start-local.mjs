import { spawn, execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(rootDir, "creator-os.config.json");
const statePath = path.join(tmpdir(), "creator-os.local-pids.json");

const requiredFolders = ["frontend", "backend", "admin", "database"];
const log = (message = "") => console.log(message);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

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

const readJson = (filePath) => {
  try {
    return normalizeConfig(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}: ${error.message}`);
  }
};

const boolEnv = (value) => String(Boolean(value));

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

  writeFileSync(filePath, `${Object.entries(next).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
};

const writeEnvExampleFile = (filePath, values) => {
  writeFileSync(filePath, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
};

const backendEnvValues = (config, { example = false } = {}) => {
  const { ports, urls, database, youtube, activeOverlayId } = config;
  const databaseUrl = `postgresql://${database.user}:${database.password}@${database.host}:${database.port}/${database.name}`;

  return {
    PORT: ports.backend,
    HOST: "127.0.0.1",
    NODE_ENV: "development",
    LIVEORA_MODE: "local",
    APP_BASE_URL: urls.backend,
    PUBLIC_APP_URL: urls.backend,
    DATABASE_PROVIDER: "postgres",
    LIVEORA_ADMIN_PASSWORD: "",
    GOOGLE_CLIENT_ID: example ? "replace_with_google_client_id" : "replace_with_google_client_id",
    GOOGLE_CLIENT_SECRET: example ? "replace_with_google_client_secret" : "replace_with_google_client_secret",
    GOOGLE_REDIRECT_URI: `${urls.backend}/api/v1/youtube/auth/callback`,
    YOUTUBE_CHANNEL_ID: example ? "REPLACE_WITH_YOUR_YOUTUBE_CHANNEL_ID" : youtube.channelId,
    YOUTUBE_CHANNEL_HANDLE: example ? "@YourChannelHandle" : youtube.channelHandle,
    YOUTUBE_DEFAULT_OVERLAY_ID: activeOverlayId,
    YOUTUBE_USE_CHAT_STREAM: boolEnv(youtube.useChatStream),
    YOUTUBE_CHAT_POLLING_ENABLED: boolEnv(youtube.chatPollingEnabled),
    YOUTUBE_SUPERCHAT_POLLING_ENABLED: boolEnv(youtube.superchatPollingEnabled),
    YOUTUBE_VIEWER_COUNT_POLLING_ENABLED: boolEnv(youtube.viewerCountPollingEnabled),
    YOUTUBE_SUBSCRIBER_POLLING_ENABLED: boolEnv(youtube.subscriberPollingEnabled),
    YOUTUBE_MEMBER_POLLING_ENABLED: boolEnv(youtube.memberPollingEnabled),
    FRONTEND_URL: urls.frontend,
    ADMIN_URL: urls.admin,
    DATABASE_URL: databaseUrl,
    SOCKET_ALLOWED_ORIGINS: `${urls.frontend},${urls.admin},http://127.0.0.1:${ports.frontend},http://127.0.0.1:${ports.admin}`,
    CORS_ORIGIN: `${urls.frontend},${urls.admin},http://127.0.0.1:${ports.frontend},http://127.0.0.1:${ports.admin}`,
    OVERLAY_TOKEN_SECRET: example ? "replace_with_local_overlay_token_secret" : "local_creator_os_secret",
    REQUIRE_OVERLAY_TOKEN: "false"
  };
};

const checkFolder = (folder) => {
  const folderPath = path.join(rootDir, folder);
  if (!existsSync(folderPath)) throw new Error(`Missing folder: ${folder}`);
  if (folder !== "database" && !existsSync(path.join(folderPath, "package.json"))) {
    throw new Error(`Missing package.json in ${folder}. Run npm install after restoring the project files.`);
  }
};

const checkNodeModules = (folder) => {
  if (!existsSync(path.join(rootDir, folder, "node_modules"))) {
    throw new Error(`Missing ${folder}/node_modules. Run: cd ${folder} && npm install`);
  }
};

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => server.close(() => resolve(false)));
    server.listen(port, "127.0.0.1");
  });

const portOwner = (port) => {
  try {
    if (process.platform === "win32") {
      return execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" }).trim();
    }
    return execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, { encoding: "utf8" }).trim();
  } catch {
    return "Unable to identify process.";
  }
};

const commandExists = (command) => {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const dockerComposeCommand = () => {
  if (!commandExists("docker")) return null;
  try {
    execSync("docker compose version", { stdio: "ignore" });
    return ["docker", ["compose"]];
  } catch {
    if (commandExists("docker-compose")) return ["docker-compose", []];
    return null;
  }
};

const dockerRunning = () => {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const waitForDockerPostgres = (config) => {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      execFileSync(
        "docker",
        ["exec", "creator-os-postgres", "pg_isready", "-U", config.database.user, "-d", config.database.name],
        { stdio: "ignore" }
      );
      return true;
    } catch {
      sleep(1000);
    }
  }
  return false;
};

const applySqlFile = (config, relativePath) => {
  const sqlPath = path.join(rootDir, relativePath);
  if (!existsSync(sqlPath)) throw new Error(`Missing SQL file: ${relativePath}`);
  execFileSync("docker", ["exec", "-i", "creator-os-postgres", "psql", "-U", config.database.user, "-d", config.database.name], {
    input: readFileSync(sqlPath),
    stdio: ["pipe", "inherit", "inherit"]
  });
};

const applyDatabaseMigrations = (config) => {
  try {
    execFileSync("docker", ["inspect", "creator-os-postgres"], { stdio: "ignore" });
  } catch {
    log("Database container creator-os-postgres was not found. Skipping automatic migrations.");
    return;
  }

  log("Preparing database schema...");
  if (!waitForDockerPostgres(config)) {
    throw new Error("PostgreSQL did not become ready in time.");
  }

  applySqlFile(config, "database/migrations/001_initial_schema.sql");
  applySqlFile(config, "database/migrations/003_youtube_integration.sql");
  applySqlFile(config, "database/migrations/004_widget_layouts.sql");
  applySqlFile(config, "database/seeds/dev_seed.sql");
};

const prefixLogs = (label, child) => {
  child.stdout?.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) console.log(`[${label}] ${line}`);
  });
  child.stderr?.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) console.error(`[${label}] ${line}`);
  });
};

const spawnLocal = (label, command, args, cwd, env = {}) => {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32"
  });
  prefixLogs(label, child);
  return child;
};

const runMacTerminal = (title, command, cwd) => {
  const escapedCommand = command.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const escapedCwd = cwd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `
    tell application "Terminal"
      activate
      do script "cd \\"${escapedCwd}\\"; printf '\\\\e]0;${title}\\\\a'; ${escapedCommand}"
    end tell
  `;
  execFileSync("osascript", ["-e", script], { stdio: "ignore", timeout: 3000 });
};

const generateEnvFiles = (config) => {
  const { ports, urls, database, youtube, activeOverlayId } = config;

  writeEnvExampleFile(path.join(rootDir, "backend", ".env.example"), backendEnvValues(config, { example: true }));

  writeEnvFile(
    path.join(rootDir, "backend", ".env.local"),
    backendEnvValues(config),
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OVERLAY_TOKEN_SECRET"]
  );

  writeEnvFile(path.join(rootDir, "frontend", ".env.local"), {
    VITE_BACKEND_URL: urls.backend,
    VITE_SOCKET_URL: urls.backend,
    VITE_DEFAULT_OVERLAY_ID: activeOverlayId,
    VITE_ACTIVE_OVERLAY_ID: activeOverlayId,
    VITE_CREATOR_OS_MODE: "local"
  });

  writeEnvFile(path.join(rootDir, "admin", ".env.local"), {
    VITE_BACKEND_URL: urls.backend,
    VITE_SOCKET_URL: urls.backend,
    VITE_FRONTEND_URL: urls.frontend,
    VITE_DEFAULT_OVERLAY_ID: activeOverlayId,
    VITE_ACTIVE_OVERLAY_ID: activeOverlayId,
    VITE_CREATOR_OS_MODE: "local"
  });

  writeEnvFile(path.join(rootDir, "database", ".env.local"), {
    POSTGRES_PORT: ports.database,
    POSTGRES_DB: database.name,
    POSTGRES_USER: database.user,
    POSTGRES_PASSWORD: database.password
  });
};

const printSummary = (config) => {
  log("Vikesh Codes Creator OS - Local Runner");
  log("");
  log("Loaded config: creator-os.config.json");
  log("");
  log("Ports:");
  log(`Frontend: ${config.ports.frontend}`);
  log(`Admin: ${config.ports.admin}`);
  log(`Backend: ${config.ports.backend}`);
  log(`Database: ${config.ports.database}`);
  log("");
  log("Active overlay:");
  log(config.activeOverlayId);
  log("");
  log("OBS URLs:");
  for (const overlay of config.overlays) {
    log(`${overlay.name}: ${config.urls.frontend}/overlay/${overlay.id}`);
  }
  log("");
  log("Admin:");
  log(`${config.urls.admin}/admin`);
  log(`${config.urls.admin}/admin/preview/${config.activeOverlayId}`);
  log("");
  log("Backend:");
  log(`${config.urls.backend}/health`);
  log("");
  log("Google OAuth redirect URI:");
  log(`${config.urls.backend}/api/v1/youtube/auth/callback`);
  if (isPlaceholderValue(config.youtube?.channelId)) {
    const existingBackendEnv = envFileToObject(path.join(rootDir, "backend", ".env.local"));
    log("");
    if (isRealValue(existingBackendEnv.YOUTUBE_CHANNEL_ID)) {
      log("Setup note: YouTube channel ID is preserved from backend/.env.local. For one-file config, move it to creator-os.config.json -> youtube.channelId.");
    } else {
      log("Setup warning: YouTube channel ID is still a placeholder. Edit creator-os.config.json -> youtube.channelId.");
    }
  }
  log("");
};

const main = async () => {
  if (!existsSync(configPath)) {
    throw new Error("Missing creator-os.config.json. Run npm run setup or copy creator-os.config.example.json to creator-os.config.json.");
  }
  requiredFolders.forEach(checkFolder);
  ["frontend", "backend", "admin"].forEach(checkNodeModules);

  const config = readJson(configPath);
  generateEnvFiles(config);
  printSummary(config);

  const busy = [];
  for (const [service, port] of Object.entries(config.ports)) {
    if (await isPortOpen(port)) busy.push({ service, port, owner: portOwner(port) });
  }

  const databaseBusyOnly = busy.length === 1 && busy[0].service === "database";
  if (busy.length && !databaseBusyOnly) {
    for (const item of busy) {
      log(`Port ${item.port} is already in use for ${item.service}.`);
      log(item.owner);
    }
    throw new Error("Stop the old process or run node stop-local.mjs.");
  }

  let databaseLogAvailable = false;
  if (databaseBusyOnly) {
    log(`Database appears to already be running on port ${config.ports.database}.`);
    databaseLogAvailable = false;
  } else {
    const compose = dockerComposeCommand();
    if (!compose) {
      log("Database warning: Docker Compose is not installed. Install Docker Desktop or configure PostgreSQL on port 5180.");
    } else if (!dockerRunning()) {
      log("Database warning: Docker is not running. Start Docker Desktop or configure local PostgreSQL on port 5180.");
    } else {
      log("Starting database...");
      const [dockerCommand, dockerArgs] = compose;
      execFileSync(dockerCommand, [...dockerArgs, "--env-file", ".env.local", "up", "-d"], {
        cwd: path.join(rootDir, "database"),
        stdio: "inherit"
      });
      databaseLogAvailable = true;
    }
  }
  applyDatabaseMigrations(config);

  const commands = [
    { title: "Creator OS Backend", label: "BACKEND", cwd: path.join(rootDir, "backend"), command: "npm run dev:local" },
    { title: "Creator OS Frontend", label: "FRONTEND", cwd: path.join(rootDir, "frontend"), command: "npm run dev:local" },
    { title: "Creator OS Admin", label: "ADMIN", cwd: path.join(rootDir, "admin"), command: "npm run dev:local" }
  ];

  const children = [];
  let terminalStarted = false;
  if (process.platform === "darwin" && process.env.CREATOR_OS_SAME_TERMINAL !== "true") {
    try {
      if (databaseLogAvailable) runMacTerminal("Creator OS Database", "docker compose --env-file .env.local logs -f", path.join(rootDir, "database"));
      for (const item of commands) runMacTerminal(item.title, item.command, item.cwd);
      terminalStarted = true;
    } catch {
      log("Could not open separate macOS Terminal windows. Falling back to labeled logs in this terminal.");
    }
  }

  if (!terminalStarted) {
    if (databaseLogAvailable) {
      const compose = dockerComposeCommand();
      if (compose) {
        const [dockerCommand, dockerArgs] = compose;
        children.push(
          spawnLocal("DATABASE", dockerCommand, [...dockerArgs, "--env-file", ".env.local", "logs", "-f"], path.join(rootDir, "database"))
        );
      }
    }
    for (const item of commands) {
      children.push(spawnLocal(item.label, "npm", ["run", "dev:local"], item.cwd));
    }
    writeFileSync(statePath, JSON.stringify({ pids: children.map((child) => child.pid).filter(Boolean) }, null, 2));
  }

  log("");
  log("Starting backend...");
  log("Starting frontend...");
  log("Starting admin...");
  log("");
  log("All services started.");
};

main().catch((error) => {
  console.error("");
  console.error(error.message);
  console.error("");
  console.error("Dependency install commands:");
  console.error("cd backend && npm install");
  console.error("cd frontend && npm install");
  console.error("cd admin && npm install");
  console.error("");
  process.exit(1);
});
