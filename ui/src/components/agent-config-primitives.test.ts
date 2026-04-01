// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { adapterLabels, getAgentAdapterLabel } from "./agent-config-primitives";

describe("agent-config-primitives", () => {
  it("keeps unknown adapter labels undefined so callers can preserve their own fallback", () => {
    expect((adapterLabels as Record<string, string | undefined>).custom_adapter).toBeUndefined();
  });

  it("supports compact overview adapter aliases", () => {
    expect((getAgentAdapterLabel as unknown as (type: string, language: string, options?: { compact?: boolean }) => string | undefined)(
      "claude_local",
      "en",
      { compact: true },
    )).toBe("Claude");
  });
});
