import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useTranslationMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => useTranslationMock(),
}));

import { normalizeAppLanguage, useAppLocale } from "./useAppLocale";
import { resources } from "./resources";
import { checkUiI18nCoverage } from "./checkUiI18nCoverage";

beforeEach(() => {
  useTranslationMock.mockReset();
});

describe("normalizeAppLanguage", () => {
  it("normalizes zh to zh-CN", () => {
    expect(normalizeAppLanguage("zh")).toBe("zh-CN");
  });

  it("keeps zh-CN as zh-CN", () => {
    expect(normalizeAppLanguage("zh-CN")).toBe("zh-CN");
  });

  it("normalizes en-US to en", () => {
    expect(normalizeAppLanguage("en-US")).toBe("en");
  });

  it("falls back fr to en", () => {
    expect(normalizeAppLanguage("fr")).toBe("en");
  });
});

describe("useAppLocale", () => {
  it("uses resolvedLanguage first and normalizes to supported app language", () => {
    const changeLanguage = vi.fn();
    useTranslationMock.mockReturnValue({
      i18n: {
        resolvedLanguage: "zh",
        language: "en-US",
        changeLanguage,
      },
    });

    const { language } = useAppLocale();

    expect(language).toBe("zh-CN");
  });

  it("falls back to i18n.language and normalizes before forwarding to changeLanguage", () => {
    const changeLanguage = vi.fn();
    useTranslationMock.mockReturnValue({
      i18n: {
        resolvedLanguage: undefined,
        language: "en-US",
        changeLanguage,
      },
    });

    const { language, setLanguage } = useAppLocale();
    setLanguage("zh");

    expect(language).toBe("en");
    expect(changeLanguage).toHaveBeenCalledTimes(1);
    expect(changeLanguage).toHaveBeenCalledWith("zh-CN");
  });
});

describe("checkUiI18nCoverage", () => {
  it("fails when zh-CN is missing an english key", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "paperclip-i18n-"));
    const enDir = path.join(root, "ui", "src", "i18n", "locales", "en");
    const zhDir = path.join(root, "ui", "src", "i18n", "locales", "zh-CN");
    mkdirSync(enDir, { recursive: true });
    mkdirSync(zhDir, { recursive: true });

    writeFileSync(
      path.join(enDir, "auth.json"),
      JSON.stringify(
        {
          pages: {
            auth: {
              title: "Sign in",
              subtitle: "Use your email and password.",
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(zhDir, "auth.json"),
      JSON.stringify(
        {
          pages: {
            auth: {
              title: "登录",
            },
          },
        },
        null,
        2,
      ),
    );

    const errors: string[] = [];
    const logs: string[] = [];
    const exitCode = checkUiI18nCoverage({
      repoRoot: root,
      log: (message: string) => logs.push(message),
      error: (message: string) => errors.push(message),
    });

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("subtitle");
    expect(logs.join("\n")).toContain("coverage");
  });
});

describe("inbox locale resources", () => {
  it("includes translated inbox error labels and breadcrumb text", () => {
    expect(resources.en.inbox.errors).toMatchObject({
      approve: "Approval failed.",
      reject: "Rejection failed.",
      approveJoinRequest: "Join request approval failed.",
      rejectJoinRequest: "Join request rejection failed.",
      retrySkipped: "Retry skipped.",
      archiveIssue: "Archive failed.",
    });
    expect(resources["zh-CN"].inbox.errors).toMatchObject({
      approve: "审批失败。",
      reject: "拒绝失败。",
      approveJoinRequest: "加入请求审批失败。",
      rejectJoinRequest: "加入请求拒绝失败。",
      retrySkipped: "重试已跳过。",
      archiveIssue: "归档失败。",
    });
    expect(resources.en.inbox.breadcrumb).toBe("Inbox");
    expect(resources["zh-CN"].inbox.breadcrumb).toBe("收件箱");
  });
});
