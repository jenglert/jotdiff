import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ChangeFilters,
  DiffHunk,
  DiffRow,
  FileChangeEntry,
  FileDiff,
  FileDiffLoadOptions,
  FileDiffLine,
  FileKind,
  RepoInfo,
} from "@jotdiff/shared-types";

const execFileAsync = promisify(execFile);
const PREVIEW_DIFF_BYTES = 200_000;

interface GitResult {
  stdout: string;
}

interface NumstatCounts {
  additions: number;
  deletions: number;
}

type NumstatMap = Map<string, NumstatCounts>;

interface DiffSectionDraft {
  label: FileDiff["sections"][number]["label"];
  source: FileDiff["sections"][number]["source"];
  raw: string;
  isBinary?: boolean;
  note?: string;
  parse(raw: string): DiffHunk[];
}

async function runGit(
  cwd: string,
  args: string[],
  allowFailure = false,
): Promise<GitResult | null> {
  try {
    return await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    if (allowFailure) {
      return null;
    }

    throw error;
  }
}

function normalizePathForGit(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function decodeStatus(code: string): string | undefined {
  const normalized = code.trim();

  switch (normalized) {
    case "M":
      return "modified";
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "typechanged";
    case "U":
      return "unmerged";
    default:
      return undefined;
  }
}

function classifyKind(x: string, y: string): FileKind {
  if (x === "U" || y === "U" || (x === "A" && y === "A")) {
    return "conflicted";
  }

  const preferred = [x, y].find((code) => code !== " " && code !== "?");

  switch (preferred) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "typechanged";
    case "M":
      return "modified";
    default:
      return x === "?" && y === "?" ? "untracked" : "modified";
  }
}

function shouldIncludeEntry(
  entry: FileChangeEntry,
  filters: ChangeFilters,
  pathScope?: string,
): boolean {
  if (pathScope) {
    const normalizedScope = normalizePathForGit(pathScope).replace(/\/+$/, "");
    if (
      normalizedScope.length > 0 &&
      entry.path !== normalizedScope &&
      !entry.path.startsWith(`${normalizedScope}/`)
    ) {
      return false;
    }
  }

  if (entry.isUntracked) {
    return filters.untracked;
  }

  if (entry.hasStagedChanges && filters.staged) {
    return true;
  }

  if (entry.hasUnstagedChanges && filters.unstaged) {
    return true;
  }

  return false;
}

function parseStatusEntries(stdout: string): FileChangeEntry[] {
  const tokens = stdout.split("\0").filter(Boolean);
  const files: FileChangeEntry[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }

    const x = token[0] ?? " ";
    const y = token[1] ?? " ";
    const filePath = token.slice(3);
    let previousPath: string | undefined;

    if (x === "R" || x === "C" || y === "R" || y === "C") {
      previousPath = tokens[index + 1];
      index += 1;
    }

    const isUntracked = x === "?" && y === "?";
    const hasStagedChanges = !isUntracked && x !== " ";
    const hasUnstagedChanges = !isUntracked && y !== " ";

    files.push({
      path: filePath,
      previousPath,
      kind: classifyKind(x, y),
      x,
      y,
      hasStagedChanges,
      hasUnstagedChanges,
      isUntracked,
      stagedStatus: decodeStatus(x),
      unstagedStatus: decodeStatus(y),
      additions: 0,
      deletions: 0,
      stagedAdditions: 0,
      stagedDeletions: 0,
      unstagedAdditions: 0,
      unstagedDeletions: 0,
    });
  }

  return files;
}

function toCount(value: string): number {
  return value === "-" ? 0 : Number.parseInt(value, 10) || 0;
}

function parseNumstat(stdout: string): NumstatMap {
  const counts: NumstatMap = new Map();

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const [additionsRaw, deletionsRaw, ...pathParts] = line.split("\t");
    const filePath = pathParts.join("\t");
    if (!filePath) {
      continue;
    }

    counts.set(filePath, {
      additions: toCount(additionsRaw ?? "0"),
      deletions: toCount(deletionsRaw ?? "0"),
    });
  }

  return counts;
}

async function loadNumstat(
  repoRoot: string,
  args: string[],
  pathScope?: string,
): Promise<NumstatMap> {
  const scopedArgs = pathScope ? [...args, "--", pathScope] : args;
  const result = await runGit(repoRoot, scopedArgs, true);

  return parseNumstat(result?.stdout ?? "");
}

async function collectCounts(repoRoot: string, pathScope?: string) {
  const [staged, unstaged] = await Promise.all([
    loadNumstat(repoRoot, ["diff", "--cached", "--numstat"], pathScope),
    loadNumstat(repoRoot, ["diff", "--numstat"], pathScope),
  ]);

  return { staged, unstaged };
}

export async function detectRepo(cwd: string): Promise<RepoInfo | null> {
  const result = await runGit(cwd, ["rev-parse", "--show-toplevel"], true);
  const repoRoot = result?.stdout.trim();

  if (!repoRoot) {
    return null;
  }

  const relativeCwd = path.relative(repoRoot, cwd).split(path.sep).join("/");

  return {
    cwd,
    repoRoot,
    relativeCwd: relativeCwd.length > 0 ? relativeCwd : ".",
    repoName: path.basename(repoRoot),
  };
}

export async function listWorkingTreeChanges(
  repo: RepoInfo,
  filters: ChangeFilters,
  pathScope?: string,
): Promise<FileChangeEntry[]> {
  const result = await runGit(repo.repoRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignored=no",
  ]);

  const parsed = parseStatusEntries(result?.stdout ?? "");
  const { staged, unstaged } = await collectCounts(repo.repoRoot, pathScope);

  for (const entry of parsed) {
    const stagedCounts = staged.get(entry.path);
    const unstagedCounts = unstaged.get(entry.path);
    entry.stagedAdditions = stagedCounts?.additions ?? 0;
    entry.stagedDeletions = stagedCounts?.deletions ?? 0;
    entry.unstagedAdditions = unstagedCounts?.additions ?? 0;
    entry.unstagedDeletions = unstagedCounts?.deletions ?? 0;
    entry.additions = entry.stagedAdditions + entry.unstagedAdditions;
    entry.deletions = entry.stagedDeletions + entry.unstagedDeletions;
  }

  await Promise.all(
    parsed.map(async (entry) => {
      if (!entry.isUntracked) {
        return;
      }

      entry.additions = await countUntrackedLines(repo.repoRoot, entry.path);
      entry.deletions = 0;
    }),
  );

  return parsed
    .filter((entry) => shouldIncludeEntry(entry, filters, pathScope))
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function countUntrackedLines(repoRoot: string, filePath: string): Promise<number> {
  const absolutePath = path.join(repoRoot, filePath);
  const content = await fs.readFile(absolutePath, "utf8");
  if (!content.length) {
    return 0;
  }

  return content.split(/\r?\n/).length;
}

function isProbablyBinaryBuffer(buffer: Buffer): boolean {
  if (buffer.includes(0)) {
    return true;
  }

  let suspicious = 0;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));

  for (const value of sample) {
    if ((value >= 0 && value <= 8) || value === 11 || value === 12 || (value >= 14 && value <= 31)) {
      suspicious += 1;
    }
  }

  return sample.length > 0 && suspicious / sample.length > 0.15;
}

async function inspectUntrackedFile(repoRoot: string, filePath: string): Promise<{
  isBinary: boolean;
  raw?: string;
}> {
  const absolutePath = path.join(repoRoot, filePath);
  const content = await fs.readFile(absolutePath);

  if (isProbablyBinaryBuffer(content)) {
    return { isBinary: true };
  }

  const text = content.toString("utf8");

  return {
    isBinary: false,
    raw: `+++ Untracked file: ${filePath}\n${text}`,
  };
}

function toSplitLines(raw: string): FileDiffLine[] {
  const rows = raw.split(/\r?\n/);
  const lines: FileDiffLine[] = [];
  let pendingRemovals: string[] = [];
  let pendingAdditions: string[] = [];

  function flushPending() {
    const max = Math.max(pendingRemovals.length, pendingAdditions.length);
    for (let index = 0; index < max; index += 1) {
      const left = pendingRemovals[index];
      const right = pendingAdditions[index];
      if (left !== undefined && right !== undefined) {
        lines.push({ type: "remove", left, right });
      } else if (left !== undefined) {
        lines.push({ type: "remove", left });
      } else if (right !== undefined) {
        lines.push({ type: "add", right });
      }
    }

    pendingRemovals = [];
    pendingAdditions = [];
  }

  for (const row of rows) {
    if (
      row.startsWith("diff --git") ||
      row.startsWith("index ") ||
      row.startsWith("--- ") ||
      row.startsWith("+++ ") ||
      row.startsWith("@@")
    ) {
      flushPending();
      lines.push({ type: "meta", left: row, right: row });
      continue;
    }

    if (row.startsWith("+")) {
      pendingAdditions.push(row.slice(1));
      continue;
    }

    if (row.startsWith("-")) {
      pendingRemovals.push(row.slice(1));
      continue;
    }

    flushPending();
    lines.push({
      type: "context",
      left: row.startsWith(" ") ? row.slice(1) : row,
      right: row.startsWith(" ") ? row.slice(1) : row,
    });
  }

  flushPending();

  return lines;
}

function parseHunkHeader(header: string): {
  leftStart: number;
  rightStart: number;
} | null {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(header);
  if (!match) {
    return null;
  }

  return {
    leftStart: Number.parseInt(match[1] ?? "0", 10),
    rightStart: Number.parseInt(match[2] ?? "0", 10),
  };
}

function parsePatchHunks(raw: string): DiffHunk[] {
  const lines = raw.split(/\r?\n/);
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let leftLine = 0;
  let rightLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const parsedHeader = parseHunkHeader(line);
      if (!parsedHeader) {
        continue;
      }

      current = {
        header: line,
        rows: [],
      };
      hunks.push(current);
      leftLine = parsedHeader.leftStart;
      rightLine = parsedHeader.rightStart;
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.rows.push({
        type: "add",
        text: line.slice(1),
        rightLineNumber: rightLine,
      });
      rightLine += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      current.rows.push({
        type: "remove",
        text: line.slice(1),
        leftLineNumber: leftLine,
      });
      leftLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      current.rows.push({
        type: "context",
        text: line.slice(1),
        leftLineNumber: leftLine,
        rightLineNumber: rightLine,
      });
      leftLine += 1;
      rightLine += 1;
      continue;
    }

    if (line.startsWith("\\")) {
      const previous = current.rows.at(-1);
      if (previous) {
        previous.text = `${previous.text}\n${line}`;
      }
    }
  }

  return hunks;
}

function parseUntrackedHunks(raw: string): DiffHunk[] {
  const rows: DiffRow[] = raw
    .split(/\r?\n/)
    .slice(1)
    .map((line, index) => ({
      type: "add" as const,
      text: line,
      rightLineNumber: index + 1,
    }));

  return [
    {
      header: "@@ untracked @@",
      rows,
    },
  ];
}

function buildSectionsFromDrafts(
  drafts: DiffSectionDraft[],
  full: boolean,
): {
  sections: FileDiff["sections"];
  raw: string;
  isTruncated: boolean;
} {
  let remainingBytes = full ? Number.POSITIVE_INFINITY : PREVIEW_DIFF_BYTES;
  let isTruncated = false;
  const sections: FileDiff["sections"] = [];

  for (const draft of drafts) {
    if (remainingBytes <= 0) {
      isTruncated = true;
      break;
    }

    const header = `# ${draft.label}\n`;
    const fullText = `${header}${draft.raw}`;
    const fits = fullText.length <= remainingBytes;
    const rawText = fits ? draft.raw : draft.raw.slice(0, Math.max(0, remainingBytes - header.length));

    sections.push({
      label: draft.label,
      source: draft.source,
      raw: rawText,
      hunks: draft.isBinary ? [] : draft.parse(rawText),
      isBinary: draft.isBinary,
      note: draft.note,
    });

    remainingBytes -= fullText.length;
    if (!fits) {
      isTruncated = true;
      break;
    }
  }

  const raw = sections.map((section) => `# ${section.label}\n${section.raw}`).join("\n\n");

  return { sections, raw, isTruncated };
}

export async function loadFileDiff(
  repo: RepoInfo,
  entry: FileChangeEntry,
  mode: FileDiff["mode"],
  filters: ChangeFilters,
  options: FileDiffLoadOptions = {},
): Promise<FileDiff> {
  const drafts: DiffSectionDraft[] = [];
  const loadFull = options.full === true;
  let isBinary = false;
  let binaryReason: string | undefined;

  if (entry.isUntracked && filters.untracked) {
    const inspection = await inspectUntrackedFile(repo.repoRoot, entry.path);
    if (inspection.isBinary || !inspection.raw) {
      isBinary = true;
      binaryReason = "Untracked file appears to be binary or non-text.";
      drafts.push({
        label: "Untracked working copy",
        source: "untracked",
        raw: "",
        isBinary: true,
        note: binaryReason,
        parse: () => [],
      });
    } else {
      drafts.push({
        label: "Untracked working copy",
        source: "untracked",
        raw: inspection.raw,
        parse: parseUntrackedHunks,
      });
    }
  }

  if (entry.hasStagedChanges && filters.staged) {
    const diffResult = await runGit(repo.repoRoot, [
      "diff",
      "--cached",
      "--no-ext-diff",
      "--patch",
      "--",
      entry.path,
    ]);

    const diffText = diffResult?.stdout?.trim();
    if (diffText) {
      if (diffText.includes("Binary files ") || diffText.includes("GIT binary patch")) {
        isBinary = true;
        binaryReason = "Staged diff is binary.";
        drafts.push({
          label: "Staged changes",
          source: "staged",
          raw: "",
          isBinary: true,
          note: binaryReason,
          parse: () => [],
        });
      } else {
        drafts.push({
          label: "Staged changes",
          source: "staged",
          raw: diffText,
          parse: parsePatchHunks,
        });
      }
    }
  }

  if (entry.hasUnstagedChanges && filters.unstaged) {
    const diffResult = await runGit(repo.repoRoot, [
      "diff",
      "--no-ext-diff",
      "--patch",
      "--",
      entry.path,
    ]);

    const diffText = diffResult?.stdout?.trim();
    if (diffText) {
      if (diffText.includes("Binary files ") || diffText.includes("GIT binary patch")) {
        isBinary = true;
        binaryReason = "Unstaged diff is binary.";
        drafts.push({
          label: "Unstaged changes",
          source: "unstaged",
          raw: "",
          isBinary: true,
          note: binaryReason,
          parse: () => [],
        });
      } else {
        drafts.push({
          label: "Unstaged changes",
          source: "unstaged",
          raw: diffText,
          parse: parsePatchHunks,
        });
      }
    }
  }

  if (drafts.length === 0 && !entry.isUntracked) {
    const fallback = await runGit(repo.repoRoot, [
      "diff",
      "--cached",
      "--no-ext-diff",
      "--patch",
      "HEAD",
      "--",
      entry.path,
    ], true);

    const fallbackRaw = fallback?.stdout?.trim() ?? "";
    if (fallbackRaw) {
      drafts.push({
        label: "Repository changes",
        source: "staged",
        raw: fallbackRaw,
        parse: parsePatchHunks,
      });
    }
  }
  const { sections, raw, isTruncated } = buildSectionsFromDrafts(drafts, loadFull);

  return {
    path: entry.path,
    mode,
    raw,
    lines: toSplitLines(raw),
    isTruncated,
    isBinary,
    binaryReason,
    isFull: loadFull,
    canLoadFull: isTruncated && !loadFull,
    sections,
  };
}
