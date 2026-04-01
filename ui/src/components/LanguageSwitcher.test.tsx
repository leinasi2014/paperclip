// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAppLocaleMock = vi.fn();
const useTranslationMock = vi.fn();

vi.mock("@/i18n/useAppLocale", () => ({
  useAppLocale: () => useAppLocaleMock(),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => useTranslationMock(),
  };
});

import { LanguageSwitcher } from "./LanguageSwitcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("LanguageSwitcher", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    useAppLocaleMock.mockReset();
    useTranslationMock.mockReset();
    useTranslationMock.mockReturnValue({
      t: (key: string) => key,
    });
  });

  afterEach(() => {
    container.remove();
  });

  it("renders language options", () => {
    useAppLocaleMock.mockReturnValue({
      language: "en",
      setLanguage: vi.fn(),
    });
    const root = createRoot(container);

    act(() => {
      root.render(<LanguageSwitcher />);
    });

    const enButton = container.querySelector('button[data-language="en"]');
    const zhButton = container.querySelector('button[data-language="zh-CN"]');
    expect(enButton?.textContent).toContain("language.en");
    expect(zhButton?.textContent).toContain("language.zhCN");

    act(() => {
      root.unmount();
    });
  });

  it("calls setLanguage when switching language", () => {
    const setLanguage = vi.fn();
    useAppLocaleMock.mockReturnValue({
      language: "en",
      setLanguage,
    });
    const root = createRoot(container);

    act(() => {
      root.render(<LanguageSwitcher />);
    });

    const zhButton = container.querySelector('button[data-language="zh-CN"]');
    expect(zhButton).not.toBeNull();

    act(() => {
      zhButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(setLanguage).toHaveBeenCalledTimes(1);
    expect(setLanguage).toHaveBeenCalledWith("zh-CN");

    act(() => {
      root.unmount();
    });
  });
});
