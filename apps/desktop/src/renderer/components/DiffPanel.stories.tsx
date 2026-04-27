import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiffPanel } from "./DiffPanel";

const baseFile = {
  path: "src/renderer/App.tsx",
  kind: "modified" as const,
  x: " ",
  y: "M",
  hasStagedChanges: false,
  hasUnstagedChanges: true,
  isUntracked: false,
  unstagedStatus: "modified",
  additions: 2,
  deletions: 1,
  stagedAdditions: 0,
  stagedDeletions: 0,
  unstagedAdditions: 2,
  unstagedDeletions: 1,
};

const unifiedDiff = {
  path: "src/renderer/App.tsx",
  mode: "unified" as const,
  isTruncated: false,
  isBinary: false,
  isFull: false,
  canLoadFull: false,
  raw: `diff --git a/src/renderer/App.tsx b/src/renderer/App.tsx
index 1111111..2222222 100644
--- a/src/renderer/App.tsx
+++ b/src/renderer/App.tsx
@@ -10,6 +10,8 @@ export function App() {
   return (
     <div className="app-shell">
+      <header className="topbar">Jotdiff</header>
       <main>
-        <OldPanel />
+        <NewPanel />
       </main>
     </div>
   );`,
  lines: [
    { type: "meta" as const, left: "diff --git a/src/renderer/App.tsx b/src/renderer/App.tsx", right: "diff --git a/src/renderer/App.tsx b/src/renderer/App.tsx" },
    { type: "context" as const, left: "return (", right: "return (" },
    { type: "add" as const, right: '  <header className="topbar">Jotdiff</header>' },
    { type: "context" as const, left: "  <main>", right: "  <main>" },
    { type: "remove" as const, left: "    <OldPanel />" },
    { type: "add" as const, right: "    <NewPanel />" },
  ],
  sections: [
    {
      label: "Unstaged changes",
      source: "unstaged" as const,
      raw: `diff --git a/src/renderer/App.tsx b/src/renderer/App.tsx
index 1111111..2222222 100644
--- a/src/renderer/App.tsx
+++ b/src/renderer/App.tsx
@@ -10,6 +10,8 @@ export function App() {`,
      hunks: [
        {
          header: "@@ -10,6 +10,8 @@ export function App() {",
          rows: [
            { type: "context" as const, text: "  return (", leftLineNumber: 10, rightLineNumber: 10 },
            { type: "context" as const, text: '    <div className="app-shell">', leftLineNumber: 11, rightLineNumber: 11 },
            { type: "add" as const, text: '      <header className="topbar">Jotdiff</header>', rightLineNumber: 12 },
            { type: "context" as const, text: "      <main>", leftLineNumber: 12, rightLineNumber: 13 },
            { type: "remove" as const, text: "        <OldPanel />", leftLineNumber: 13 },
            { type: "add" as const, text: "        <NewPanel />", rightLineNumber: 14 },
            { type: "context" as const, text: "      </main>", leftLineNumber: 14, rightLineNumber: 15 },
          ],
        },
      ],
    },
  ],
};

const meta = {
  title: "Jotdiff/DiffPanel",
  component: DiffPanel,
  args: {
    selectedFile: baseFile,
    diff: unifiedDiff,
    diffState: "ready",
    onLoadFull: () => {},
    viewMode: "unified",
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof DiffPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unified: Story = {};

export const Split: Story = {
  args: {
    viewMode: "split",
    diff: {
      ...unifiedDiff,
      mode: "split",
    },
  },
};

export const Loading: Story = {
  args: {
    diff: null,
    diffState: "loading",
  },
};

export const Truncated: Story = {
  args: {
    diff: {
      ...unifiedDiff,
      isTruncated: true,
      canLoadFull: true,
    },
  },
};

export const Binary: Story = {
  args: {
    diff: {
      ...unifiedDiff,
      isBinary: true,
      binaryReason: "This file appears to be binary or non-text.",
      sections: [
        {
          label: "Unstaged changes",
          source: "unstaged",
          raw: "",
          hunks: [],
          isBinary: true,
          note: "Binary content cannot be rendered as text.",
        },
      ],
    },
  },
};

export const Empty: Story = {
  args: {
    selectedFile: null,
    diff: null,
    diffState: "idle",
  },
};
