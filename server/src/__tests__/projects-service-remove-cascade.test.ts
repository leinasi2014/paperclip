import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  approvalComments,
  approvals,
  assets,
  budgetIncidents,
  budgetPolicies,
  companies,
  costEvents,
  createDb,
  documents,
  executionWorkspaces,
  financeEvents,
  goals,
  issueApprovals,
  issueAttachments,
  issueDocuments,
  issues,
  pluginEntities,
  plugins,
  pluginState,
  projectGoals,
  projects,
  projectWorkspaces,
  workspaceRuntimeServices,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { projectService } from "../services/projects.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres project service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("projectService.removeCascade", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof projectService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-projects-service-");
    db = createDb(tempDb.connectionString);
    svc = projectService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(approvalComments);
    await db.delete(issueApprovals);
    await db.delete(approvals);
    await db.delete(pluginEntities);
    await db.delete(pluginState);
    await db.delete(workspaceRuntimeServices);
    await db.delete(executionWorkspaces);
    await db.delete(projectWorkspaces);
    await db.delete(budgetIncidents);
    await db.delete(budgetPolicies);
    await db.delete(financeEvents);
    await db.delete(costEvents);
    await db.delete(issueAttachments);
    await db.delete(assets);
    await db.delete(issueDocuments);
    await db.delete(documents);
    await db.delete(issues);
    await db.delete(projectGoals);
    await db.delete(projects);
    await db.delete(goals);
    await db.delete(plugins);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("deletes project-scoped records while preserving goals referenced by other projects", async () => {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const pluginId = randomUUID();
    const projectId = randomUUID();
    const otherProjectId = randomUUID();
    const issueId = randomUUID();
    const projectWorkspaceId = randomUUID();
    const executionWorkspaceId = randomUUID();
    const runtimeServiceId = randomUUID();
    const approvalId = randomUUID();
    const approvalCommentId = randomUUID();
    const assetId = randomUUID();
    const attachmentId = randomUUID();
    const documentId = randomUUID();
    const issueDocumentId = randomUUID();
    const budgetPolicyId = randomUUID();
    const budgetIncidentId = randomUUID();
    const costEventId = randomUUID();
    const financeEventId = randomUUID();
    const exclusiveRootGoalId = randomUUID();
    const exclusiveChildGoalId = randomUUID();
    const sharedGoalId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Delete Tester",
      role: "engineer",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "test-plugin",
      packageName: "@paperclipai/test-plugin",
      version: "1.0.0",
      apiVersion: 1,
      categories: [],
      manifestJson: { id: "test-plugin", name: "Test Plugin" } as any,
      status: "installed",
    });

    await db.insert(goals).values([
      {
        id: exclusiveRootGoalId,
        companyId,
        title: "Exclusive project goal",
        level: "project",
        status: "active",
      },
      {
        id: exclusiveChildGoalId,
        companyId,
        title: "Exclusive child goal",
        level: "task",
        status: "planned",
        parentId: exclusiveRootGoalId,
      },
      {
        id: sharedGoalId,
        companyId,
        title: "Shared goal",
        level: "project",
        status: "active",
      },
    ]);

    await db.insert(projects).values([
      {
        id: projectId,
        companyId,
        goalId: exclusiveRootGoalId,
        name: "Onboarding",
        status: "backlog",
      },
      {
        id: otherProjectId,
        companyId,
        goalId: sharedGoalId,
        name: "Shared Consumer",
        status: "backlog",
      },
    ]);

    await db.insert(projectGoals).values([
      { projectId, goalId: exclusiveRootGoalId, companyId },
      { projectId, goalId: sharedGoalId, companyId },
    ]);

    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      goalId: exclusiveChildGoalId,
      title: "Project issue",
      status: "todo",
      priority: "medium",
    });

    await db.insert(projectWorkspaces).values({
      id: projectWorkspaceId,
      companyId,
      projectId,
      name: "Primary workspace",
      sourceType: "local_path",
      cwd: "C:\\repo\\onboarding",
      isPrimary: true,
    });

    await db.insert(executionWorkspaces).values({
      id: executionWorkspaceId,
      companyId,
      projectId,
      projectWorkspaceId,
      sourceIssueId: issueId,
      mode: "isolated_workspace",
      strategyType: "git_worktree",
      name: "Issue sandbox",
      status: "active",
      cwd: "C:\\repo\\onboarding\\.worktrees\\issue",
      providerType: "local_fs",
    });

    await db.insert(workspaceRuntimeServices).values({
      id: runtimeServiceId,
      companyId,
      projectId,
      projectWorkspaceId,
      executionWorkspaceId,
      issueId,
      scopeType: "project_workspace",
      scopeId: projectWorkspaceId,
      serviceName: "vite",
      status: "running",
      lifecycle: "persistent",
      provider: "local_process",
      healthStatus: "healthy",
    });

    await db.insert(approvals).values({
      id: approvalId,
      companyId,
      type: "file_write",
      requestedByAgentId: agentId,
      status: "pending",
      payload: { path: "README.md" },
    });
    await db.insert(issueApprovals).values({
      companyId,
      issueId,
      approvalId,
      linkedByAgentId: agentId,
    });
    await db.insert(approvalComments).values({
      id: approvalCommentId,
      companyId,
      approvalId,
      authorAgentId: agentId,
      body: "Please approve",
    });

    await db.insert(assets).values({
      id: assetId,
      companyId,
      provider: "local",
      objectKey: "issues/project-issue/spec.txt",
      contentType: "text/plain",
      byteSize: 16,
      sha256: "abc123",
      originalFilename: "spec.txt",
      createdByAgentId: agentId,
    });
    await db.insert(issueAttachments).values({
      id: attachmentId,
      companyId,
      issueId,
      assetId,
    });

    await db.insert(documents).values({
      id: documentId,
      companyId,
      title: "Execution notes",
      format: "markdown",
      latestBody: "hello",
      latestRevisionNumber: 1,
      createdByAgentId: agentId,
      updatedByAgentId: agentId,
    });
    await db.insert(issueDocuments).values({
      id: issueDocumentId,
      companyId,
      issueId,
      documentId,
      key: "notes",
    });

    await db.insert(budgetPolicies).values({
      id: budgetPolicyId,
      companyId,
      scopeType: "project",
      scopeId: projectId,
      metric: "billed_cents",
      windowKind: "lifetime",
      amount: 5000,
      warnPercent: 80,
      hardStopEnabled: true,
      notifyEnabled: true,
      isActive: true,
      createdByUserId: "user-1",
      updatedByUserId: "user-1",
    });
    await db.insert(budgetIncidents).values({
      id: budgetIncidentId,
      companyId,
      policyId: budgetPolicyId,
      scopeType: "project",
      scopeId: projectId,
      metric: "billed_cents",
      windowKind: "lifetime",
      windowStart: new Date("2026-04-01T00:00:00.000Z"),
      windowEnd: new Date("2026-05-01T00:00:00.000Z"),
      thresholdType: "hard_stop",
      amountLimit: 5000,
      amountObserved: 5200,
      status: "open",
    });

    await db.insert(costEvents).values({
      id: costEventId,
      companyId,
      agentId,
      issueId,
      projectId,
      goalId: exclusiveRootGoalId,
      provider: "openai",
      biller: "openai",
      billingType: "usage",
      model: "gpt-5",
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 20,
      costCents: 42,
      occurredAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    await db.insert(financeEvents).values({
      id: financeEventId,
      companyId,
      agentId,
      issueId,
      projectId,
      goalId: exclusiveRootGoalId,
      heartbeatRunId: null,
      costEventId,
      eventKind: "usage_charge",
      direction: "debit",
      biller: "openai",
      provider: "openai",
      amountCents: 42,
      currency: "USD",
      occurredAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    await db.insert(pluginState).values([
      {
        pluginId,
        scopeKind: "project",
        scopeId: projectId,
        namespace: "sync",
        stateKey: "project",
        valueJson: { projectId },
      },
      {
        pluginId,
        scopeKind: "project_workspace",
        scopeId: projectWorkspaceId,
        namespace: "sync",
        stateKey: "workspace",
        valueJson: { projectWorkspaceId },
      },
      {
        pluginId,
        scopeKind: "issue",
        scopeId: issueId,
        namespace: "sync",
        stateKey: "issue",
        valueJson: { issueId },
      },
      {
        pluginId,
        scopeKind: "goal",
        scopeId: exclusiveRootGoalId,
        namespace: "sync",
        stateKey: "goal",
        valueJson: { goalId: exclusiveRootGoalId },
      },
    ]);
    await db.insert(pluginEntities).values([
      {
        pluginId,
        entityType: "project",
        scopeKind: "project",
        scopeId: projectId,
        externalId: "ext-project",
        title: "External project",
        data: {},
      },
      {
        pluginId,
        entityType: "issue",
        scopeKind: "issue",
        scopeId: issueId,
        externalId: "ext-issue",
        title: "External issue",
        data: {},
      },
      {
        pluginId,
        entityType: "goal",
        scopeKind: "goal",
        scopeId: exclusiveRootGoalId,
        externalId: "ext-goal",
        title: "External goal",
        data: {},
      },
    ]);

    const removed = await svc.removeCascade(projectId);

    expect(removed?.project.id).toBe(projectId);
    expect(removed?.summary.issueIds).toEqual([issueId]);
    expect(removed?.summary.deletedGoalIds.sort()).toEqual([exclusiveChildGoalId, exclusiveRootGoalId].sort());
    expect(removed?.summary.preservedGoalIds).toEqual([sharedGoalId]);

    await expect(db.select().from(projects).where(eq(projects.id, projectId))).resolves.toHaveLength(0);
    await expect(db.select().from(issues).where(eq(issues.id, issueId))).resolves.toHaveLength(0);
    await expect(db.select().from(projectWorkspaces).where(eq(projectWorkspaces.id, projectWorkspaceId))).resolves.toHaveLength(0);
    await expect(db.select().from(executionWorkspaces).where(eq(executionWorkspaces.id, executionWorkspaceId))).resolves.toHaveLength(0);
    await expect(db.select().from(workspaceRuntimeServices).where(eq(workspaceRuntimeServices.id, runtimeServiceId))).resolves.toHaveLength(0);
    await expect(db.select().from(assets).where(eq(assets.id, assetId))).resolves.toHaveLength(0);
    await expect(db.select().from(documents).where(eq(documents.id, documentId))).resolves.toHaveLength(0);
    await expect(db.select().from(budgetPolicies).where(eq(budgetPolicies.id, budgetPolicyId))).resolves.toHaveLength(0);
    await expect(db.select().from(budgetIncidents).where(eq(budgetIncidents.id, budgetIncidentId))).resolves.toHaveLength(0);
    await expect(db.select().from(costEvents).where(eq(costEvents.id, costEventId))).resolves.toHaveLength(0);
    await expect(db.select().from(financeEvents).where(eq(financeEvents.id, financeEventId))).resolves.toHaveLength(0);
    await expect(db.select().from(approvals).where(eq(approvals.id, approvalId))).resolves.toHaveLength(0);
    await expect(db.select().from(approvalComments).where(eq(approvalComments.id, approvalCommentId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginState).where(eq(pluginState.scopeId, projectId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginEntities).where(eq(pluginEntities.scopeId, projectId))).resolves.toHaveLength(0);
    await expect(db.select().from(goals).where(eq(goals.id, exclusiveRootGoalId))).resolves.toHaveLength(0);
    await expect(db.select().from(goals).where(eq(goals.id, exclusiveChildGoalId))).resolves.toHaveLength(0);
    await expect(db.select().from(goals).where(eq(goals.id, sharedGoalId))).resolves.toHaveLength(1);
    await expect(db.select({ goalId: projects.goalId }).from(projects).where(eq(projects.id, otherProjectId))).resolves.toEqual([
      { goalId: sharedGoalId },
    ]);
  });
});
