import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agentApiKeys,
  agentConfigRevisions,
  agents,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  approvalComments,
  approvals,
  assets,
  budgetIncidents,
  budgetPolicies,
  companies,
  companyLogos,
  companyMemberships,
  companySecrets,
  companySecretVersions,
  companySkills,
  costEvents,
  createDb,
  departmentBudgetEnvelopes,
  departments,
  documents,
  documentRevisions,
  executionWorkspaces,
  financeEvents,
  goals,
  heartbeatRunEvents,
  heartbeatRuns,
  invites,
  issueApprovals,
  issueAttachments,
  issueComments,
  issueDocuments,
  issueInboxArchives,
  issueLabels,
  issueReadStates,
  issues,
  issueWorkProducts,
  joinRequests,
  labels,
  pluginCompanySettings,
  pluginEntities,
  plugins,
  pluginState,
  principalPermissionGrants,
  projectGoals,
  projects,
  projectWorkspaces,
  routines,
  routineRuns,
  routineTriggers,
  workspaceOperations,
  workspaceRuntimeServices,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companyService } from "../services/companies.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("companyService.remove", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof companyService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-companies-service-");
    db = createDb(tempDb.connectionString);
    svc = companyService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(heartbeatRunEvents);
    await db.delete(workspaceOperations);
    await db.delete(issueWorkProducts);
    await db.delete(agentTaskSessions);
    await db.delete(issueApprovals);
    await db.delete(issueLabels);
    await db.delete(issueInboxArchives);
    await db.delete(issueReadStates);
    await db.delete(issueComments);
    await db.delete(issueDocuments);
    await db.delete(issueAttachments);
    await db.delete(documentRevisions);
    await db.delete(approvalComments);
    await db.delete(routineRuns);
    await db.delete(routineTriggers);
    await db.delete(workspaceRuntimeServices);
    await db.delete(budgetIncidents);
    await db.delete(financeEvents);
    await db.delete(costEvents);
    await db.delete(pluginEntities);
    await db.delete(pluginState);
    await db.delete(pluginCompanySettings);
    await db.delete(projectGoals);
    await db.delete(companyLogos);
    await db.delete(labels);
    await db.delete(documents);
    await db.delete(assets);
    await db.delete(routines);
    await db.delete(approvals);
    await db.delete(issues);
    await db.delete(executionWorkspaces);
    await db.delete(projectWorkspaces);
    await db.delete(budgetPolicies);
    await db.delete(companySecretVersions);
    await db.delete(companySecrets);
    await db.delete(departmentBudgetEnvelopes);
    await db.delete(agentConfigRevisions);
    await db.delete(activityLog);
    await db.delete(heartbeatRuns);
    await db.delete(agentWakeupRequests);
    await db.delete(agentApiKeys);
    await db.delete(agentRuntimeState);
    await db.delete(departments);
    await db.delete(projects);
    await db.delete(goals);
    await db.delete(joinRequests);
    await db.delete(invites);
    await db.delete(principalPermissionGrants);
    await db.delete(companyMemberships);
    await db.delete(companySkills);
    await db.delete(plugins);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("removes all company-scoped records while preserving other companies", async () => {
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const pluginId = randomUUID();
    const agentId = randomUUID();
    const otherAgentId = randomUUID();
    const goalId = randomUUID();
    const otherGoalId = randomUUID();
    const projectId = randomUUID();
    const otherProjectId = randomUUID();
    const projectWorkspaceId = randomUUID();
    const issueId = randomUUID();
    const departmentId = randomUUID();
    const wakeupRequestId = randomUUID();
    const heartbeatRunId = randomUUID();
    const executionWorkspaceId = randomUUID();
    const runtimeServiceId = randomUUID();
    const approvalId = randomUUID();
    const budgetPolicyId = randomUUID();
    const budgetIncidentId = randomUUID();
    const primaryAssetId = randomUUID();
    const logoAssetId = randomUUID();
    const documentId = randomUUID();
    const documentRevisionId = randomUUID();
    const secretId = randomUUID();
    const labelId = randomUUID();
    const inviteId = randomUUID();
    const otherPluginStateId = randomUUID();

    await db.insert(companies).values([
      {
        id: companyId,
        name: "Delete Me Inc",
        issuePrefix: `DEL${companyId.replace(/-/g, "").slice(0, 4).toUpperCase()}`,
        requireBoardApprovalForNewAgents: false,
      },
      {
        id: otherCompanyId,
        name: "Keep Me Inc",
        issuePrefix: `KEP${otherCompanyId.replace(/-/g, "").slice(0, 4).toUpperCase()}`,
        requireBoardApprovalForNewAgents: false,
      },
    ]);

    await db.insert(agents).values([
      {
        id: agentId,
        companyId,
        name: "Delete Agent",
        role: "ceo",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: otherAgentId,
        companyId: otherCompanyId,
        name: "Keep Agent",
        role: "ceo",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

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
        id: goalId,
        companyId,
        title: "Delete Goal",
        level: "company",
        status: "active",
        ownerAgentId: agentId,
      },
      {
        id: otherGoalId,
        companyId: otherCompanyId,
        title: "Keep Goal",
        level: "company",
        status: "active",
        ownerAgentId: otherAgentId,
      },
    ]);

    await db.insert(projects).values([
      {
        id: projectId,
        companyId,
        goalId,
        name: "Onboarding",
        status: "backlog",
        leadAgentId: agentId,
      },
      {
        id: otherProjectId,
        companyId: otherCompanyId,
        goalId: otherGoalId,
        name: "Preserved Project",
        status: "backlog",
        leadAgentId: otherAgentId,
      },
    ]);

    await db.insert(departments).values({
      id: departmentId,
      companyId,
      name: "Platform",
      slug: "platform",
      status: "frozen_unstaffed",
    });
    await db.insert(departmentBudgetEnvelopes).values({
      departmentId,
      companyId,
      monthlyLimitCents: 250_000,
      reservedCents: 10_000,
      status: "reserved_only",
    });

    await db.insert(projectGoals).values({ projectId, goalId, companyId });
    await db.insert(projectWorkspaces).values({
      id: projectWorkspaceId,
      companyId,
      projectId,
      name: "Workspace",
      sourceType: "local_path",
      cwd: "C:\\repo\\delete-me",
      isPrimary: true,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      projectWorkspaceId,
      goalId,
      title: "Delete Issue",
      status: "todo",
      priority: "medium",
      assigneeAgentId: agentId,
    });

    await db.insert(agentWakeupRequests).values({
      id: wakeupRequestId,
      companyId,
      agentId,
      source: "manual",
      status: "queued",
    });

    await db.insert(heartbeatRuns).values({
      id: heartbeatRunId,
      companyId,
      agentId,
      status: "completed",
      wakeupRequestId,
      startedAt: new Date("2026-04-02T00:00:00.000Z"),
      finishedAt: new Date("2026-04-02T00:01:00.000Z"),
    });

    await db.insert(heartbeatRunEvents).values({
      companyId,
      runId: heartbeatRunId,
      agentId,
      seq: 1,
      eventType: "log",
      message: "hello",
    });

    await db.insert(agentTaskSessions).values({
      companyId,
      agentId,
      adapterType: "codex_local",
      taskKey: "issue:delete",
      lastRunId: heartbeatRunId,
    });

    await db.insert(agentApiKeys).values({
      agentId,
      companyId,
      name: "default",
      keyHash: "hash",
    });

    await db.insert(agentRuntimeState).values({
      agentId,
      companyId,
      adapterType: "codex_local",
      lastRunId: heartbeatRunId,
      lastRunStatus: "completed",
      stateJson: {},
    });

    await db.insert(agentConfigRevisions).values({
      companyId,
      agentId,
      createdByAgentId: agentId,
      changedKeys: ["systemPrompt"],
      beforeConfig: { systemPrompt: "before" },
      afterConfig: { systemPrompt: "after" },
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
      cwd: "C:\\repo\\.worktrees\\issue",
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
      startedByRunId: heartbeatRunId,
      healthStatus: "healthy",
    });

    await db.insert(workspaceOperations).values({
      companyId,
      executionWorkspaceId,
      heartbeatRunId,
      phase: "provision",
      status: "completed",
      command: "git worktree add",
    });

    await db.insert(issueWorkProducts).values({
      companyId,
      projectId,
      issueId,
      executionWorkspaceId,
      runtimeServiceId,
      createdByRunId: heartbeatRunId,
      type: "preview",
      provider: "vite",
      title: "Preview",
      status: "ready",
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
      companyId,
      approvalId,
      authorAgentId: agentId,
      body: "please approve",
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
      approvalId,
    });

    await db.insert(assets).values([
      {
        id: primaryAssetId,
        companyId,
        provider: "local",
        objectKey: "issues/delete-me/spec.txt",
        contentType: "text/plain",
        byteSize: 12,
        sha256: "abc123",
        originalFilename: "spec.txt",
        createdByAgentId: agentId,
      },
      {
        id: logoAssetId,
        companyId,
        provider: "local",
        objectKey: "logos/delete-me.png",
        contentType: "image/png",
        byteSize: 24,
        sha256: "def456",
        originalFilename: "logo.png",
        createdByAgentId: agentId,
      },
    ]);

    await db.insert(companyLogos).values({
      companyId,
      assetId: logoAssetId,
    });

    await db.insert(issueAttachments).values({
      companyId,
      issueId,
      assetId: primaryAssetId,
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

    await db.insert(documentRevisions).values({
      id: documentRevisionId,
      companyId,
      documentId,
      revisionNumber: 1,
      body: "hello",
      createdByAgentId: agentId,
    });

    await db.insert(issueDocuments).values({
      companyId,
      issueId,
      documentId,
      key: "notes",
    });

    await db.insert(issueComments).values({
      companyId,
      issueId,
      authorAgentId: agentId,
      body: "comment",
    });

    await db.insert(issueReadStates).values({
      companyId,
      issueId,
      userId: "user-1",
    });

    await db.insert(issueInboxArchives).values({
      companyId,
      issueId,
      userId: "user-1",
    });

    await db.insert(labels).values({
      id: labelId,
      companyId,
      name: "bug",
      color: "#ff0000",
    });

    await db.insert(issueLabels).values({
      companyId,
      issueId,
      labelId,
    });

    await db.insert(companySecrets).values({
      id: secretId,
      companyId,
      name: "OPENAI_API_KEY",
      createdByAgentId: agentId,
    });

    await db.insert(companySecretVersions).values({
      secretId,
      version: 1,
      material: { ciphertext: "secret" },
      valueSha256: "secret-hash",
      createdByAgentId: agentId,
    });

    await db.insert(routines).values({
      companyId,
      projectId,
      goalId,
      parentIssueId: issueId,
      title: "Daily sync",
      assigneeAgentId: agentId,
      status: "active",
    });

    const routine = await db.select().from(routines).where(eq(routines.companyId, companyId)).then((rows) => rows[0]!);

    await db.insert(routineTriggers).values({
      companyId,
      routineId: routine.id,
      kind: "cron",
      cronExpression: "0 * * * *",
      secretId,
    });

    const routineTrigger = await db
      .select()
      .from(routineTriggers)
      .where(eq(routineTriggers.companyId, companyId))
      .then((rows) => rows[0]!);

    await db.insert(routineRuns).values({
      companyId,
      routineId: routine.id,
      triggerId: routineTrigger.id,
      source: "scheduler",
      status: "received",
      linkedIssueId: issueId,
    });

    await db.insert(costEvents).values({
      companyId,
      agentId,
      issueId,
      projectId,
      goalId,
      heartbeatRunId,
      provider: "openai",
      biller: "openai",
      billingType: "usage",
      model: "gpt-5",
      inputTokens: 10,
      outputTokens: 20,
      costCents: 42,
      occurredAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    const costEvent = await db.select().from(costEvents).where(eq(costEvents.companyId, companyId)).then((rows) => rows[0]!);

    await db.insert(financeEvents).values({
      companyId,
      agentId,
      issueId,
      projectId,
      goalId,
      heartbeatRunId,
      costEventId: costEvent.id,
      eventKind: "usage_charge",
      direction: "debit",
      biller: "openai",
      provider: "openai",
      amountCents: 42,
      currency: "USD",
      occurredAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    await db.insert(companySkills).values({
      companyId,
      key: "skills.delete-me",
      slug: "delete-me",
      name: "Delete me skill",
      markdown: "# Skill",
    });

    await db.insert(pluginCompanySettings).values({
      companyId,
      pluginId,
      enabled: true,
      settingsJson: { synced: true },
    });

    await db.insert(pluginState).values([
      {
        pluginId,
        scopeKind: "company",
        scopeId: companyId,
        namespace: "sync",
        stateKey: "company",
        valueJson: { companyId },
      },
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
        scopeKind: "agent",
        scopeId: agentId,
        namespace: "sync",
        stateKey: "agent",
        valueJson: { agentId },
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
        scopeId: goalId,
        namespace: "sync",
        stateKey: "goal",
        valueJson: { goalId },
      },
      {
        pluginId,
        scopeKind: "run",
        scopeId: heartbeatRunId,
        namespace: "sync",
        stateKey: "run",
        valueJson: { heartbeatRunId },
      },
      {
        id: otherPluginStateId,
        pluginId,
        scopeKind: "company",
        scopeId: otherCompanyId,
        namespace: "sync",
        stateKey: "company",
        valueJson: { companyId: otherCompanyId },
      },
    ]);

    await db.insert(pluginEntities).values([
      {
        pluginId,
        entityType: "company",
        scopeKind: "company",
        scopeId: companyId,
        externalId: "ext-company",
        title: "External company",
        data: {},
      },
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
    ]);

    await db.insert(companyMemberships).values({
      companyId,
      principalType: "user",
      principalId: "user-1",
      status: "active",
      membershipRole: "owner",
    });

    await db.insert(principalPermissionGrants).values({
      companyId,
      principalType: "user",
      principalId: "user-1",
      permissionKey: "company.manage",
    });

    await db.insert(invites).values({
      id: inviteId,
      companyId,
      tokenHash: "invite-hash",
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    await db.insert(joinRequests).values({
      inviteId,
      companyId,
      requestType: "agent_join",
      requestIp: "127.0.0.1",
      createdAgentId: agentId,
    });

    await db.insert(activityLog).values({
      companyId,
      actorType: "agent",
      actorId: agentId,
      action: "issue.updated",
      entityType: "issue",
      entityId: issueId,
      agentId,
      runId: heartbeatRunId,
      details: { ok: true },
    });

    const removed = await svc.remove(companyId);

    expect(removed?.id).toBe(companyId);

    await expect(db.select().from(companies).where(eq(companies.id, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(agents).where(eq(agents.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(goals).where(eq(goals.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(projects).where(eq(projects.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(projectWorkspaces).where(eq(projectWorkspaces.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(executionWorkspaces).where(eq(executionWorkspaces.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issues).where(eq(issues.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(heartbeatRuns).where(eq(heartbeatRuns.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(heartbeatRunEvents).where(eq(heartbeatRunEvents.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(agentTaskSessions).where(eq(agentTaskSessions.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(agentApiKeys).where(eq(agentApiKeys.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(agentRuntimeState).where(eq(agentRuntimeState.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(agentConfigRevisions).where(eq(agentConfigRevisions.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(workspaceRuntimeServices).where(eq(workspaceRuntimeServices.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(workspaceOperations).where(eq(workspaceOperations.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issueWorkProducts).where(eq(issueWorkProducts.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(approvals).where(eq(approvals.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issueApprovals).where(eq(issueApprovals.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(approvalComments).where(eq(approvalComments.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(budgetPolicies).where(eq(budgetPolicies.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(budgetIncidents).where(eq(budgetIncidents.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(costEvents).where(eq(costEvents.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(financeEvents).where(eq(financeEvents.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(assets).where(eq(assets.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(companyLogos).where(eq(companyLogos.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(documents).where(eq(documents.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(documentRevisions).where(eq(documentRevisions.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issueAttachments).where(eq(issueAttachments.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issueDocuments).where(eq(issueDocuments.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issueComments).where(eq(issueComments.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issueReadStates).where(eq(issueReadStates.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issueInboxArchives).where(eq(issueInboxArchives.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(labels).where(eq(labels.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(issueLabels).where(eq(issueLabels.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(companySecrets).where(eq(companySecrets.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(companySecretVersions).where(eq(companySecretVersions.secretId, secretId))).resolves.toHaveLength(0);
    await expect(db.select().from(departments).where(eq(departments.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(departmentBudgetEnvelopes).where(eq(departmentBudgetEnvelopes.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(routines).where(eq(routines.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(routineTriggers).where(eq(routineTriggers.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(routineRuns).where(eq(routineRuns.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(companySkills).where(eq(companySkills.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginCompanySettings).where(eq(pluginCompanySettings.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginState).where(eq(pluginState.scopeId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginState).where(eq(pluginState.scopeId, projectId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginState).where(eq(pluginState.scopeId, projectWorkspaceId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginState).where(eq(pluginState.scopeId, agentId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginState).where(eq(pluginState.scopeId, issueId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginState).where(eq(pluginState.scopeId, goalId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginState).where(eq(pluginState.scopeId, heartbeatRunId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginEntities).where(eq(pluginEntities.scopeId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginEntities).where(eq(pluginEntities.scopeId, projectId))).resolves.toHaveLength(0);
    await expect(db.select().from(pluginEntities).where(eq(pluginEntities.scopeId, issueId))).resolves.toHaveLength(0);
    await expect(db.select().from(joinRequests).where(eq(joinRequests.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(invites).where(eq(invites.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(companyMemberships).where(eq(companyMemberships.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(principalPermissionGrants).where(eq(principalPermissionGrants.companyId, companyId))).resolves.toHaveLength(0);
    await expect(db.select().from(activityLog).where(eq(activityLog.companyId, companyId))).resolves.toHaveLength(0);

    await expect(db.select().from(companies).where(eq(companies.id, otherCompanyId))).resolves.toHaveLength(1);
    await expect(db.select().from(agents).where(eq(agents.companyId, otherCompanyId))).resolves.toHaveLength(1);
    await expect(db.select().from(projects).where(eq(projects.id, otherProjectId))).resolves.toHaveLength(1);
    await expect(db.select().from(pluginState).where(eq(pluginState.id, otherPluginStateId))).resolves.toHaveLength(1);
  });
});
