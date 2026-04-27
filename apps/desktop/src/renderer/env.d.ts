import type { AppSession, FileDiff, FileDiffLoadOptions, LaunchState } from "@jotdiff/shared-types";

declare global {
  interface Window {
    jotdiff: {
      getLaunchState(): Promise<LaunchState>;
      loadSession(overrides?: Partial<LaunchState>): Promise<AppSession>;
      loadDiff(
        filePath: string,
        mode: LaunchState["viewMode"],
        options?: FileDiffLoadOptions,
      ): Promise<FileDiff | null>;
    };
  }
}

export {};
