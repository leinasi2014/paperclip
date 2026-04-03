import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { temporaryWorkerRoutes } from "../routes/temporary-workers.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const ceoAgentId = "22222222-2222-4222-8222-222222222222";
const ministerAgentId = "33333333-3333-4333-8333-333333333333";
const otherAgentId = "44444444-4444-4444-8444-444444444444";
const departmentId = "55555555-5555-4555-8555-555555555555";
const workerId = "66666666-6666-4666-8666-666666666666";
const issueId = "77777777-7777-4777-8777-777777777777";

const mockTemporaryWorkerService = vi.hoisted(() => ({
  listByDepartment: vi.fn(),
  getById: vi.fn(),
  spawn: vi.fn(),
  requestPause: vi.fn(),
  requestResume: vi.fn(),
  approveResume: vi.fn(),
  terminate: vi.fn(),
  extendTtl: vi.fn(),
  reconcileExpired: vi.fn(),
}));

const mockDepartmentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockCompanyService = vi.hoisted(() => ({
  getEffectiveCeoAgentId: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  temporaryWorkerService: () => mockTemporaryWorkerService,
  departmentService: () => mockDepartmentService,
  companyService: () => mockCompanyService,
  logActivity: mockLogActivity,
}));

function makeDepartment(overrides: Record<string, unknown> = {}) {
  return {
    id: departmentId,
    companyId,
    name: "Engineering",
    slug: "engineering",
    mission: "Build",
    status: "active",
    ministerAgentId,
    maxConcurrentTemporaryWorkers: 3,
    temporaryWorkerTtlMinutes: 480,
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    ...overrides,
  };
}

function makeWorker(overrides: Record<string, unknown> = {}) {
  return {
    id: workerId,
    companyId,
    departmentId,
    ownerMinisterAgentId: ministerAgentId,
    sourceIssueId: issueId,
    name: "Worker",
    status: "active",
    ttlExpiresAt: new Date("2026-04-03T00:00:00.000Z"),
    statusReason: null,
    resumeRequestedAt: null,
    terminatedAt: null,
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
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
  app.use("/api", temporaryWorkerRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("temporary worker routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyService.getEffectiveCeoAgentId.mockResolvedValue(ceoAgentId);
    mockDepartmentService.getById.mockResolvedValue(makeDepartment());
    mockTemporaryWorkerService.listByDepartment.mockResolvedValue([makeWorker()]);
    mockTemporaryWorkerService.getById.mockResolvedValue(makeWorker());
    mockTemporaryWorkerService.spawn.mockResolvedValue(makeWorker());
    mockTemporaryWorkerService.requestPause.mockResolvedValue(makeWorker({ status: "paused_pending_ceo_resume" }));
    mockTemporaryWorkerService.requestResume.mockResolvedValue(makeWorker({ status: "paused_pending_ceo_resume" }));
    mockTemporaryWorkerService.approveResume.mockResolvedValue(makeWorker({ status: "active" }));
    mockTemporaryWorkerService.terminate.mockResolvedValue(makeWorker({ status: "terminated", terminatedAt: new Date() }));
    mockTemporaryWorkerService.extendTtl.mockResolvedValue(makeWorker());
    mockTemporaryWorkerService.reconcileExpired.mockResolvedValue([makeWorker({ status: "ttl_expired_pending_minister" })]);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("allows the current minister to spawn a temporary worker", async () => {
    const app = createApp({
      type: "agent",
      agentId: ministerAgentId,
      companyId,
    });

    const res = await request(app)
      .post(`/api/departments/${departmentId}/temporary-workers`)
      .send({ sourceIssueId: issueId, name: "Worker" });

    expect(res.status).toBe(201);
    expect(mockTemporaryWorkerService.spawn).toHaveBeenCalledWith(
      departmentId,
      ministerAgentId,
      expect.objectContaining({ sourceIssueId: issueId, name: "Worker" }),
    );
  });

  it("rejects non-minister agents from creating temporary workers", async () => {
    const app = createApp({
      type: "agent",
      agentId: otherAgentId,
      companyId,
    });

    const res = await request(app)
      .post(`/api/departments/${departmentId}/temporary-workers`)
      .send({ sourceIssueId: issueId, name: "Worker" });

    expect(res.status).toBe(403);
  });

  it("allows the CEO to approve a temporary worker resume", async () => {
    mockTemporaryWorkerService.getById.mockResolvedValue(makeWorker({ status: "paused_pending_ceo_resume" }));
    const app = createApp({
      type: "agent",
      agentId: ceoAgentId,
      companyId,
    });

    const res = await request(app)
      .post(`/api/temporary-workers/${workerId}/approve-resume`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockTemporaryWorkerService.approveResume).toHaveBeenCalledWith(workerId);
  });

  it("allows board or CEO to reconcile expired temporary worker TTLs", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/temporary-workers/reconcile-ttl`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockTemporaryWorkerService.reconcileExpired).toHaveBeenCalledWith(companyId, undefined);
  });
});
