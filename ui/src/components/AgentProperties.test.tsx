// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@paperclipai/shared";

vi.mock("../i18n/useAppLocale", () => ({
  useAppLocale: () => ({ language: "zh-CN" }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
}));

vi.mock("@/lib/router", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("./StatusBadge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("./Identity", () => ({
  Identity: ({ name }: { name: string }) => <span>{name}</span>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { AgentProperties } from "./AgentProperties";

function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "Ada",
    urlKey: "ada",
    role: "ceo",
    title: null,
    icon: null,
    status: "active",
    reportsTo: null,
    capabilities: null,
    adapterType: "process",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    updatedAt: new Date("2026-03-01T00:00:00Z"),
    ...overrides,
  };
}

describe("AgentProperties", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("renders a localized role label instead of the shared English label", () => {
    const root = createRoot(container);

    act(() => {
      root.render(<AgentProperties agent={createAgent()} />);
    });

    expect(container.textContent).toContain("首席执行官");
    expect(container.textContent).not.toContain("CEO");

    act(() => {
      root.unmount();
    });
  });
});
