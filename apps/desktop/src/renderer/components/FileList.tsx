import { useEffect, useRef, useState } from "react";
import type { Dispatch, KeyboardEvent, ReactNode, SetStateAction } from "react";
import type { FileChangeEntry } from "@jotdiff/shared-types";

interface FileListProps {
  files: FileChangeEntry[];
  selectedPath: string | null;
  onSelect(path: string): void;
  searchValue: string;
  onSearchChange(value: string): void;
}

interface TreeDirectoryNode {
  kind: "directory";
  name: string;
  path: string;
  directories: TreeDirectoryNode[];
  files: FileChangeEntry[];
}

interface DirectoryDraft {
  name: string;
  path: string;
  directories: Map<string, DirectoryDraft>;
  files: FileChangeEntry[];
}

function sortFiles(left: FileChangeEntry, right: FileChangeEntry): number {
  return left.path.localeCompare(right.path);
}

function sortDirectories(left: TreeDirectoryNode, right: TreeDirectoryNode): number {
  return left.name.localeCompare(right.name);
}

function buildTree(files: FileChangeEntry[]): TreeDirectoryNode {
  const root: DirectoryDraft = {
    name: "",
    path: "",
    directories: new Map<string, DirectoryDraft>(),
    files: [],
  };

  for (const file of files) {
    const parts = file.path.replaceAll("\\", "/").split("/").filter(Boolean);
    let current = root;

    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (!part) {
        continue;
      }

      const nextPath = current.path ? `${current.path}/${part}` : part;
      let next = current.directories.get(part);

      if (!next) {
        next = {
          name: part,
          path: nextPath,
          directories: new Map<string, DirectoryDraft>(),
          files: [],
        };
        current.directories.set(part, next);
      }

      current = next;
    }

    current.files.push(file);
  }

  function finalize(node: DirectoryDraft): TreeDirectoryNode {
    return {
      kind: "directory",
      name: node.name,
      path: node.path,
      directories: Array.from(node.directories.values()).map(finalize).sort(sortDirectories),
      files: node.files.slice().sort(sortFiles),
    };
  }

  return finalize(root);
}

function statusLabel(file: FileChangeEntry): string {
  if (file.isUntracked) {
    return "new";
  }

  return file.kind;
}

function renderFileRow(
  file: FileChangeEntry,
  depth: number,
  selectedPath: string | null,
  onSelect: (path: string) => void,
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, path: string) => void,
  registerRowRef: (path: string, element: HTMLButtonElement | null) => void,
) {
  return (
    <button
      aria-selected={selectedPath === file.path}
      key={file.path}
      className={selectedPath === file.path ? "file-row active" : "file-row"}
      onClick={() => onSelect(file.path)}
      onKeyDown={(event) => onKeyDown(event, file.path)}
      ref={(element) => registerRowRef(file.path, element)}
      style={{ paddingLeft: `${10 + depth * 14}px` }}
      tabIndex={selectedPath === file.path ? 0 : -1}
      type="button"
    >
      <span className={`file-dot status-${file.kind}`} aria-hidden="true" />
      <div className="file-copy">
        <div className="file-primary">
          <span className="file-name-wrap">
            <span className="file-name">{file.path.replaceAll("\\", "/").split("/").pop() ?? file.path}</span>
            {file.isUntracked ? (
              <span aria-label="Untracked file" className="file-name-icon" title="Untracked">
                ?
              </span>
            ) : null}
          </span>
          <span className="file-stats">
            <span className="diff-count diff-add">+{file.additions}</span>
            <span className="diff-count diff-del">-{file.deletions}</span>
          </span>
        </div>
        <div className="file-secondary">
          <span className="file-kind">{statusLabel(file)}</span>
          {file.hasStagedChanges ? <span className="file-flag">staged</span> : null}
          {file.hasUnstagedChanges ? <span className="file-flag">unstaged</span> : null}
          {file.previousPath ? <span className="file-flag">from {file.previousPath}</span> : null}
        </div>
      </div>
    </button>
  );
}

function renderDirectoryNode(
  node: TreeDirectoryNode,
  depth: number,
  expandedPaths: Record<string, boolean>,
  setExpandedPaths: Dispatch<SetStateAction<Record<string, boolean>>>,
  selectedPath: string | null,
  onSelect: (path: string) => void,
  onFileKeyDown: (event: KeyboardEvent<HTMLButtonElement>, path: string) => void,
  registerRowRef: (path: string, element: HTMLButtonElement | null) => void,
  visibleFilePaths: string[],
  forceExpanded: boolean,
): ReactNode[] {
  const rows: ReactNode[] = [];

  for (const directory of node.directories) {
    const isExpanded = forceExpanded || expandedPaths[directory.path] !== false;

    rows.push(
      <button
        key={`dir-${directory.path}`}
        className="tree-row tree-directory-row"
        onClick={() =>
          setExpandedPaths((current) => ({
            ...current,
            [directory.path]: !isExpanded,
          }))
        }
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        type="button"
      >
        <span className="tree-caret" aria-hidden="true">
          {isExpanded ? "v" : ">"}
        </span>
        <span className="tree-folder-icon" aria-hidden="true">
          []
        </span>
        <span className="tree-label">{directory.name}</span>
      </button>,
    );

    if (isExpanded) {
      rows.push(
        ...renderDirectoryNode(
          directory,
          depth + 1,
          expandedPaths,
          setExpandedPaths,
          selectedPath,
          onSelect,
          onFileKeyDown,
          registerRowRef,
          visibleFilePaths,
          forceExpanded,
        ),
      );
    }
  }

  for (const file of node.files) {
    visibleFilePaths.push(file.path);
    rows.push(renderFileRow(file, depth, selectedPath, onSelect, onFileKeyDown, registerRowRef));
  }

  return rows;
}

export function FileList({
  files,
  selectedPath,
  onSelect,
  searchValue,
  onSearchChange,
}: FileListProps) {
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tree = buildTree(files);
  const forceExpanded = searchValue.trim().length > 0;
  const visibleFilePaths: string[] = [];

  useEffect(() => {
    if (!selectedPath) {
      return;
    }

    const parts = selectedPath.replaceAll("\\", "/").split("/").filter(Boolean);
    if (parts.length < 2) {
      return;
    }

    setExpandedPaths((current) => {
      const next = { ...current };
      let currentPath = "";

      for (let index = 0; index < parts.length - 1; index += 1) {
        const part = parts[index];
        if (!part) {
          continue;
        }

        currentPath = currentPath ? `${currentPath}/${part}` : part;
        next[currentPath] = true;
      }

      return next;
    });
  }, [selectedPath]);

  useEffect(() => {
    if (!selectedPath) {
      return;
    }

    rowRefs.current[selectedPath]?.focus();
  }, [selectedPath]);

  function registerRowRef(path: string, element: HTMLButtonElement | null) {
    rowRefs.current[path] = element;
  }

  function handleFileKeyDown(event: KeyboardEvent<HTMLButtonElement>, path: string) {
    const currentIndex = visibleFilePaths.indexOf(path);
    if (currentIndex === -1) {
      return;
    }

    let nextPath: string | null = null;

    if (event.key === "ArrowDown") {
      nextPath = visibleFilePaths[currentIndex + 1] ?? null;
    } else if (event.key === "ArrowUp") {
      nextPath = visibleFilePaths[currentIndex - 1] ?? null;
    } else if (event.key === "Home") {
      nextPath = visibleFilePaths[0] ?? null;
    } else if (event.key === "End") {
      nextPath = visibleFilePaths.at(-1) ?? null;
    }

    if (!nextPath) {
      return;
    }

    event.preventDefault();
    onSelect(nextPath);
  }

  const rows = renderDirectoryNode(
    tree,
    0,
    expandedPaths,
    setExpandedPaths,
    selectedPath,
    onSelect,
    handleFileKeyDown,
    registerRowRef,
    visibleFilePaths,
    forceExpanded,
  );

  return (
    <section className="file-list">
      <div className="section-header">
        <h2>Changed files</h2>
        <span>{files.length}</span>
      </div>
      <div className="file-list-toolbar">
        <input
          aria-label="Search changed files"
          className="file-search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search files"
          type="search"
          value={searchValue}
        />
      </div>
      <div className="file-items">
        {rows}
        {files.length === 0 ? <div className="empty-list">No files match the current filters.</div> : null}
      </div>
    </section>
  );
}
