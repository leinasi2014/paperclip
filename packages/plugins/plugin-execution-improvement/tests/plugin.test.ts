import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("execution improvement plugin", () => {
  it("opens a governance issue for critical execution incidents", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    await harness.emit(
      "issue.updated",
      {
        companyId: "company-1",
        title: "Build failed",
        description: "Critical failure in deployment pipeline",
        priority: "critical",
        status: "blocked",
        identifier: "BRO-1",
      },
      {
        companyId: "company-1",
        entityId: "issue-1",
        entityType: "issue",
      },
    );

    const issues = await harness.ctx.systemIssues.list({ companyId: "company-1" });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.systemIssueType).toBe("execution");
    expect(issues[0]?.systemIssueSeverity).toBe("critical");
    expect(issues[0]?.blockRecommended).toBe(true);

    const state = harness.getState({
      scopeKind: "company",
      scopeId: "company-1",
      namespace: "governance",
      stateKey: "execution-improvement-rollup",
    }) as { companies?: Record<string, { totalEvents: number }> } | null;
    expect(state?.companies?.["company-1"]?.totalEvents).toBe(1);
  });

  it("emits skill support requests for skill incidents", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    await harness.emit(
      "issue.created",
      {
        companyId: "company-1",
        title: "Need a knowledge template skill",
        description: "This skill gap needs a playbook",
        identifier: "BRO-2",
      },
      {
        companyId: "company-1",
        entityId: "issue-2",
        entityType: "issue",
      },
    );

    const state = harness.getState({
      scopeKind: "company",
      scopeId: "company-1",
      namespace: "governance",
      stateKey: "execution-improvement-rollup",
    }) as { companies?: Record<string, { incidents: Record<string, { skillSupportRequestedAt: string | null }> }> } | null;
    const company = state?.companies?.["company-1"];
    expect(company).toBeTruthy();
    const requestSeen = Object.values(company?.incidents ?? {}).some((incident) => incident.skillSupportRequestedAt !== null);
    expect(requestSeen).toBe(true);
  });
});
