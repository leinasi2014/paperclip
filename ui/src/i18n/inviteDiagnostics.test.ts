import { describe, expect, it } from "vitest";
import { formatInviteDiagnostic } from "./inviteDiagnostics";

describe("formatInviteDiagnostic", () => {
  it("maps known diagnostics to localized keys instead of server text", () => {
    const t = (key: string) => key;
    const result = formatInviteDiagnostic(
      {
        code: "openclaw_gateway_url_missing",
        level: "warn",
        message: "OpenClaw gateway URL is missing.",
        hint: "Set agentDefaultsPayload.url to ws:// or wss:// gateway URL.",
      },
      t,
    );

    expect(result).toEqual({
      message: "invite.diagnostics.openclaw_gateway_url_missing.message",
      hint: "invite.diagnostics.openclaw_gateway_url_missing.hint",
    });
  });

  it("falls back to the server text for unknown diagnostics", () => {
    const t = (key: string) => key;
    const result = formatInviteDiagnostic(
      {
        code: "future_code_not_yet_localized",
        level: "info",
        message: "Server-side English message",
        hint: "Server-side English hint",
      },
      t,
    );

    expect(result).toEqual({
      message: "Server-side English message",
      hint: "Server-side English hint",
    });
  });
});
