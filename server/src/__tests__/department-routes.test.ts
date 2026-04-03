import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, unprocessable } from "../errors.js";
import { departmentRoutes } from "../routes/departments.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const ceoAgentId = "22222222-2222-4222-8222-222222222222";
const ministerAgentId = "33333333-3333-4333-8333-333333333333";
const otherAgentId = "44444444-4444-4444-8444-444444444444";
const departmentId = "55555555-5555-4555-8555-555555555555";

const mockDepartmentService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  assignMinister: vi.fn(),
  removeMinister: vi.fn(),
  freeze: vi.fn(),
  unfreeze: vi.fn(),
}));

const mockDepartmentBudgetService = vi.hoisted(() => ({
  getByDepartmentId: vi.fn(),
  allocate: vi.fn(),
}));

const mockCompanyService = vi.hoisted(() => ({
  getEffectiveCeoAgentId: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  departmentService: () => mockDepartmentService,
  departmentBudgetService: () => mockDepartmentBudgetService,
  companyService: () => mockCompanyService,
  logActivity: mockLogActivity,
}));

function makeDepartment(overrides: Record<string, unknown> = {}) {
  return {
    id: departmentId,
    companyId,
    name: "Engineering",
    slug: "engineering",
    mission: "Build the product",
    status: "active",
    ministerAgentId,
    maxConcurrentTemporaryWorkers: 3,
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    ...overrides,
  };
}

function makeBudget(overrides: Record<string, unknown> = {}) {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    departmentId,
    companyId,
    monthlyLimitCents: 50_000,
    reservedCents: 1_000,
    spentCents: 500,
    status: "active",
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
  app.use("/api", departmentRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("department routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyService.getEffectiveCeoAgentId.mockResolvedValue(ceoAgentId);
    mockDepartmentService.list.mockResolvedValue([]);
    mockDepartmentService.getById.mockResolvedValue(makeDepartment());
    mockDepartmentService.create.mockResolvedValue(makeDepartment());
    mockDepartmentService.update.mockResolvedValue(makeDepartment());
    mockDepartmentService.assignMinister.mockResolvedValue(makeDepartment());
    mockDepartmentService.removeMinister.mockResolvedValue(
      makeDepartment({ ministerAgentId: null, status: "frozen_unstaffed" }),
    );
    mockDepartmentService.freeze.mockResolvedValue(makeDepartment({ status: "frozen_suspended" }));
    mockDepartmentService.unfreeze.mockResolvedValue(makeDepartment({ status: "active" }));
    mockDepartmentBudgetService.getByDepartmentId.mockResolvedValue(makeBudget());
    mockDepartmentBudgetService.allocate.mockResolvedValue(makeBudget({ monthlyLimitCents: 75_000 }));
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("allows board actors to create a department", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/departments`)
      .send({
        name: "Engineering",
        slug: "engineering",
        mission: "Build the product",
      });

    expect(res.status).toBe(201);
    expect(mockDepartmentService.create).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        name: "Engineering",
        slug: "engineering",
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId,
        action: "department.created",
        entityType: "department",
        entityId: departmentId,
      }),
    );
  });

  it("allows the effective CEO agent to create a department", async () => {
    const app = createApp({
      type: "agent",
      agentId: ceoAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/departments`)
      .send({
        name: "Design",
        slug: "design",
      });

    expect(res.status).toBe(201);
    expect(mockDepartmentService.create).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({ name: "Design", slug: "design" }),
    );
  });

  it("rejects non-CEO agents from managing departments", async () => {
    const app = createApp({
      type: "agent",
      agentId: otherAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/departments`)
      .send({
        name: "Operations",
        slug: "operations",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Only board users or the company CEO");
    expect(mockDepartmentService.create).not.toHaveBeenCalled();
  });

  it("rejects cross-company actors from listing departments", async () => {
    const app = createApp({
      type: "agent",
      agentId: ceoAgentId,
      companyId: "99999999-9999-4999-8999-999999999999",
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app).get(`/api/companies/${companyId}/departments`);

    expect(res.status).toBe(403);
    expect(mockDepartmentService.list).not.toHaveBeenCalled();
  });

  it("returns 404 when department detail does not exist", async () => {
    mockDepartmentService.getById.mockResolvedValueOnce(null);
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app).get(`/api/departments/${departmentId}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Department not found");
  });

  it("allows the department minister to read the department budget", async () => {
    const app = createApp({
      type: "agent",
      agentId: ministerAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app).get(`/api/departments/${departmentId}/budget`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      departmentId,
      companyId,
      monthlyLimitCents: 50_000,
    });
  });

  it("rejects unrelated agents from reading the department budget", async () => {
    const app = createApp({
      type: "agent",
      agentId: otherAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });

    const res = await request(app).get(`/api/departments/${departmentId}/budget`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("department minister");
  });

  it("surfaces service validation failures with 422 responses", async () => {
    mockDepartmentService.assignMinister.mockRejectedValueOnce(
      unprocessable("Minister must belong to the same company"),
    );
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/departments/${departmentId}/assign-minister`)
      .send({ agentId: ministerAgentId });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Minister must belong to the same company");
  });

  it("maps service conflicts to 409 responses", async () => {
    mockDepartmentService.create.mockRejectedValueOnce(
      conflict("Department slug already exists in this company"),
    );
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/departments`)
      .send({
        name: "Engineering",
        slug: "engineering",
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Department slug already exists in this company");
  });

  it("writes budget allocation activity and returns 422 from service validation", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const ok = await request(app)
      .post(`/api/departments/${departmentId}/budget/allocate`)
      .send({ monthlyLimitCents: 75_000 });

    expect(ok.status).toBe(200);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "department.budget_allocated",
        entityType: "department",
        entityId: departmentId,
      }),
    );

    mockDepartmentBudgetService.allocate.mockRejectedValueOnce(
      unprocessable("Department budget exceeds company limit"),
    );
    const failed = await request(app)
      .post(`/api/departments/${departmentId}/budget/allocate`)
      .send({ monthlyLimitCents: 75_000 });

    expect(failed.status).toBe(422);
    expect(failed.body.error).toBe("Department budget exceeds company limit");
  });

  it("rejects former ministers and cross-company CEOs from reading budget", async () => {
    const oldMinisterApp = createApp({
      type: "agent",
      agentId: otherAgentId,
      companyId,
      source: "agent_key",
      runId: "run-1",
    });
    const oldMinisterRes = await request(oldMinisterApp).get(`/api/departments/${departmentId}/budget`);
    expect(oldMinisterRes.status).toBe(403);

    const crossCompanyCeo = createApp({
      type: "agent",
      agentId: ceoAgentId,
      companyId: "99999999-9999-4999-8999-999999999999",
      source: "agent_key",
      runId: "run-1",
    });
    const crossCompanyRes = await request(crossCompanyCeo).get(`/api/departments/${departmentId}/budget`);
    expect(crossCompanyRes.status).toBe(403);
  });
});
