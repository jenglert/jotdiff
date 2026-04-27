import type { Meta, StoryObj } from "@storybook/react-vite";
import { NonRepoState } from "./NonRepoState";

const meta = {
  title: "Jotdiff/NonRepoState",
  component: NonRepoState,
  args: {
    cwd: "C:\\Users\\engle\\Desktop\\scratch",
    message: "Jotdiff currently works only inside git working trees.",
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof NonRepoState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
