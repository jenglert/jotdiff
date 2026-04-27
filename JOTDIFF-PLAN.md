# Jotdiff Build Plan

## Product Goal

Build `Jotdiff` as a React Native desktop application that can also be launched from the command line to open a visual diff session for files in the current working folder.

The product should feel close to GitHub's diff experience, but be optimized for data in git:

- vibrant, modern desktop UI
- file list + diff panes similar to GitHub review
- aware of `.gitignore`
- performant for large repos and very large diffs
- supports truncation and explicit expansion for oversized diffs
- eventually supports semantic/data-aware diffing for JSON, CSV, YAML, and similar formats

## Primary User Experience

### CLI entry

The user runs a command such as:

```bash
jotdiff
```

from any git working tree.

Expected behavior:

1. detect the current repository from the current folder
2. collect changed files using git-aware logic
3. respect `.gitignore` and avoid showing ignored files by default
4. launch the desktop app
5. open directly into a diff session for the current repo/folder context

### Initial app flow

On launch, the app should:

1. detect repo root and current working directory
2. gather diff metadata
3. show a loading state for large repos
4. render:
   - left sidebar with changed files
   - summary header with counts
   - main diff viewer
   - filters for file type / change type

### Visual target

The UI should borrow from GitHub diff review:

- split file list and content panel
- colored add/remove/change indicators
- expandable file sections
- sticky summary header
- syntax-aware diff blocks where possible

But it should not look like a weak clone. It should feel more vivid:

- richer accent colors
- stronger file badges
- cleaner typography hierarchy
- better empty/loading states
- more obvious overflow / truncation affordances

## Platform And Tech Direction

### Desktop app shell

Use React Native desktop:

- `react-native-windows` as the primary shipping target
- optionally keep architecture compatible with `react-native-macos` later

### CLI launcher

Use a small Node-based CLI that:

1. resolves the current working directory
2. resolves repo root
3. computes or requests diff metadata
4. launches the desktop app with arguments or IPC payload

### Core stack

- TypeScript throughout
- React Native for UI
- Node process for CLI and git access
- local structured diff engine shared between CLI and app

## Architecture

Split the system into 4 layers.

### 1. Repository discovery layer

Responsibilities:

- detect git repo root
- detect current folder scope
- read `.gitignore` behavior through git, not by hand-rolling ignore logic only
- enumerate changed files
- decide default comparison range

Recommended commands:

- `git rev-parse --show-toplevel`
- `git status --porcelain=v1`
- `git diff --name-only`
- `git diff --cached --name-only`
- `git ls-files --others --exclude-standard`

Important rule:

Prefer asking git for file state over reimplementing git semantics.

### 2. Diff data layer

Responsibilities:

- load file contents for compared revisions
- classify file types
- compute line diff or structured diff
- compute file-level summary stats
- compute truncation segments for large diffs

Core data model should include:

- repo metadata
- compared refs / modes
- file change entries
- per-file diff hunks
- per-file render policy
- truncation/expansion metadata

### 3. Performance and paging layer

Responsibilities:

- cap initial render work
- chunk large file diffs
- virtualize file list and diff blocks
- support "show more" and "expand all hidden lines"

This layer is critical.

### 4. Presentation layer

Responsibilities:

- GitHub-like review interface
- filters, keyboard navigation, file search
- diff presentation modes
- expand/collapse controls

## Launch Modes

Support these modes in phases.

### Phase 1

```bash
jotdiff
```

Meaning:

- open diffs for the current repo, scoped to working tree changes

### Phase 2

```bash
jotdiff --staged
jotdiff --unstaged
jotdiff --head HEAD~1
jotdiff --range main...feature
jotdiff --path data/
```

### Phase 3

```bash
jotdiff file old.json new.json
jotdiff repo C:\path\to\repo --range main...feature
```

## Diff Modes

### Phase 1: text-first

Support:

- unified line diffs
- split view rendering
- syntax highlighting where practical

### Phase 2: data-aware

Support semantic diffs for:

- JSON objects
- JSON arrays of keyed objects
- CSV / TSV
- YAML

### Phase 3: configurable identity

Allow path-based rules for:

- record keys
- ignored fields
- field order normalization
- array matching behavior

## Handling Large Diffs

This is a core product requirement.

### Problem categories

1. too many changed files
2. a single file diff that is too large
3. files with huge unchanged gaps
4. giant machine-generated text blobs
5. structured files with deeply nested changes

### Required strategies

#### File count scaling

- virtualized sidebar
- group files by folder
- lazy-load file diff data
- default-open only the selected file

#### Large file scaling

- limit initial hunk rendering
- collapse large unchanged sections
- show "Expand N hidden lines"
- show "Load full diff" for very large files
- hard cap rendering for pathological files

#### Huge diff protection

For oversized diffs:

- show warning banner
- render summary first
- let user explicitly expand
- avoid freezing the UI by precomputing display slices

### Suggested thresholds

Initial thresholds to tune later:

- more than 200 changed files: switch to summary-first mode
- more than 2,000 visible changed lines in a file: collapse aggressively
- more than 20,000 changed lines in a file: metadata-first + explicit full expansion
- more than 1 MB text blob: render preview mode first

These should be configurable.

## Expand / Collapse UX

Every large diff should support progressive reveal.

### Controls

- `Expand hidden lines`
- `Show more context`
- `Load full file diff`
- `Collapse unchanged sections`
- `Expand all in file`

### Behavior

- preserve scroll position when expanding
- avoid rerendering the whole diff if only one segment expands
- make expansion state per-file and stable during the session

## Git Ignore And File Selection Rules

The app should not surface ignored junk by default.

Rules:

- use git-native commands to avoid manual ignore mistakes
- show tracked modified files
- show staged files
- show untracked non-ignored files
- hide ignored files unless the user explicitly asks to see them

Optional later:

- toggle `Show ignored`
- toggle `Show only current-folder scope`

## UI Structure

### App shell

- top header
- repository summary bar
- left file navigator
- center diff panel
- right optional inspector later

### Header

Show:

- repo name
- current scope
- comparison mode
- changed file count
- added/removed line totals
- search box

### File navigator

Per file row:

- path
- change type badge
- added/removed counts
- file type badge
- truncation indicator if partially loaded

### Diff panel

Per file section:

- file header
- metadata row
- collapse/expand actions
- diff hunks
- hidden-section expansion controls

## Visual Design Direction

### Core look

- inspired by GitHub diff review
- brighter palette
- cleaner spacing
- less gray wash

### Suggested design traits

- deep slate base neutrals
- strong green/red/blue accents
- warm highlights for selected file
- sharp but not harsh borders
- mild gradients in headers/toolbars

### Typography

- code: highly legible mono font
- UI: clean sans font with stronger hierarchy than GitHub

### Motion

- smooth expansion of hidden sections
- subtle file-selection transitions
- no heavy animation during large-list scrolling

## Data Diff Evolution

The first version can ship with text diffs, but the long-term product value is semantic data diffing.

### Phase 1

- line-oriented diff only

### Phase 2

- JSON-aware compare
- CSV row-aware compare
- reorder suppression where identity is available

### Phase 3

- user config file, for example `jotdiff.config.json`

Possible config:

```json
{
  "rules": [
    {
      "match": "data/users.csv",
      "format": "csv",
      "key": ["user_id"],
      "ignoreFields": ["updated_at"]
    },
    {
      "match": "configs/*.json",
      "format": "json",
      "arrayIdentity": {
        "$.services": ["name"]
      }
    }
  ]
}
```

## Proposed Repository Structure

```text
jotdiff/
  apps/
    desktop/
    cli/
  packages/
    git-core/
    diff-core/
    ui-model/
    config/
  docs/
    architecture/
    ui/
```

## Milestones

### Milestone 1: foundation

- choose React Native Windows app structure
- stand up desktop shell
- stand up CLI
- establish IPC or launch-arg contract

Deliverable:

- `jotdiff` launches the desktop shell for the current repo

### Milestone 2: git-backed file list

- repo detection
- changed-file enumeration
- `.gitignore`-aware file inclusion
- sidebar rendering

Deliverable:

- app opens and shows changed files for the current repo

### Milestone 3: basic diff viewer

- load file content pairs
- render line-based diff
- GitHub-like file panel layout

Deliverable:

- view diffs for changed files in desktop UI

### Milestone 4: large diff controls

- truncation model
- hidden section rendering
- expand buttons
- virtualized lists

Deliverable:

- app stays responsive on large diffs

### Milestone 5: polish

- vibrant visual theme
- keyboard navigation
- search/filter
- session state

Deliverable:

- credible daily-use diff viewer

### Milestone 6: semantic data diff v1

- JSON-aware matching
- CSV row-key matching
- config support

Deliverable:

- product meaningfully exceeds plain text diff for data files

## Risks

### 1. React Native desktop complexity

Risk:

- desktop packaging and native integration can slow iteration

Mitigation:

- keep business logic in plain TypeScript packages
- keep UI shell thin

### 2. Git process edge cases

Risk:

- submodules, huge repos, odd repo states

Mitigation:

- start with ordinary working tree diffs
- define unsupported cases explicitly

### 3. Rendering cost

Risk:

- giant diffs can freeze JS/UI thread

Mitigation:

- pre-chunk diff output
- virtualize aggressively
- explicit expansion for large sections

### 4. Semantic diff complexity

Risk:

- JSON/CSV matching logic becomes the whole product

Mitigation:

- ship text-first
- build normalized diff core incrementally

## Immediate Next Steps

1. Pick the monorepo layout and tooling.
2. Decide CLI-to-app launch contract.
3. Define the `DiffSession` JSON schema.
4. Build Milestone 1 desktop shell and CLI launcher.
5. Build file enumeration with git-aware filtering before any visual polish.

## Recommended First Commands

Target shape for early local usage:

```bash
jotdiff
jotdiff --staged
jotdiff --path .
```

The first success criterion is:

Running `jotdiff` from a repo opens the app and displays a stable, `.gitignore`-aware changed-file list for the current working tree.

