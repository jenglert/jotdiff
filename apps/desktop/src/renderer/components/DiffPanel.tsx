import type { ReactNode } from "react";
import { useState } from "react";
import type { DiffHunk, DiffRow, FileChangeEntry, FileDiff, FileDiffSection, LaunchState } from "@jotdiff/shared-types";

interface DiffPanelProps {
  selectedFile: FileChangeEntry | null;
  diff: FileDiff | null;
  diffState: "idle" | "loading" | "ready" | "error";
  onLoadFull(): void;
  viewMode: LaunchState["viewMode"];
}

const CONTEXT_HEAD = 3;
const CONTEXT_TAIL = 3;
const COLLAPSE_THRESHOLD = 8;

type ExpansionMap = Record<string, boolean>;

function lineNumber(value?: number): string {
  return value === undefined ? "" : String(value);
}

function UnifiedRow({ row }: { row: DiffRow }) {
  return (
    <div className={`unified-row unified-${row.type}`}>
      <span className="line-number">{lineNumber(row.leftLineNumber)}</span>
      <span className="line-number">{lineNumber(row.rightLineNumber)}</span>
      <pre>{row.text}</pre>
    </div>
  );
}

function SplitPair({
  left,
  right,
  tone,
}: {
  left?: DiffRow;
  right?: DiffRow;
  tone: "context" | "change";
}) {
  return (
    <div className={`split-row split-${tone}`}>
      <div className={`split-cell ${left?.type === "remove" ? "split-remove-cell" : ""}`}>
        <span className="line-number">{lineNumber(left?.leftLineNumber)}</span>
        <pre>{left?.type === "add" ? "" : left?.text ?? ""}</pre>
      </div>
      <div className={`split-cell ${right?.type === "add" ? "split-add-cell" : ""}`}>
        <span className="line-number">{lineNumber(right?.rightLineNumber)}</span>
        <pre>{right?.type === "remove" ? "" : right?.text ?? ""}</pre>
      </div>
    </div>
  );
}

function renderUnifiedHunk(
  hunk: DiffHunk,
  hunkKey: string,
  expansionState: ExpansionMap,
  setExpansionState: React.Dispatch<React.SetStateAction<ExpansionMap>>,
): ReactNode {
  const rows: ReactNode[] = [];
  let index = 0;
  let segmentIndex = 0;

  while (index < hunk.rows.length) {
    const row = hunk.rows[index];
    if (!row) {
      index += 1;
      continue;
    }

    if (row.type !== "context") {
      rows.push(<UnifiedRow key={`${hunkKey}-row-${index}`} row={row} />);
      index += 1;
      continue;
    }

    let end = index;
    while (end < hunk.rows.length && hunk.rows[end]?.type === "context") {
      end += 1;
    }

    const run = hunk.rows.slice(index, end);
    if (run.length > COLLAPSE_THRESHOLD) {
      const segmentKey = `${hunkKey}-segment-${segmentIndex}`;
      const expanded = expansionState[segmentKey] === true;
      const hiddenCount = run.length - CONTEXT_HEAD - CONTEXT_TAIL;

      if (expanded) {
        for (let rowIndex = index; rowIndex < end; rowIndex += 1) {
          const expandedRow = hunk.rows[rowIndex];
          if (expandedRow) {
            rows.push(<UnifiedRow key={`${hunkKey}-row-${rowIndex}`} row={expandedRow} />);
          }
        }
      } else {
        for (let rowIndex = index; rowIndex < index + CONTEXT_HEAD; rowIndex += 1) {
          const headRow = hunk.rows[rowIndex];
          if (headRow) {
            rows.push(<UnifiedRow key={`${hunkKey}-row-${rowIndex}`} row={headRow} />);
          }
        }

        rows.push(
          <button
            className="expand-button"
            key={`${segmentKey}-button`}
            onClick={() =>
              setExpansionState((current) => ({
                ...current,
                [segmentKey]: true,
              }))
            }
            type="button"
          >
            Expand {hiddenCount} hidden lines
          </button>,
        );

        for (let rowIndex = end - CONTEXT_TAIL; rowIndex < end; rowIndex += 1) {
          const tailRow = hunk.rows[rowIndex];
          if (tailRow) {
            rows.push(<UnifiedRow key={`${hunkKey}-row-${rowIndex}`} row={tailRow} />);
          }
        }
      }

      segmentIndex += 1;
    } else {
      for (let rowIndex = index; rowIndex < end; rowIndex += 1) {
        const contextRow = hunk.rows[rowIndex];
        if (contextRow) {
          rows.push(<UnifiedRow key={`${hunkKey}-row-${rowIndex}`} row={contextRow} />);
        }
      }
    }

    index = end;
  }

  return (
    <div className="hunk-block" key={hunkKey}>
      <div className="hunk-header">{hunk.header}</div>
      <div className="unified-grid">{rows}</div>
    </div>
  );
}

function renderSplitHunk(hunk: DiffHunk, hunkKey: string): ReactNode {
  const rows: ReactNode[] = [];
  let pendingRemovals: DiffRow[] = [];
  let pendingAdditions: DiffRow[] = [];

  function flushPending() {
    const max = Math.max(pendingRemovals.length, pendingAdditions.length);
    for (let index = 0; index < max; index += 1) {
      rows.push(
        <SplitPair
          key={`${hunkKey}-change-${index}-${pendingRemovals[index]?.text ?? ""}-${pendingAdditions[index]?.text ?? ""}`}
          left={pendingRemovals[index]}
          right={pendingAdditions[index]}
          tone="change"
        />,
      );
    }
    pendingRemovals = [];
    pendingAdditions = [];
  }

  for (const [index, row] of hunk.rows.entries()) {
    if (row.type === "context") {
      flushPending();
      rows.push(<SplitPair key={`${hunkKey}-context-${index}`} left={row} right={row} tone="context" />);
      continue;
    }

    if (row.type === "remove") {
      pendingRemovals.push(row);
      continue;
    }

    pendingAdditions.push(row);
  }

  flushPending();

  return (
    <div className="hunk-block" key={hunkKey}>
      <div className="hunk-header">{hunk.header}</div>
      <div className="split-diff">{rows}</div>
    </div>
  );
}

function SectionBlock({
  section,
  sectionIndex,
  viewMode,
  expansionState,
  setExpansionState,
}: {
  section: FileDiffSection;
  sectionIndex: number;
  viewMode: LaunchState["viewMode"];
  expansionState: ExpansionMap;
  setExpansionState: React.Dispatch<React.SetStateAction<ExpansionMap>>;
}) {
  return (
    <div className="diff-section">
      <div className="diff-section-header">{section.label}</div>
      {section.isBinary ? (
        <div className="binary-note">{section.note ?? "Binary content cannot be rendered as text."}</div>
      ) : section.hunks.length ? (
        section.hunks.map((hunk, hunkIndex) => {
          const hunkKey = `${sectionIndex}-${hunkIndex}`;
          return viewMode === "unified"
            ? renderUnifiedHunk(hunk, hunkKey, expansionState, setExpansionState)
            : renderSplitHunk(hunk, hunkKey);
        })
      ) : (
        <pre className="diff-raw">{section.raw || "No textual diff output was produced."}</pre>
      )}
    </div>
  );
}

export function DiffPanel({ selectedFile, diff, diffState, onLoadFull, viewMode }: DiffPanelProps) {
  const [expansionStateByFile, setExpansionStateByFile] = useState<Record<string, ExpansionMap>>({});

  function setFileExpansionState(nextState: React.SetStateAction<ExpansionMap>) {
    if (!selectedFile) {
      return;
    }

    setExpansionStateByFile((current) => {
      const existing = current[selectedFile.path] ?? {};
      const resolved = typeof nextState === "function" ? nextState(existing) : nextState;

      return {
        ...current,
        [selectedFile.path]: resolved,
      };
    });
  }

  if (!selectedFile) {
    return (
      <section className="panel empty-panel">
        <h2>Select a changed file</h2>
        <p>Jotdiff loads file details on demand so large working trees stay responsive.</p>
      </section>
    );
  }

  const fileExpansionState = expansionStateByFile[selectedFile.path] ?? {};

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Diff</p>
          <h2>{selectedFile.path}</h2>
          <p className="diff-subtitle">
            +{selectedFile.additions} / -{selectedFile.deletions}
          </p>
        </div>
        <div className="topbar-meta">
          <span className={`status-badge status-${selectedFile.kind}`}>{selectedFile.kind}</span>
          {selectedFile.previousPath ? <span className="pill">from {selectedFile.previousPath}</span> : null}
        </div>
      </div>

      {diff?.sections.length ? (
        <div className="section-pills">
          {diff.sections.map((section) => (
            <span className="pill" key={`${section.source}-${section.label}`}>
              {section.label}
            </span>
          ))}
        </div>
      ) : null}

      {diffState === "loading" ? <div className="loading-panel">Loading diff...</div> : null}
      {diffState === "error" ? <div className="loading-panel">Unable to load diff for this file.</div> : null}

      {diff?.isBinary ? (
        <div className="binary-note">{diff.binaryReason ?? "This file appears to be binary or non-text."}</div>
      ) : null}

      {diff ? (
        <div className="diff-sections">
          {diff.sections.map((section, sectionIndex) => (
            <SectionBlock
              expansionState={fileExpansionState}
              key={`${section.source}-${sectionIndex}`}
              section={section}
              sectionIndex={sectionIndex}
              setExpansionState={setFileExpansionState}
              viewMode={viewMode}
            />
          ))}
        </div>
      ) : null}

      {diff?.isTruncated ? (
        <div className="truncation-note">
          <span>This diff is in preview mode to keep the UI responsive.</span>
          {diff.canLoadFull ? (
            <button className="expand-button" onClick={onLoadFull} type="button">
              Load full diff
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
