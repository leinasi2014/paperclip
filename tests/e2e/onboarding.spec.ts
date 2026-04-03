import { expect, test } from "@playwright/test";
import {
  advanceOnboarding,
  fillOnboardingCompany,
  fillOnboardingTask,
  getAgentByName,
  getCompanyByName,
  getIssueByTitle,
  getInstructionBundlePaths,
  openOnboarding,
} from "../support/browser-chain.js";

/**
 * E2E: Onboarding wizard flow (skip_llm mode).
 *
 * Walks through the 4-step OnboardingWizard:
 *   Step 1 - Name your company
 *   Step 2 - Create your first agent (adapter selection + config)
 *   Step 3 - Give it something to do (task creation)
 *   Step 4 - Ready to launch (summary + open issue)
 *
 * By default this runs in skip_llm mode: we do NOT assert that an LLM
 * heartbeat fires. Set PAPERCLIP_E2E_SKIP_LLM=false to enable LLM-dependent
 * assertions (requires a valid ANTHROPIC_API_KEY).
 */

const COMPANY_NAME = `E2E-Test-${Date.now()}`;
const AGENT_NAME = "CEO";
const TASK_TITLE = "E2E test task";
const SKIP_LLM = process.env.PAPERCLIP_E2E_SKIP_LLM !== "false";

test.describe("Onboarding wizard", () => {
  test("completes full wizard flow", async ({ page }) => {
    await page.goto("/");
    await openOnboarding(page);

    await fillOnboardingCompany(page, COMPANY_NAME);
    await advanceOnboarding(page);

    await expect(page.getByRole("heading", { name: "Create your first agent" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('input[placeholder="CEO"]')).toHaveValue(AGENT_NAME);
    await expect(page.getByRole("button", { name: "Claude Code" })).toBeVisible();

    await page.getByRole("button", { name: "More Agent Adapter Types" }).click();
    await expect(page.getByRole("button", { name: "Process" })).toHaveCount(0);

    await advanceOnboarding(page);

    await expect(page.getByRole("heading", { name: "Give it something to do" })).toBeVisible({
      timeout: 30_000,
    });

    await fillOnboardingTask(page, TASK_TITLE);
    await advanceOnboarding(page);

    await expect(page.getByRole("heading", { name: "Ready to launch" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(COMPANY_NAME)).toBeVisible();
    await expect(page.getByText(AGENT_NAME)).toBeVisible();
    await expect(page.getByText(TASK_TITLE)).toBeVisible();

    await page.getByRole("button", { name: "Create & Open Issue" }).click();
    await expect(page).toHaveURL(/\/issues\//, { timeout: 30_000 });

    const company = await getCompanyByName(page, COMPANY_NAME);
    const ceoAgent = await getAgentByName(page, company.id, AGENT_NAME);
    expect(ceoAgent.role).toBe("ceo");
    expect(ceoAgent.adapterType).not.toBe("process");

    const instructionsBundlePaths = await getInstructionBundlePaths(page, ceoAgent.id, company.id);
    expect(instructionsBundlePaths).toEqual(["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"]);

    const task = await getIssueByTitle(page, company.id, TASK_TITLE);
    expect(task.assigneeAgentId).toBe(ceoAgent.id);
    expect(task.description).toContain("You are the CEO. You set the direction for the company.");
    expect(task.description).not.toContain("github.com/paperclipai/companies");

    if (!SKIP_LLM) {
      await expect(async () => {
        const res = await page.request.get(`${new URL(page.url()).origin}/api/issues/${task.id}`);
        const issue = await res.json();
        expect(["in_progress", "done"]).toContain(issue.status);
      }).toPass({ timeout: 120_000, intervals: [5_000] });
    }
  });
});
