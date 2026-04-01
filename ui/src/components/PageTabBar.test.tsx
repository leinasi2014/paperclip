// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageTabBar } from "./PageTabBar";

const useSidebarMock = vi.fn();

vi.mock("../context/SidebarContext", () => ({
  useSidebar: () => useSidebarMock(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("PageTabBar", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    useSidebarMock.mockReset();
  });

  afterEach(() => {
    container.remove();
  });

  it("uses mobileLabel for non-string labels and forwards onValueChange", () => {
    useSidebarMock.mockReturnValue({ isMobile: true });
    const onValueChange = vi.fn();
    const root = createRoot(container);

    act(() => {
      root.render(
        <PageTabBar
          value="pending"
          onValueChange={onValueChange}
          items={[
            { value: "pending", label: <>Pending</>, mobileLabel: "Pending" },
            { value: "all", label: "All" },
          ]}
        />,
      );
    });

    const select = container.querySelector("select");
    const options = container.querySelectorAll("option");
    expect(select).not.toBeNull();
    expect(options[0]?.textContent).toBe("Pending");
    expect(options[1]?.textContent).toBe("All");

    act(() => {
      (select as HTMLSelectElement).value = "all";
      select?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onValueChange).toHaveBeenCalledWith("all");

    act(() => {
      root.unmount();
    });
  });

  it("prefers mobileLabel even when label is a string", () => {
    useSidebarMock.mockReturnValue({ isMobile: true });
    const root = createRoot(container);

    act(() => {
      root.render(
        <PageTabBar
          value="all"
          onValueChange={vi.fn()}
          items={[
            { value: "all", label: "All", mobileLabel: "Everything" },
          ]}
        />,
      );
    });

    const option = container.querySelector("option");
    expect(option?.textContent).toBe("Everything");

    act(() => {
      root.unmount();
    });
  });
});
