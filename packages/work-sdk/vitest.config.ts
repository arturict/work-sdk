import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // Provider adapters have their own protocol-focused suites. These global
      // thresholds intentionally measure the dependency-free core only, so a
      // newly added adapter cannot make the fast core coverage gate misleading.
      include: ["src/{client,errors,http,internal,store}.ts"],
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 75 },
    },
  },
});
