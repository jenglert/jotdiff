import { contextBridge, ipcRenderer } from "electron";
import type { AppSession, FileDiff, FileDiffLoadOptions, LaunchState } from "@jotdiff/shared-types";

const api = {
  getLaunchState(): Promise<LaunchState> {
    return ipcRenderer.invoke("launch-state:get");
  },
  loadSession(overrides?: Partial<LaunchState>): Promise<AppSession> {
    return ipcRenderer.invoke("session:load", overrides);
  },
  loadDiff(
    filePath: string,
    mode: LaunchState["viewMode"],
    options?: FileDiffLoadOptions,
  ): Promise<FileDiff | null> {
    return ipcRenderer.invoke("diff:load", filePath, mode, options);
  },
};

contextBridge.exposeInMainWorld("jotdiff", api);
