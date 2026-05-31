import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(tmpdir(), "creator-os.local-pids.json");
const ports = [5150, 5160, 5170, 5180];
const projectPathMarker = rootDir;

const commandExists = (command) => {
  try {
    execSync(`${process.platform === "win32" ? "where" : "which"} ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const stopDatabase = () => {
  if (!commandExists("docker")) {
    console.log("Docker not found. Skipping database compose shutdown.");
    return;
  }

  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    console.log("Docker is not running. Skipping database compose shutdown.");
    return;
  }

  try {
    execSync("docker compose --env-file .env.local down", {
      cwd: path.join(rootDir, "database"),
      stdio: "inherit"
    });
    console.log("Stopped Creator OS PostgreSQL Docker service.");
  } catch {
    console.log("Could not stop Docker compose service automatically.");
    console.log("Manual command: cd database && docker compose --env-file .env.local down");
  }
};

const killPid = (pid) => {
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Stopped process ${pid}`);
  } catch {
    console.log(`Process ${pid} was not running.`);
  }
};

const getPidCommand = (pid) => {
  try {
    return execSync(`ps -p ${pid} -o command=`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const portPids = (port) => {
  try {
    if (process.platform === "win32") return [];
    return execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: "utf8" })
      .split(/\s+/)
      .map((pid) => Number(pid))
      .filter(Boolean);
  } catch {
    return [];
  }
};

if (existsSync(statePath)) {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  for (const pid of state.pids ?? []) killPid(pid);
  unlinkSync(statePath);
} else {
  console.log("No local PID file found. Checking common Creator OS dev ports.");
}

for (const port of ports) {
  const pids = portPids(port);
  if (!pids.length) {
    console.log(`Port ${port} is free.`);
    continue;
  }

  for (const pid of pids) {
    const command = getPidCommand(pid);
    if (command.includes(projectPathMarker)) {
      console.log(`Stopping Creator OS process ${pid} on port ${port}`);
      killPid(pid);
    } else {
      console.log(`Port ${port} is busy by process ${pid}:`);
      console.log(command || "Unable to identify command.");
      console.log("Not killing it because it does not look like a Creator OS process.");
    }
  }
}

stopDatabase();
