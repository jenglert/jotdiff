export type DiffViewMode = "unified" | "split";

export interface LaunchState {
  cwd: string;
  pathScope?: string;
  filters: ChangeFilters;
  viewMode: DiffViewMode;
}

export interface ChangeFilters {
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export type FileKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "typechanged"
  | "untracked"
  | "conflicted";

export interface FileChangeEntry {
  path: string;
  previousPath?: string;
  kind: FileKind;
  x: string;
  y: string;
  hasStagedChanges: boolean;
  hasUnstagedChanges: boolean;
  isUntracked: boolean;
  stagedStatus?: string;
  unstagedStatus?: string;
  additions: number;
  deletions: number;
  stagedAdditions: number;
  stagedDeletions: number;
  unstagedAdditions: number;
  unstagedDeletions: number;
}

export interface RepoInfo {
  cwd: string;
  repoRoot: string;
  relativeCwd: string;
  repoName: string;
}

export interface SessionSummary {
  totalFiles: number;
  stagedFiles: number;
  unstagedFiles: number;
  untrackedFiles: number;
  additions: number;
  deletions: number;
}

export interface RepoSession {
  kind: "repo";
  repo: RepoInfo;
  launchState: LaunchState;
  summary: SessionSummary;
  files: FileChangeEntry[];
}

export interface NonRepoSession {
  kind: "non-repo";
  cwd: string;
  launchState: LaunchState;
  message: string;
}

export type AppSession = RepoSession | NonRepoSession;

export interface FileDiffLine {
  type: "context" | "add" | "remove" | "meta";
  left?: string;
  right?: string;
}

export interface DiffRow {
  type: "context" | "add" | "remove";
  text: string;
  leftLineNumber?: number;
  rightLineNumber?: number;
}

export interface DiffHunk {
  header: string;
  rows: DiffRow[];
}

export interface FileDiffSection {
  label: string;
  source: "staged" | "unstaged" | "untracked";
  raw: string;
  hunks: DiffHunk[];
  isBinary?: boolean;
  note?: string;
}

export interface FileDiffLoadOptions {
  full?: boolean;
}

export interface FileDiff {
  path: string;
  mode: DiffViewMode;
  raw: string;
  lines: FileDiffLine[];
  isTruncated: boolean;
  isBinary: boolean;
  binaryReason?: string;
  isFull: boolean;
  canLoadFull: boolean;
  sections: FileDiffSection[];
}
