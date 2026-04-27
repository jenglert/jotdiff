import { useEffect, useState } from "react";
import type { AppSession, ChangeFilters, FileDiff, LaunchState } from "@jotdiff/shared-types";
import { DiffPanel } from "./components/DiffPanel";
import { FileList } from "./components/FileList";
import { NonRepoState } from "./components/NonRepoState";

type LoadingState = "idle" | "loading" | "ready" | "error";

function copyFilters(filters: ChangeFilters): ChangeFilters {
  return { ...filters };
}

export function App() {
  const [launchState, setLaunchState] = useState<LaunchState | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [state, setState] = useState<LoadingState>("idle");
  const [diffState, setDiffState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fullDiffsByPath, setFullDiffsByPath] = useState<Record<string, boolean>>({});

  async function refresh(nextLaunchState?: Partial<LaunchState>) {
    setState("loading");
    setError(null);

    try {
      const nextSession = await window.jotdiff.loadSession(nextLaunchState);
      setSession(nextSession);
      setState("ready");

      if (nextLaunchState) {
        setLaunchState((current) => {
          if (!current) {
            return {
              cwd: nextLaunchState.cwd ?? "",
              pathScope: nextLaunchState.pathScope,
              viewMode: nextLaunchState.viewMode ?? "unified",
              filters: {
                staged: nextLaunchState.filters?.staged ?? true,
                unstaged: nextLaunchState.filters?.unstaged ?? true,
                untracked: nextLaunchState.filters?.untracked ?? true,
              },
            };
          }

          return {
            ...current,
            ...nextLaunchState,
            filters: {
              ...current.filters,
              ...nextLaunchState.filters,
            },
          };
        });
      }

      if (nextSession.kind === "repo") {
        const nextSelected =
          nextSession.files.find((file) => file.path === selectedPath)?.path ??
          nextSession.files[0]?.path ??
          null;
        setSelectedPath(nextSelected);
      } else {
        setSelectedPath(null);
      }
    } catch (caughtError) {
      setState("error");
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load session.");
    }
  }

  useEffect(() => {
    window.jotdiff
      .getLaunchState()
      .then((initialLaunchState) => {
        setLaunchState(initialLaunchState);
        return refresh(initialLaunchState);
      })
      .catch((caughtError) => {
        setState("error");
        setError(caughtError instanceof Error ? caughtError.message : "Failed to start app.");
      });
  }, []);

  useEffect(() => {
    if (!selectedPath || !launchState || session?.kind !== "repo") {
      setDiff(null);
      return;
    }

    setDiffState("loading");
    window.jotdiff
      .loadDiff(selectedPath, launchState.viewMode, { full: fullDiffsByPath[selectedPath] === true })
      .then((nextDiff) => {
        setDiff(nextDiff);
        setDiffState("ready");
      })
      .catch(() => {
        setDiffState("error");
      });
  }, [fullDiffsByPath, launchState, selectedPath, session?.kind]);

  function toggleFilter(key: keyof ChangeFilters) {
    if (!launchState) {
      return;
    }

    const nextFilters = copyFilters(launchState.filters);
    nextFilters[key] = !nextFilters[key];
    void refresh({ filters: nextFilters });
  }

  function setViewMode(viewMode: LaunchState["viewMode"]) {
    if (!launchState || launchState.viewMode === viewMode) {
      return;
    }

    setLaunchState({ ...launchState, viewMode });
  }

  function requestFullDiff() {
    if (!selectedPath) {
      return;
    }

    setFullDiffsByPath((current) => ({
      ...current,
      [selectedPath]: true,
    }));
  }

  const selectedFile =
    session?.kind === "repo"
      ? session.files.find((file) => file.path === selectedPath) ?? null
      : null;

  const visibleFiles =
    session?.kind === "repo"
      ? session.files.filter((file) => {
          const query = searchQuery.trim().toLowerCase();
          if (!query) {
            return true;
          }

          return (
            file.path.toLowerCase().includes(query) ||
            file.previousPath?.toLowerCase().includes(query) === true
          );
        })
      : [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">Jotdiff</span>
          <h1>{session?.kind === "repo" ? session.repo.repoName : "No repository detected"}</h1>
        </div>
        <div className="topbar-meta">
          {launchState && (
            <>
              <span className="pill">{launchState.cwd}</span>
              {launchState.pathScope ? <span className="pill">scope: {launchState.pathScope}</span> : null}
            </>
          )}
        </div>
      </header>

      {state === "error" ? <div className="error-banner">{error}</div> : null}

      {session?.kind === "non-repo" ? (
        <NonRepoState message={session.message} cwd={session.cwd} />
      ) : null}

      {session?.kind === "repo" ? (
        <div className="workspace">
          <aside className="sidebar">
            <section className="summary-card">
              <h2>Working tree</h2>
              <div className="summary-grid">
                <div>
                  <span>Files</span>
                  <strong>{session.summary.totalFiles}</strong>
                </div>
                <div>
                  <span>Staged</span>
                  <strong>{session.summary.stagedFiles}</strong>
                </div>
                <div>
                  <span>Unstaged</span>
                  <strong>{session.summary.unstagedFiles}</strong>
                </div>
                <div>
                  <span>Untracked</span>
                  <strong>{session.summary.untrackedFiles}</strong>
                </div>
                <div>
                  <span>Additions</span>
                  <strong>+{session.summary.additions}</strong>
                </div>
                <div>
                  <span>Deletions</span>
                  <strong>-{session.summary.deletions}</strong>
                </div>
              </div>
            </section>

            <section className="control-card">
              <div className="control-row">
                <span>Show</span>
                <div className="toggle-group">
                  <button
                    className={launchState?.filters.staged ? "toggle active" : "toggle"}
                    onClick={() => toggleFilter("staged")}
                    type="button"
                  >
                    Staged
                  </button>
                  <button
                    className={launchState?.filters.unstaged ? "toggle active" : "toggle"}
                    onClick={() => toggleFilter("unstaged")}
                    type="button"
                  >
                    Unstaged
                  </button>
                  <button
                    className={launchState?.filters.untracked ? "toggle active" : "toggle"}
                    onClick={() => toggleFilter("untracked")}
                    type="button"
                  >
                    Untracked
                  </button>
                </div>
              </div>
              <div className="control-row">
                <span>View</span>
                <div className="toggle-group">
                  <button
                    className={launchState?.viewMode === "unified" ? "toggle active" : "toggle"}
                    onClick={() => setViewMode("unified")}
                    type="button"
                  >
                    Unified
                  </button>
                  <button
                    className={launchState?.viewMode === "split" ? "toggle active" : "toggle"}
                    onClick={() => setViewMode("split")}
                    type="button"
                  >
                    Split
                  </button>
                </div>
              </div>
            </section>

            <FileList
              files={visibleFiles}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              onSearchChange={setSearchQuery}
              searchValue={searchQuery}
            />
          </aside>

          <main className="content">
            <DiffPanel
              diff={diff}
              diffState={diffState}
              onLoadFull={requestFullDiff}
              selectedFile={selectedFile}
              viewMode={launchState?.viewMode ?? "unified"}
            />
          </main>
        </div>
      ) : null}

      {state === "loading" && !session ? <div className="loading-screen">Loading repository...</div> : null}
    </div>
  );
}
