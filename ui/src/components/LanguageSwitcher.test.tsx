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
  let root: ReturnType<typeof createRoot> | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useAppLocaleMock.mockReset();
    useTranslationMock.mockReset();
    useTranslationMock.mockReturnValue({
      t: (key: string) => key,
    });

    if (!window.PointerEvent) {
      // Radix menus listen to pointer interactions; jsdom needs a minimal fallback.
      window.PointerEvent = MouseEvent as typeof PointerEvent;
    }
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it("opens the language menu from a single trigger", () => {
    useAppLocaleMock.mockReturnValue({
      language: "en",
      setLanguage: vi.fn(),
    });

    act(() => {
      root?.render(<LanguageSwitcher />);
    });

    const trigger = container.querySelector('button[aria-label="language.switcher"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).not.toContain("language.en");
    expect(trigger?.textContent).not.toContain("language.zhCN");
    expect(container.querySelectorAll("button[data-language]").length).toBe(0);

    act(() => {
      trigger?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    });

    const menu = document.body.querySelector('[data-slot="dropdown-menu-content"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain("language.en");
    expect(menu?.textContent).toContain("language.zhCN");
  });

  it("calls setLanguage when selecting a language from the menu", () => {
    const setLanguage = vi.fn();
    useAppLocaleMock.mockReturnValue({
      language: "en",
      setLanguage,
    });

    act(() => {
      root?.render(<LanguageSwitcher />);
    });

    const trigger = container.querySelector('button[aria-label="language.switcher"]');
    expect(trigger).not.toBeNull();

    act(() => {
      trigger?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    });

    const zhOption = document.body.querySelector('[data-language="zh-CN"]');
    expect(zhOption).not.toBeNull();

    act(() => {
      zhOption?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(setLanguage).toHaveBeenCalledTimes(1);
    expect(setLanguage).toHaveBeenCalledWith("zh-CN");
  });
});
