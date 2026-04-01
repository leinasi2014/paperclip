import { describe, expect, it } from "vitest";
import { formatRelativeTime, formatUsdCents } from "./formatters";
import { getAgentRoleLabel } from "./label-helpers";

describe("formatters", () => {
  it("formats USD cents in en locale", () => {
    expect(formatUsdCents(123456, "en")).toBe("$1,234.56");
  });

  it("formats USD cents in zh-CN locale", () => {
    expect(formatUsdCents(123456, "zh-CN")).toContain("1,234.56");
  });

  it("formats relative time in zh-CN locale", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinutesAgo, "zh-CN")).toBe("5分钟前");
  });

  it("formats 1 day ago as numeric text instead of lexical text", () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(oneDayAgo, "en")).toBe("1 day ago");
  });
});

describe("label helpers", () => {
  it("returns role label for ceo in en", () => {
    expect(getAgentRoleLabel("ceo", "en")).toBe("CEO");
  });

  it("returns original input for unknown role fallback", () => {
    expect(getAgentRoleLabel("unknown_role", "en")).toBe("unknown_role");
  });
});
