import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  costEvents,
  createDb,
  financeEvents,
  goals,
  issues,
  projects,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { goalService } from "../services/goals.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres goal service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("goalService.remove", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof goalService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-goals-service-");
    db = createDb(tempDb.connectionString);
    svc = goalService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(financeEvents);
    await db.delete(costEvents);
    await db.delete(issues);
    await db.delete(projects);
    await db.delete(goals);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("nulls goal references before deleting the goal", async () => {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const parentGoalId = randomUUID();
    const childGoalId = randomUUID();
    const issueId = randomUUID();
    const projectId = randomUUID();
    const costEventId = randomUUID();
    const financeEventId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "GoalAgent",
      role: "engineer",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(goals).values([
      {
        id: parentGoalId,
        companyId,
        title: "Parent goal",
        level: "company",
        status: "active",
      },
      {
        id: childGoalId,
        companyId,
        title: "Child goal",
        level: "task",
        status: "planned",
        parentId: parentGoalId,
      },
    ]);

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Issue linked to goal",
      status: "todo",
      priority: "medium",
      goalId: parentGoalId,
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Project linked to goal",
      status: "backlog",
      goalId: parentGoalId,
    });

    await db.insert(costEvents).values({
      id: costEventId,
      companyId,
      agentId,
      goalId: parentGoalId,
      provider: "openai",
      biller: "openai",
      billingType: "usage",
      model: "gpt-5",
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 20,
      costCents: 15,
      occurredAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    await db.insert(financeEvents).values({
      id: financeEventId,
      companyId,
      goalId: parentGoalId,
      eventKind: "usage_charge",
      direction: "debit",
      biller: "openai",
      amountCents: 15,
      currency: "USD",
      occurredAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    const removed = await svc.remove(parentGoalId);

    expect(removed?.id).toBe(parentGoalId);
    await expect(db.select().from(goals).where(eq(goals.id, parentGoalId))).resolves.toHaveLength(0);
    await expect(db.select({ parentId: goals.parentId }).from(goals).where(eq(goals.id, childGoalId))).resolves.toEqual([
      { parentId: null },
    ]);
    await expect(db.select({ goalId: issues.goalId }).from(issues).where(eq(issues.id, issueId))).resolves.toEqual([
      { goalId: null },
    ]);
    await expect(db.select({ goalId: projects.goalId }).from(projects).where(eq(projects.id, projectId))).resolves.toEqual([
      { goalId: null },
    ]);
    await expect(db.select({ goalId: costEvents.goalId }).from(costEvents).where(eq(costEvents.id, costEventId))).resolves.toEqual([
      { goalId: null },
    ]);
    await expect(
      db.select({ goalId: financeEvents.goalId }).from(financeEvents).where(eq(financeEvents.id, financeEventId)),
    ).resolves.toEqual([{ goalId: null }]);
  });
});
