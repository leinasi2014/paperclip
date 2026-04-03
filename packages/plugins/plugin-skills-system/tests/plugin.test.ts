import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("skills system plugin", () => {
  it("creates skill candidates and promotion requests from execution requests", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    await harness.emit(
      "plugin.paperclip.execution-improvement.skill-support-requested",
      {
        companyId: "company-1",
        fingerprint: "fingerprint-1",
        sourceEventType: "issue.updated",
        sourceEntityId: "issue-1",
        sourceEntityType: "issue",
        sourceSeverity: "high",
        sourceIssueId: "issue-1",
        sourceIssueTitle: "Need better prompt skill",
        sourceIssueType: "skill",
        summary: "The company needs a reusable prompt skill",
        suggestedSkillKey: "skill-prompt-gaps",
      },
      {
        companyId: "company-1",
        entityId: "issue-1",
        entityType: "issue",
        actorType: "plugin",
      },
    );

    const candidates = await harness.ctx.companySkills.listCandidates("company-1");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.skillKey).toBe("skill-prompt-gaps");

    const requests = await harness.ctx.companySkills.listPromotionRequests("company-1");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.candidateId).toBe(candidates[0]?.id);
  });
});
