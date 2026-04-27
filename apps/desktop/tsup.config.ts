import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "src/main/index.ts",
    preload: "src/preload/index.ts",
  },
  format: ["cjs"],
  outDir: "dist-electron",
  target: "node20",
  external: ["electron"],
  clean: true,
  sourcemap: true,
});
