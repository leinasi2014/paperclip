# Goal Deletion Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow deleting a goal even when it is referenced by child goals, issues, projects, cost events, or finance events by nulling those references before deletion.

**Architecture:** Update the goal service deletion path to clear referencing foreign keys within a single transaction, then delete the goal. Add an embedded Postgres regression test that verifies deletion succeeds and references are cleared.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest, embedded Postgres test helper.

---

## File Structure

- Modify: `server/src/services/goals.ts`
  - Add transactional cleanup for child goals and related tables before deleting a goal.
- Create: `server/src/__tests__/goals-service.test.ts`
  - Embedded Postgres regression test covering parent goal deletion with references.

---

### Task 1: Add Regression Test For Goal Deletion Cleanup

**Files:**
- Create: `server/src/__tests__/goals-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
      },
      {
        id: childGoalId,
        companyId,
        title: "Child goal",
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
    await expect(
      db.select().from(goals).where(eq(goals.id, parentGoalId)),
    ).resolves.toHaveLength(0);
    await expect(
      db.select({ parentId: goals.parentId }).from(goals).where(eq(goals.id, childGoalId)),
    ).resolves.toEqual([{ parentId: null }]);
    await expect(
      db.select({ goalId: issues.goalId }).from(issues).where(eq(issues.id, issueId)),
    ).resolves.toEqual([{ goalId: null }]);
    await expect(
      db.select({ goalId: projects.goalId }).from(projects).where(eq(projects.id, projectId)),
    ).resolves.toEqual([{ goalId: null }]);
    await expect(
      db.select({ goalId: costEvents.goalId }).from(costEvents).where(eq(costEvents.id, costEventId)),
    ).resolves.toEqual([{ goalId: null }]);
    await expect(
      db.select({ goalId: financeEvents.goalId }).from(financeEvents).where(eq(financeEvents.id, financeEventId)),
    ).resolves.toEqual([{ goalId: null }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run -- server/src/__tests__/goals-service.test.ts`  
Expected: FAIL with a foreign key constraint error when deleting the parent goal.

- [ ] **Step 3: Commit**

```bash
git add server/src/__tests__/goals-service.test.ts
git commit -m "test: cover goal deletion cleanup"
```

---

### Task 2: Null Goal References Before Deleting

**Files:**
- Modify: `server/src/services/goals.ts`

- [ ] **Step 1: Write minimal implementation**

```ts
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { costEvents, financeEvents, goals, issues, projects } from "@paperclipai/db";
```

```ts
    remove: (id: string) =>
      db.transaction(async (tx) => {
        const existingGoal = await tx
          .select({ id: goals.id, companyId: goals.companyId })
          .from(goals)
          .where(eq(goals.id, id))
          .then((rows) => rows[0] ?? null);
        if (!existingGoal) return null;

        const now = new Date();
        await tx
          .update(goals)
          .set({ parentId: null, updatedAt: now })
          .where(and(eq(goals.companyId, existingGoal.companyId), eq(goals.parentId, id)));
        await tx
          .update(issues)
          .set({ goalId: null, updatedAt: now })
          .where(eq(issues.goalId, id));
        await tx
          .update(projects)
          .set({ goalId: null, updatedAt: now })
          .where(eq(projects.goalId, id));
        await tx
          .update(costEvents)
          .set({ goalId: null })
          .where(eq(costEvents.goalId, id));
        await tx
          .update(financeEvents)
          .set({ goalId: null })
          .where(eq(financeEvents.goalId, id));

        return tx
          .delete(goals)
          .where(eq(goals.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test:run -- server/src/__tests__/goals-service.test.ts`  
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/goals.ts
git commit -m "fix: null goal references before deletion"
```

---

## Plan Self-Review

- Spec coverage: the plan nulls all required references and validates with a regression test.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: uses existing table names and goal service patterns.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-01-goal-deletion-cleanup.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
