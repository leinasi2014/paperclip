import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip.board-assistant-wechat",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Board Assistant WeChat",
  description: "WeChat channel adapter for the instance-level Board Assistant",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "plugin.state.read",
    "plugin.state.write",
    "jobs.schedule",
    "http.outbound",
    "secrets.read-ref",
    "activity.log.write",
    "metrics.write",
  ],
  entrypoints: {
    worker: "./src/worker.ts",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      enabled: {
        type: "boolean",
        title: "Enable WeChat Channel",
        default: false,
      },
      paperclipBaseUrl: {
        type: "string",
        title: "Paperclip Base URL",
        default: "http://127.0.0.1:3100",
      },
      channelSecretRef: {
        type: "string",
        title: "Channel Secret Ref",
      },
      botTokenSecretRef: {
        type: "string",
        title: "Bot Token Secret Ref",
      },
      ilinkBaseUrl: {
        type: "string",
        title: "iLink Base URL",
        default: "https://ilinkai.weixin.qq.com",
      },
      enableQrLogin: {
        type: "boolean",
        title: "Enable QR Login Bootstrap",
        default: true,
      },
      longPollTimeoutMs: {
        type: "integer",
        title: "Long Poll Timeout",
        default: 35000,
      },
      apiTimeoutMs: {
        type: "integer",
        title: "API Timeout",
        default: 15000,
      },
    },
  },
  jobs: [
    {
      jobKey: "sync",
      displayName: "WeChat Sync",
      description: "Poll inbound WeChat messages and flush Board Assistant outbox items.",
      schedule: "* * * * *",
    },
  ],
};

export default manifest;
