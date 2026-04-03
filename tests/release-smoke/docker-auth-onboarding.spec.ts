import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  getAgentByName,
  getCompanyByName,
  getIssueByTitle,
  openOnboarding,
  resolveReleaseSmokeCredentials,
  signIn,
  waitForHeartbeatRun,
} from "../support/browser-chain.js";

const COMPANY_NAME = `Release-Smoke-${Date.now()}`;
const AGENT_NAME = "CEO";
const TASK_TITLE = "Release smoke task";
const ADMIN = resolveReleaseSmokeCredentials();

test.describe("Docker authenticated onboarding smoke", () => {
  test("logs in, completes onboarding, and triggers the first CEO run", async ({ page }) => {
    await signIn(page, ADMIN);
    await openOnboarding(page);
    await completeOnboarding(page, {
      companyName: COMPANY_NAME,
      taskTitle: TASK_TITLE,
      agentName: AGENT_NAME,
    });

    const company = await getCompanyByName(page, COMPANY_NAME);
    const ceoAgent = await getAgentByName(page, company.id, AGENT_NAME);
    const issue = await getIssueByTitle(page, company.id, TASK_TITLE);

    expect(ceoAgent.role).toBe("ceo");
    expect(ceoAgent.adapterType).not.toBe("process");
    expect(issue.assigneeAgentId).toBe(ceoAgent.id);

    const run = await waitForHeartbeatRun(page, company.id, ceoAgent.id);
    expect(run?.agentId).toBe(ceoAgent.id);
    expect(run?.invocationSource).toBe("assignment");
  });
});
