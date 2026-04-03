import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, unprocessable } from "../errors.js";
import { systemIssueRoutes } from "../routes/system-issues.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const ceoAgentId = "22222222-2222-4222-8222-222222222222";
const otherAgentId = "33333333-3333-4333-8333-333333333333";
const systemIssueId = "44444444-4444-4444-8444-444444444444";
const departmentId = "55555555-5555-4555-8555-555555555555";

const mockSystemIssueService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  route: vi.fn(),
  setBlockRecommendation: vi.fn(),
  startTriage: vi.fn(),
  requestReview: vi.fn(),
  review: vi.fn(),
  requestResume: vi.fn(),
  approveResume: vi.fn(),
  close: vi.fn(),
}));

const mockCompanyService = vi.hoisted(() => ({
  getEffectiveCeoAgentId: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  systemIssueService: () => mockSystemIssueService,
  companyService: () => mockCompanyService,
  logActivity: mockLogActivity,
}));

function makeSystemIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: systemIssueId,
    companyId,
    projectId: "66666666-6666-4666-8666-666666666666",
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Execution chain blocked",
    description: null,
    status: "backlog",
    priority: "high",
    assigneeAgentId: null,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: 1,
    identifier: "PAP-1",
    originKind: "manual",
    originId: null,
    originRunId: null,
    requestDepth: 0,
    owningDepartmentId: null,
    systemIssueType: "execution",
    systemIssueSeverity: "critical",
    systemIssueWorkflowState: "open",
    blockRecommended: false,
    isInCeoIntake: true,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    labels: [],
    labelIds: [],
    ...overrides,
  };
}

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", systemIssueRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("system issue routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyService.getEffectiveCeoAgentId.mockResolvedValue(ceoAgentId);
    mockSystemIssueService.list.mockResolvedValue([makeSystemIssue()]);
    mockSystemIssueService.getById.mockResolvedValue(makeSystemIssue());
    mockSystemIssueService.create.mockResolvedValue(makeSystemIssue());
    mockSystemIssueService.update.mockResolvedValue(makeSystemIssue({ title: "Updated" }));
    mockSystemIssueService.route.mockResolvedValue(
      makeSystemIssue({ owningDepartmentId: departmentId, isInCeoIntake: false }),
    );
    mockSystemIssueService.setBlockRecommendation.mockResolvedValue(
      makeSystemIssue({ blockRecommended: true }),
    );
    mockSystemIssueService.startTriage.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "triaging" }),
    );
    mockSystemIssueService.requestReview.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "pending_review", owningDepartmentId: departmentId, isInCeoIntake: false }),
    );
    mockSystemIssueService.review.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "ready_to_resume", blockRecommended: true }),
    );
    mockSystemIssueService.requestResume.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "ready_to_resume", blockRecommended: true }),
    );
    mockSystemIssueService.approveResume.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "in_progress", blockRecommended: false }),
    );
    mockSystemIssueService.close.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "done", status: "done", blockRecommended: false }),
    );
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("allows board actors to create a system issue", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/system-issues`)
      .send({
        title: "Execution chain blocked",
        systemIssueType: "execution",
        systemIssueSeverity: "critical",
      });

    expect(res.status).toBe(201);
    expect(mockSystemIssueService.create).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        title: "Execution chain blocked",
        systemIssueType: "execution",
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "system_issue.created",
        entityType: "issue",
        entityId: systemIssueId,
      }),
    );
  });

  it("rejects create requests that try to pre-route a system issue into a department", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/system-issues`)
      .send({
        title: "Execution chain blocked",
        systemIssueType: "execution",
        systemIssueSeverity: "critical",
        owningDepartmentId: departmentId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(mockSystemIssueService.create).not.toHaveBeenCalled();
  });

  it("allows the effective CEO agent to route a system issue", async () => {
    const app = createApp({
      type: "agent",
      agentId: ceoAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/route`)
      .send({ owningDepartmentId: departmentId });

    expect(res.status).toBe(200);
    expect(mockSystemIssueService.route).toHaveBeenCalledWith(
      systemIssueId,
      departmentId,
      {
        actorType: "agent",
        actorId: ceoAgentId,
        agentId: ceoAgentId,
      },
    );
  });

  it("rejects non-CEO agents from managing system issues", async () => {
    const app = createApp({
      type: "agent",
      agentId: otherAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .patch(`/api/system-issues/${systemIssueId}`)
      .send({ title: "Nope" });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Only board users or the company CEO");
    expect(mockSystemIssueService.update).not.toHaveBeenCalled();
  });

  it("rejects metadata patch requests that try to mutate workflow state directly", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .patch(`/api/system-issues/${systemIssueId}`)
      .send({ systemIssueWorkflowState: "done" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(mockSystemIssueService.update).not.toHaveBeenCalled();
  });

  it("lets company-scoped actors list system issues with query filters", async () => {
    const app = createApp({
      type: "agent",
      agentId: otherAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .get(`/api/companies/${companyId}/system-issues`)
      .query({ type: "execution", inCeoIntake: "true", blockRecommended: "false" });

    expect(res.status).toBe(200);
    expect(mockSystemIssueService.list).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        type: "execution",
        inCeoIntake: true,
        blockRecommended: false,
      }),
    );
  });

  it("returns 404 when the system issue does not exist", async () => {
    mockSystemIssueService.getById.mockResolvedValueOnce(null);
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app).get(`/api/system-issues/${systemIssueId}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("System issue not found");
  });

  it("updates block recommendation as an advisory flag", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/block-recommendation`)
      .send({ blockRecommended: true });

    expect(res.status).toBe(200);
    expect(mockSystemIssueService.setBlockRecommendation).toHaveBeenCalledWith(systemIssueId, true);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "system_issue.block_recommendation_updated",
        entityType: "issue",
        entityId: systemIssueId,
      }),
    );
  });

  it("surfaces service validation failures with 422 responses", async () => {
    mockSystemIssueService.route.mockRejectedValueOnce(
      unprocessable("System issue department must belong to the same company"),
    );
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/route`)
      .send({ owningDepartmentId: departmentId });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("System issue department must belong to the same company");
  });

  it("lets the CEO start triage for a system issue", async () => {
    const app = createApp({
      type: "agent",
      agentId: ceoAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/start-triage`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockSystemIssueService.startTriage).toHaveBeenCalledWith(systemIssueId);
  });

  it("lets a minister request review for a routed system issue", async () => {
    mockSystemIssueService.getById.mockResolvedValue(
      makeSystemIssue({ owningDepartmentId: departmentId, isInCeoIntake: false, systemIssueWorkflowState: "in_progress" }),
    );
    const app = createApp({
      type: "agent",
      agentId: otherAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/request-review`)
      .send({ notes: "ready" });

    expect(res.status).toBe(200);
    expect(mockSystemIssueService.requestReview).toHaveBeenCalledWith(systemIssueId, {
      actorType: "agent",
      actorId: otherAgentId,
      agentId: otherAgentId,
    });
  });

  it("rejects board actors that try to request review directly", async () => {
    mockSystemIssueService.getById.mockResolvedValue(
      makeSystemIssue({ owningDepartmentId: departmentId, isInCeoIntake: false, systemIssueWorkflowState: "in_progress" }),
    );
    mockSystemIssueService.requestReview.mockRejectedValueOnce(new Error("should not be called"));
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/request-review`)
      .send({ notes: "ready" });

    expect(res.status).toBe(403);
    expect(mockSystemIssueService.requestReview).not.toHaveBeenCalled();
  });

  it("records a review decision", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/review`)
      .send({ approved: true, notes: "looks good" });

    expect(res.status).toBe(200);
    expect(mockSystemIssueService.review).toHaveBeenCalledWith(
      systemIssueId,
      { actorType: "user", actorId: "board-user" },
      true,
    );
  });

  it("lets the CEO approve resume", async () => {
    mockSystemIssueService.getById.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "ready_to_resume", blockRecommended: true }),
    );
    const app = createApp({
      type: "agent",
      agentId: ceoAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/approve-resume`)
      .send({ notes: "resume" });

    expect(res.status).toBe(200);
    expect(mockSystemIssueService.approveResume).toHaveBeenCalledWith(systemIssueId);
  });

  it("lets board actors close a system issue", async () => {
    mockSystemIssueService.getById.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "review_passed" }),
    );
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/close`)
      .send({ notes: "done" });

    expect(res.status).toBe(200);
    expect(mockSystemIssueService.close).toHaveBeenCalledWith(systemIssueId);
  });

  it("surfaces a conflict when trying to close an in-progress system issue", async () => {
    mockSystemIssueService.getById.mockResolvedValue(
      makeSystemIssue({ systemIssueWorkflowState: "in_progress" }),
    );
    mockSystemIssueService.close.mockRejectedValueOnce(conflict("System issue is not in a closable state"));
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-issues/${systemIssueId}/close`)
      .send({ notes: "done" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("System issue is not in a closable state");
  });
});
