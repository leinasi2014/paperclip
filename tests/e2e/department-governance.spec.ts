import { expect, test } from "@playwright/test";
import {
  approveTemporaryWorkerResume,
  assignDepartmentMinister,
  completeOnboarding,
  createAgent,
  createAgentKey,
  createDepartment,
  createTemporaryWorker,
  getAgentByName,
  getCompanyByName,
  getIssue,
  getIssueByTitle,
  getTemporaryWorker,
  ministerIssueIntake,
  openOnboarding,
  pauseTemporaryWorker,
  requestTemporaryWorkerResume,
  routeIssueToDepartment,
} from "../support/browser-chain.js";

test.describe("Department governance", () => {
  test("covers CEO department routing, minister intake, and temporary worker pause/resume", async ({
    page,
  }) => {
    const suffix = `${Date.now()}`;
    const companyName = `Dept-Gov-${suffix}`;
    const ceoName = "CEO";
    const ministerName = `Platform Minister ${suffix}`;
    const departmentName = `Platform ${suffix}`;
    const taskTitle = `Route issue ${suffix}`;
    const workerName = `Hotfix Worker ${suffix}`;

    await page.goto("/");
    await openOnboarding(page);
    await completeOnboarding(page, {
      companyName,
      taskTitle,
      agentName: ceoName,
    });

    const company = await getCompanyByName(page, companyName);
    const ceoAgent = await getAgentByName(page, company.id, ceoName);
    const issue = await getIssueByTitle(page, company.id, taskTitle);

    const ministerAgent = await createAgent(page, company.id, {
      name: ministerName,
      role: "engineer",
      reportsTo: ceoAgent.id,
      adapterType: "process",
    });

    const ceoKey = await createAgentKey(page, ceoAgent.id, `ceo-dept-${suffix}`);
    const ministerKey = await createAgentKey(page, ministerAgent.id, `minister-dept-${suffix}`);

    const department = await createDepartment(
      page,
      company.id,
      {
        name: departmentName,
        slug: `platform-${suffix}`,
        mission: "Own platform intake and incident routing.",
        maxConcurrentTemporaryWorkers: 2,
        temporaryWorkerTtlMinutes: 90,
      },
      ceoKey.token,
    );

    const assignedDepartment = await assignDepartmentMinister(
      page,
      department.id,
      ministerAgent.id,
      ceoKey.token,
    );
    expect(assignedDepartment.ministerAgentId).toBe(ministerAgent.id);

    const routedIssue = await routeIssueToDepartment(page, issue.id, department.id, ceoKey.token);
    expect(routedIssue.owningDepartmentId).toBe(department.id);
    expect(routedIssue.departmentIntakeStatus).toBe("routed");
    expect(routedIssue.isInCeoIntake).toBe(false);

    const acceptedIssue = await ministerIssueIntake(
      page,
      issue.id,
      "accept",
      ministerKey.token,
      "Within department charter.",
    );
    expect(acceptedIssue.owningDepartmentId).toBe(department.id);
    expect(acceptedIssue.departmentIntakeStatus).toBe("accepted");
    expect(acceptedIssue.ministerDecisionResponse).toBe("accept");

    const worker = await createTemporaryWorker(
      page,
      department.id,
      {
        sourceIssueId: issue.id,
        name: workerName,
        ttlMinutes: 60,
      },
      ministerKey.token,
    );
    expect(worker.status).toBe("active");

    await page.goto(`/departments/${department.id}`);
    await expect(page.getByRole("heading", { name: departmentName })).toBeVisible();
    await expect(page.locator("main").getByText(ministerName).first()).toBeVisible();
    await expect(page.getByText(workerName)).toBeVisible();

    const workerCard = page.locator('[class*="card"]').filter({ hasText: workerName }).first();
    await expect(workerCard).toContainText("Active");

    const pausedWorker = await pauseTemporaryWorker(
      page,
      worker.id,
      ministerKey.token,
      "Need CEO approval before resuming.",
    );
    expect(pausedWorker.status).toBe("paused_pending_ceo_resume");

    const resumeRequestedWorker = await requestTemporaryWorkerResume(
      page,
      worker.id,
      ministerKey.token,
      "Resume once CEO signs off.",
    );
    expect(resumeRequestedWorker.status).toBe("paused_pending_ceo_resume");
    expect(resumeRequestedWorker.resumeRequestedAt).toBeTruthy();

    await page.reload();
    await expect(workerCard).toContainText("paused pending ceo resume");
    await expect(workerCard).toContainText("Resume once CEO signs off.");

    const resumedWorker = await approveTemporaryWorkerResume(page, worker.id, ceoKey.token);
    expect(resumedWorker.status).toBe("active");

    await page.reload();
    await expect(workerCard).toContainText("Active");
    await expect(workerCard).not.toContainText("Resume once CEO signs off.");

    const finalIssue = await getIssue(page, issue.id);
    const finalWorker = await getTemporaryWorker(page, worker.id);
    expect(finalIssue.owningDepartmentId).toBe(department.id);
    expect(finalIssue.departmentIntakeStatus).toBe("accepted");
    expect(finalWorker.status).toBe("active");
    expect(finalWorker.ownerMinisterAgentId).toBe(ministerAgent.id);

    await page.goto("/departments");
    await expect(page.locator("#main-content").getByRole("heading", { name: "Departments" })).toBeVisible();
    await expect(page.locator("a").filter({ hasText: departmentName }).first()).toBeVisible();
    await expect(page.locator("main").getByText(ministerName).first()).toBeVisible();
  });
});
