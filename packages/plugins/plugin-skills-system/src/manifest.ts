import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip.skills-system",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Skills System",
  description: "Required system plugin that manages skill candidates and promotion requests",
  author: "Paperclip",
  categories: ["automation"],
  capabilities: [
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "companySkills.read",
    "companySkills.candidates.write",
    "companySkills.promotionRequests.write",
  ],
  entrypoints: {
    worker: "./src/worker.ts",
  },
};

export default manifest;
