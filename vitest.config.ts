import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    projects: [
      "packages/db",
      "packages/adapters/codex-local",
      "packages/adapters/opencode-local",
      "packages/plugins/plugin-execution-improvement",
      "packages/plugins/plugin-skills-system",
      "server",
      "ui",
      "cli",
    ],
  },
});
