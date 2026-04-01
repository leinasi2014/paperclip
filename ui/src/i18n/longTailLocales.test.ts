import { describe, expect, it } from "vitest";
import { PLUGIN_STATUSES } from "@paperclipai/shared";
import { INVITE_DIAGNOSTIC_CODES } from "./inviteDiagnostics";
import { resources } from "./resources";

describe("long-tail i18n resources", () => {
  it("covers invite, inbox, settings, plugins, and not found fallbacks", () => {
    const enPluginStates = resources.en.plugins.states as Record<string, string>;
    const zhPluginStates = resources["zh-CN"].plugins.states as Record<string, string>;
    const enInviteDiagnostics = resources.en.auth.invite.diagnostics as Record<string, { message: string }>;
    const zhInviteDiagnostics = resources["zh-CN"].auth.invite.diagnostics as Record<string, { message: string }>;

    expect(resources.en.auth.invite.adapters).toMatchObject({
      claude_local: "Claude (local)",
      codex_local: "Codex (local)",
      gemini_local: "Gemini CLI (local)",
      opencode_local: "OpenCode (local)",
      pi_local: "Pi (local)",
      openclaw_gateway: "OpenClaw Gateway",
      cursor: "Cursor (local)",
      hermes_local: "Hermes Agent",
      process: "Process",
      http: "HTTP",
    });
    expect(resources["zh-CN"].auth.invite.adapters).toMatchObject({
      claude_local: "Claude（本地）",
      codex_local: "Codex（本地）",
      gemini_local: "Gemini CLI（本地）",
      opencode_local: "OpenCode（本地）",
      pi_local: "Pi（本地）",
      openclaw_gateway: "OpenClaw Gateway",
      cursor: "Cursor（本地）",
      hermes_local: "Hermes Agent",
      process: "进程",
      http: "HTTP",
    });

    expect(resources.en.auth.invite.errors).toMatchObject({
      notFound: "Invite not found.",
      acceptFailed: "Failed to accept invite.",
    });
    expect(resources["zh-CN"].auth.invite.errors).toMatchObject({
      notFound: "未找到邀请。",
      acceptFailed: "接受邀请失败。",
    });
    expect(resources.en.auth.invite.installTo).toBe("Install to {{path}}");
    expect(resources["zh-CN"].auth.invite.installTo).toBe("安装到 {{path}}");
    for (const code of INVITE_DIAGNOSTIC_CODES) {
      expect(enInviteDiagnostics[code]).toHaveProperty("message");
      expect(zhInviteDiagnostics[code]).toHaveProperty("message");
    }

    expect(resources.en.inbox.rows).toMatchObject({
      commented: "commented {{time}}",
      updated: "updated {{time}}",
    });
    expect(resources["zh-CN"].inbox.rows).toMatchObject({
      commented: "于 {{time}} 留言",
      updated: "更新于 {{time}}",
    });

    expect(resources.en.settings.errors).toMatchObject({
      unknown: "Unknown error",
    });
    expect(resources["zh-CN"].settings.errors).toMatchObject({
      unknown: "未知错误",
    });
    expect(resources.en.settings.states.never).toBe("never");
    expect(resources["zh-CN"].settings.states.never).toBe("从未");

    expect(resources.en.plugins.breadcrumbs.company).toBe("Company");
    expect(resources["zh-CN"].plugins.breadcrumbs.company).toBe("公司");
    expect(resources.en.plugins.labels.plugin).toBe("Plugin");
    expect(resources["zh-CN"].plugins.labels.plugin).toBe("插件");
    for (const status of PLUGIN_STATUSES) {
      expect(enPluginStates[status]).toBeTypeOf("string");
      expect(zhPluginStates[status]).toBeTypeOf("string");
    }

    expect(resources.en.notFound.labels.unknownPrefix).toBe("unknown");
    expect(resources["zh-CN"].notFound.labels.unknownPrefix).toBe("未知");
  });
});
