import { detectRepo, listWorkingTreeChanges } from "@jotdiff/git-core";
import path from "node:path";
import type {
  AppSession,
  FileChangeEntry,
  LaunchState,
  RepoSession,
  SessionSummary,
} from "@jotdiff/shared-types";

function summarizeFiles(files: FileChangeEntry[]): SessionSummary {
  let stagedFiles = 0;
  let unstagedFiles = 0;
  let untrackedFiles = 0;
  let additions = 0;
  let deletions = 0;

  for (const file of files) {
    if (file.hasStagedChanges) {
      stagedFiles += 1;
    }

    if (file.hasUnstagedChanges) {
      unstagedFiles += 1;
    }

    if (file.isUntracked) {
      untrackedFiles += 1;
    }

    additions += file.additions;
    deletions += file.deletions;
  }

  return {
    totalFiles: files.length,
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
    additions,
    deletions,
  };
}

export async function createSession(launchState: LaunchState): Promise<AppSession> {
  const repo = await detectRepo(launchState.cwd);

  if (!repo) {
    return {
      kind: "non-repo",
      cwd: launchState.cwd,
      launchState,
      message: "Jotdiff currently works only inside git working trees.",
    };
  }

  const pathScope = launchState.pathScope
    ? path
        .relative(repo.repoRoot, path.resolve(launchState.cwd, launchState.pathScope))
        .split(path.sep)
        .join("/")
    : undefined;

  const files = await listWorkingTreeChanges(
    repo,
    launchState.filters,
    pathScope,
  );

  const session: RepoSession = {
    kind: "repo",
    repo,
    launchState,
    summary: summarizeFiles(files),
    files,
  };

  return session;
}
