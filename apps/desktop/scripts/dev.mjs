import { spawn } from "node:child_process";
import path from "node:path";

const desktopRoot = process.cwd();
const argv = process.argv.slice(2);

function parseCwd(args) {
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (current === "--cwd" && next) {
      return path.resolve(next);
    }

    if (typeof current === "string" && current.startsWith("--cwd=")) {
      return path.resolve(current.slice("--cwd=".length));
    }
  }

  return process.cwd();
}

const targetCwd = parseCwd(argv);
const children = [];

function start(command, options = {}) {
  const child = spawn(command, {
    cwd: desktopRoot,
    shell: true,
    stdio: "inherit",
    ...options,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });

  children.push(child);
  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.pid) {
      continue;
    }

    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        shell: false,
      });
    } else if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`[jotdiff-dev] target cwd: ${targetCwd}`);

start("npx vite");
start("npx tsup --watch");
start(`npx wait-on tcp:5174 dist-electron/main.js && npx electronmon dist-electron/main.js --cwd "${targetCwd}"`);
