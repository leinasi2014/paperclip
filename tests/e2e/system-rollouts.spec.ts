import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  createSystemPluginRollout,
  getCompanyByName,
  getSystemPluginRollout,
  listSystemPluginRollouts,
  openOnboarding,
  reconcileRequiredSystemPlugins,
  waitForRequiredSystemPlugin,
} from "../support/browser-chain.js";

const ACTIVE_ROLLOUT_STATUSES = new Set(["pending_approval", "approved", "executing"]);

test.describe("System rollouts", () => {
  test("shows required plugins and completes the approve/execute/rollback chain", async ({ page }) => {
    const suffix = `${Date.now()}`;
    const companyName = `Rollout-${suffix}`;
    const taskTitle = `Rollout seed ${suffix}`;
    const rolloutNote = `playwright-rollout-${suffix}`;

    await page.goto("/");
    await openOnboarding(page);
    await completeOnboarding(page, {
      companyName,
      taskTitle,
      agentName: "CEO",
    });

    const company = await getCompanyByName(page, companyName);

    await reconcileRequiredSystemPlugins(page);

    const executionPlugin = await waitForRequiredSystemPlugin(
      page,
      "paperclip.execution-improvement",
      company.id,
    );
    await waitForRequiredSystemPlugin(page, "paperclip.skills-system", company.id);

    const existingRollouts = await listSystemPluginRollouts(page, {
      pluginKey: executionPlugin.pluginKey,
    });
    const activeExisting = existingRollouts.find((entry) => ACTIVE_ROLLOUT_STATUSES.has(entry.status));
    expect(activeExisting).toBeFalsy();

    const rollout = await createSystemPluginRollout(page, {
      pluginKey: executionPlugin.pluginKey,
      candidateVersion: `playwright-${suffix}`,
      candidateMetadata: { source: "playwright-e2e", companyId: company.id },
      note: rolloutNote,
    });
    expect(rollout.status).toBe("pending_approval");

    await page.goto("/system-rollouts");
    await expect(
      page.locator("#main-content").getByRole("heading", { name: "System Rollouts" }),
    ).toBeVisible();
    await expect(
      page.locator("#main-content").getByText("Execution Improvement", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("#main-content").getByText("Skills System", { exact: true }),
    ).toBeVisible();

    const rolloutCard = page.locator("div.rounded-lg.border").filter({ hasText: rolloutNote }).first();
    await expect(rolloutCard).toBeVisible();
    await expect(rolloutCard).toContainText("Pending approval");

    await rolloutCard.getByRole("button", { name: "Approve" }).click();
    await expect
      .poll(async () => (await getSystemPluginRollout(page, rollout.id)).status, {
        timeout: 30_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBe("approved");

    await page.reload();
    await expect(rolloutCard).toContainText("Approved");
    await rolloutCard.getByRole("button", { name: "Execute restart path" }).click();
    await expect
      .poll(
        async () => {
          const latest = await getSystemPluginRollout(page, rollout.id);
          return {
            status: latest.status,
            restartCommand: latest.restartCommand,
          };
        },
        {
          timeout: 30_000,
          intervals: [1_000, 2_000, 5_000],
        },
      )
      .toEqual(
        expect.objectContaining({
          status: "succeeded",
          restartCommand: expect.any(Object),
        }),
      );

    await page.reload();
    await expect(rolloutCard).toContainText("Succeeded");
    await rolloutCard.getByRole("button", { name: "Prepare rollback" }).click();
    await expect
      .poll(async () => (await getSystemPluginRollout(page, rollout.id)).rollbackCommand, {
        timeout: 30_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toEqual(expect.any(Object));
  });
});
