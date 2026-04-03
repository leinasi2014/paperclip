import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";
import { conflict } from "../errors.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const issueId = "22222222-2222-4222-8222-222222222222";
const departmentId = "33333333-3333-4333-8333-333333333333";
const ceoAgentId = "44444444-4444-4444-8444-444444444444";
const ministerAgentId = "55555555-5555-4555-8555-555555555555";
const outsiderAgentId = "66666666-6666-4666-8666-666666666666";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
}));

const mockIssueRoutingService = vi.hoisted(() => ({
  route: vi.fn(),
  ministerIntake: vi.fn(),
}));

const mockCompanyService = vi.hoisted(() => ({
  getEffectiveCeoAgentId: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../services/index.js", () => ({
  accessService: () => ({
    canUser: vi.fn(),
    hasPermission: vi.fn(),
  }),
  agentService: () => ({
    getById: vi.fn(),
  }),
  companyService: () => mockCompanyService,
  documentService: () => ({}),
  executionWorkspaceService: () => ({
    getById: vi.fn(),
  }),
  goalService: () => ({
    getById: vi.fn(),
    getDefaultCompanyGoal: vi.fn(),
  }),
  heartbeatService: () => ({
    wakeup: vi.fn(async () => undefined),
    reportRunActivity: vi.fn(async () => undefined),
    getRun: vi.fn(async () => null),
    getActiveRunForAgent: vi.fn(async () => null),
    cancelRun: vi.fn(async () => null),
  }),
  issueApprovalService: () => ({}),
  issueRoutingService: () => mockIssueRoutingService,
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  projectService: () => ({
    getById: vi.fn(),
    listByIds: vi.fn(async () => []),
  }),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => ({
    listForIssue: vi.fn(async () => []),
  }),
}));

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: issueId,
    companyId,
    title: "Department routed issue",
    description: null,
    status: "todo",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    identifier: "PAP-42",
    owningDepartmentId: null,
    departmentIntakeStatus: "ceo_intake",
    isInCeoIntake: true,
    ministerDecisionResponse: null,
    ministerDecisionReason: null,
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
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("issue department routing routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.getByIdentifier.mockResolvedValue(null);
    mockIssueService.getById.mockResolvedValue(makeIssue());
    mockCompanyService.getEffectiveCeoAgentId.mockResolvedValue(ceoAgentId);
    mockIssueRoutingService.route.mockResolvedValue(
      makeIssue({
        owningDepartmentId: departmentId,
        departmentIntakeStatus: "routed",
        isInCeoIntake: false,
      }),
    );
    mockIssueRoutingService.ministerIntake.mockResolvedValue(
      makeIssue({
        owningDepartmentId: departmentId,
        departmentIntakeStatus: "accepted",
        isInCeoIntake: false,
        ministerDecisionResponse: "accept",
        ministerDecisionReason: "Looks good",
      }),
    );
  });

  it("allows board actors to route issues into a department", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/issues/${issueId}/route-to-department`)
      .send({ owningDepartmentId: departmentId });

    expect(res.status).toBe(200);
    expect(mockIssueRoutingService.route).toHaveBeenCalledWith(
      issueId,
      departmentId,
      expect.objectContaining({
        actorType: "user",
        actorId: "board-user",
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.routed_to_department",
        entityType: "issue",
        entityId: issueId,
      }),
    );
  });

  it("returns 404 when routing a missing issue", async () => {
    mockIssueService.getById.mockResolvedValueOnce(null);
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/issues/${issueId}/route-to-department`)
      .send({ owningDepartmentId: departmentId });

    expect(res.status).toBe(404);
    expect(mockIssueRoutingService.route).not.toHaveBeenCalled();
  });

  it("rejects non-CEO agents from routing issues to departments", async () => {
    const app = createApp({
      type: "agent",
      agentId: outsiderAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .post(`/api/issues/${issueId}/route-to-department`)
      .send({ owningDepartmentId: departmentId });

    expect(res.status).toBe(403);
    expect(mockIssueRoutingService.route).not.toHaveBeenCalled();
  });

  it("allows the current minister to accept routed work", async () => {
    const app = createApp({
      type: "agent",
      agentId: ministerAgentId,
      companyId,
      source: "agent_key",
      runId: "run-2",
    });

    const res = await request(app)
      .post(`/api/issues/${issueId}/minister-intake`)
      .send({ response: "accept", reason: "Looks good" });

    expect(res.status).toBe(200);
    expect(mockIssueRoutingService.ministerIntake).toHaveBeenCalledWith(
      issueId,
      ministerAgentId,
      "accept",
      "Looks good",
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.minister_intake_recorded",
        entityType: "issue",
        entityId: issueId,
      }),
    );
  });

  it("surfaces minister rejection decisions without pretending the work stayed assigned", async () => {
    mockIssueRoutingService.ministerIntake.mockResolvedValueOnce(
      makeIssue({
        owningDepartmentId: null,
        departmentIntakeStatus: "rejected",
        isInCeoIntake: true,
        ministerDecisionResponse: "reject",
        ministerDecisionReason: "Out of charter",
      }),
    );
    const app = createApp({
      type: "agent",
      agentId: ministerAgentId,
      companyId,
      source: "agent_key",
      runId: "run-2",
    });

    const res = await request(app)
      .post(`/api/issues/${issueId}/minister-intake`)
      .send({ response: "reject", reason: "Out of charter" });

    expect(res.status).toBe(200);
    expect(res.body.owningDepartmentId).toBeNull();
    expect(res.body.departmentIntakeStatus).toBe("rejected");
    expect(res.body.isInCeoIntake).toBe(true);
  });

  it("rejects board actors from submitting minister intake decisions", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/issues/${issueId}/minister-intake`)
      .send({ response: "accept" });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Only the current department minister");
    expect(mockIssueRoutingService.ministerIntake).not.toHaveBeenCalled();
  });

  it("returns validation errors for invalid minister intake responses", async () => {
    const app = createApp({
      type: "agent",
      agentId: ministerAgentId,
      companyId,
      source: "agent_key",
      runId: "run-2",
    });

    const res = await request(app)
      .post(`/api/issues/${issueId}/minister-intake`)
      .send({ response: "bad-response" });

    expect(res.status).toBe(400);
    expect(mockIssueRoutingService.ministerIntake).not.toHaveBeenCalled();
  });

  it("surfaces service conflicts for non-current ministers", async () => {
    mockIssueRoutingService.ministerIntake.mockRejectedValueOnce(
      conflict("Only the current department minister can submit an intake decision"),
    );
    const app = createApp({
      type: "agent",
      agentId: outsiderAgentId,
      companyId,
      source: "agent_key",
      runId: "run-3",
    });

    const res = await request(app)
      .post(`/api/issues/${issueId}/minister-intake`)
      .send({ response: "accept" });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Only the current department minister");
  });
});
