import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronBinary: string = require("electron");

function resolveDesktopEntry(): string {
  return path.resolve(__dirname, "../../../apps/desktop/dist-electron/main.js");
}

function run(): void {
  const { values } = parseArgs({
    options: {
      cwd: { type: "string" },
      path: { type: "string" },
      view: { type: "string" },
      staged: { type: "boolean" },
      unstaged: { type: "boolean" },
      untracked: { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  const cwdValue = typeof values.cwd === "string" ? values.cwd : undefined;
  const pathValue = typeof values.path === "string" ? values.path : undefined;
  const viewValue = typeof values.view === "string" ? values.view : undefined;
  const args = [resolveDesktopEntry(), "--cwd", cwdValue ? path.resolve(cwdValue) : process.cwd()];
  const explicitFilterMode =
    values.staged !== undefined || values.unstaged !== undefined || values.untracked !== undefined;

  if (pathValue) {
    args.push("--path", pathValue);
  }

  if (viewValue) {
    args.push("--view", viewValue);
  }

  if (explicitFilterMode) {
    args.push("--staged", String(values.staged === true));
    args.push("--unstaged", String(values.unstaged === true));
    args.push("--untracked", String(values.untracked === true));
  }

  const child = spawn(electronBinary, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}

run();
