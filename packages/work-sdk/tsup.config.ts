import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    github: "src/github.ts",
    linear: "src/linear.ts",
    jira: "src/jira.ts",
    testing: "src/testing.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: "node20",
});
