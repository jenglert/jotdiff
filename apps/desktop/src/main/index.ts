import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadFileDiff } from "@jotdiff/git-core";
import { createSession } from "@jotdiff/session-core";
import type { AppSession, FileDiffLoadOptions, LaunchState } from "@jotdiff/shared-types";
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow: BrowserWindow | null = null;
let launchState = parseLaunchState(process.argv.slice(1));

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === "true";
}

function parseLaunchState(argv: string[]): LaunchState {
  const { values } = parseArgs({
    args: argv,
    options: {
      cwd: { type: "string" },
      path: { type: "string" },
      view: { type: "string" },
      staged: { type: "string" },
      unstaged: { type: "string" },
      untracked: { type: "string" },
    },
    allowPositionals: true,
    strict: false,
  });

  const cwdValue = typeof values.cwd === "string" ? values.cwd : undefined;
  const pathValue = typeof values.path === "string" ? values.path : undefined;
  const viewValue = values.view === "split" ? "split" : "unified";
  const stagedValue = typeof values.staged === "string" ? values.staged : undefined;
  const unstagedValue = typeof values.unstaged === "string" ? values.unstaged : undefined;
  const untrackedValue = typeof values.untracked === "string" ? values.untracked : undefined;
  const cwd = cwdValue ? path.resolve(cwdValue) : process.cwd();

  return {
    cwd,
    pathScope: pathValue,
    viewMode: viewValue,
    filters: {
      staged: parseBooleanFlag(stagedValue) ?? true,
      unstaged: parseBooleanFlag(unstagedValue) ?? true,
      untracked: parseBooleanFlag(untrackedValue) ?? true,
    },
  };
}

async function resolveSession(overrides?: Partial<LaunchState>): Promise<AppSession> {
  launchState = {
    ...launchState,
    ...overrides,
    filters: {
      ...launchState.filters,
      ...overrides?.filters,
    },
  };

  return createSession(launchState);
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#10161d",
    title: "Jotdiff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  ipcMain.handle("launch-state:get", async () => launchState);
  ipcMain.handle("session:load", async (_event, overrides?: Partial<LaunchState>) =>
    resolveSession(overrides),
  );
  ipcMain.handle(
    "diff:load",
    async (
      _event,
      filePath: string,
      mode: LaunchState["viewMode"],
      options?: FileDiffLoadOptions,
    ) => {
    const session = await resolveSession();

    if (session.kind !== "repo") {
      return null;
    }

    const entry = session.files.find((file) => file.path === filePath);
    if (!entry) {
      return null;
    }

      return loadFileDiff(session.repo, entry, mode, launchState.filters, options);
    },
  );

  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
