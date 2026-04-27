import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileList } from "./FileList";

const meta = {
  title: "Jotdiff/FileList",
  component: FileList,
  args: {
    selectedPath: "src/renderer/App.tsx",
    onSelect: () => {},
    searchValue: "",
    onSearchChange: () => {},
    files: [
      {
        path: "src/renderer/App.tsx",
        kind: "modified",
        x: "M",
        y: " ",
        hasStagedChanges: true,
        hasUnstagedChanges: false,
        isUntracked: false,
        stagedStatus: "modified",
        additions: 14,
        deletions: 3,
        stagedAdditions: 14,
        stagedDeletions: 3,
        unstagedAdditions: 0,
        unstagedDeletions: 0,
      },
      {
        path: "src/renderer/components/FileList.tsx",
        kind: "modified",
        x: " ",
        y: "M",
        hasStagedChanges: false,
        hasUnstagedChanges: true,
        isUntracked: false,
        unstagedStatus: "modified",
        additions: 8,
        deletions: 2,
        stagedAdditions: 0,
        stagedDeletions: 0,
        unstagedAdditions: 8,
        unstagedDeletions: 2,
      },
      {
        path: "src/renderer/components/NewPanel.tsx",
        kind: "untracked",
        x: "?",
        y: "?",
        hasStagedChanges: false,
        hasUnstagedChanges: false,
        isUntracked: true,
        additions: 32,
        deletions: 0,
        stagedAdditions: 0,
        stagedDeletions: 0,
        unstagedAdditions: 0,
        unstagedDeletions: 0,
      },
      {
        path: "packages/diff-core/index.ts",
        previousPath: "packages/core/index.ts",
        kind: "renamed",
        x: "R",
        y: " ",
        hasStagedChanges: true,
        hasUnstagedChanges: false,
        isUntracked: false,
        stagedStatus: "renamed",
        additions: 5,
        deletions: 5,
        stagedAdditions: 5,
        stagedDeletions: 5,
        unstagedAdditions: 0,
        unstagedDeletions: 0,
      },
    ],
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FileList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    files: [],
    selectedPath: null,
  },
};
