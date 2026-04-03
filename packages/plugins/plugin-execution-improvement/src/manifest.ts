import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip.execution-improvement",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Execution Improvement",
  description: "Required system plugin that observes execution incidents and opens governance issues",
  author: "Paperclip",
  categories: ["automation"],
  capabilities: [
    "events.subscribe",
    "events.emit",
    "plugin.state.read",
    "plugin.state.write",
    "systemIssues.read",
    "systemIssues.create",
    "systemIssues.recommendBlock",
  ],
  entrypoints: {
    worker: "./src/worker.ts",
  },
};

export default manifest;
