import type { Preview } from "@storybook/react-vite";
import "../src/renderer/styles/app.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "jotdiff",
      values: [
        {
          name: "jotdiff",
          value: "#0a1016",
        },
      ],
    },
  },
};

export default preview;
