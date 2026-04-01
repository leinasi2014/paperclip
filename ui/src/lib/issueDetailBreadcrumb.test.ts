import { describe, expect, it } from "vitest";
import {
  createIssueDetailLocationState,
  createIssueDetailPath,
  readIssueDetailBreadcrumb,
} from "./issueDetailBreadcrumb";

describe("issueDetailBreadcrumb", () => {
  it("prefers the full breadcrumb from route state", () => {
    const state = createIssueDetailLocationState("Inbox", "/inbox/mine", "inbox");

    expect(readIssueDetailBreadcrumb(state, "?from=issues")).toEqual({
      label: "Inbox",
      href: "/inbox/mine",
    });
  });

  it("uses the current localized label when the source is still known from route state", () => {
    const state = createIssueDetailLocationState("Issues", "/issues/all", "issues");

    expect(
      readIssueDetailBreadcrumb(state, undefined, {
        issues: "议题",
        inbox: "收件箱",
      }),
    ).toEqual({
      label: "议题",
      href: "/issues/all",
    });
  });

  it("falls back to the source query param when route state is unavailable", () => {
    expect(readIssueDetailBreadcrumb(null, "?from=inbox")).toEqual({
      label: "Inbox",
      href: "/inbox",
    });
  });

  it("supports localized fallback labels when route state is unavailable", () => {
    expect(
      readIssueDetailBreadcrumb(null, "?from=issues", {
        issues: "议题",
        inbox: "收件箱",
      }),
    ).toEqual({
      label: "议题",
      href: "/issues",
    });

    expect(
      readIssueDetailBreadcrumb(null, "?from=inbox", {
        issues: "议题",
        inbox: "收件箱",
      }),
    ).toEqual({
      label: "收件箱",
      href: "/inbox",
    });
  });

  it("adds the source query param when building an issue detail path", () => {
    const state = createIssueDetailLocationState("Inbox", "/inbox/mine", "inbox");

    expect(createIssueDetailPath("PAP-465", state)).toBe("/issues/PAP-465?from=inbox");
  });

  it("reuses the current source query param when state has been dropped", () => {
    expect(createIssueDetailPath("PAP-465", null, "?from=issues")).toBe("/issues/PAP-465?from=issues");
  });
});
