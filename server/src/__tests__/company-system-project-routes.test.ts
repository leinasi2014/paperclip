import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyRoutes } from "../routes/companies.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "11111111-1111-4111-8111-111111111111";

const mockCompanyService = vi.hoisted(() => ({
  list: vi.fn(),
  stats: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  remove: vi.fn(),
}));

const mockSystemProjectService = vi.hoisted(() => ({
  ensureCanonical: vi.fn(),
  reconcile: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  ensureMembership: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

const mockCompanyPortabilityService = vi.hoisted(() => ({
  exportBundle: vi.fn(),
  previewExport: vi.fn(),
  previewImport: vi.fn(),
  importBundle: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  budgetService: () => mockBudgetService,
  companyPortabilityService: () => mockCompanyPortabilityService,
  companyService: () => mockCompanyService,
  logActivity: mockLogActivity,
  requiredSystemPluginService: () => ({
    listStatus: vi.fn(),
    reconcileAll: vi.fn(),
    ensureCompanySettings: vi.fn(),
    definitions: [],
  }),
  systemProjectService: () => mockSystemProjectService,
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api/companies", companyRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("company system project routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyService.create.mockResolvedValue({
      id: companyId,
      name: "Paperclip",
      description: null,
      status: "active",
      issuePrefix: "PAP",
      issueCounter: 0,
      budgetMonthlyCents: 0,
      spentMonthlyCents: 0,
      ceoAgentId: null,
      requireBoardApprovalForNewAgents: false,
      brandColor: null,
      logoAssetId: null,
      logoUrl: null,
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    });
    mockCompanyService.getById.mockResolvedValue({
      id: companyId,
      name: "Paperclip",
    });
    mockSystemProjectService.ensureCanonical.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      companyId,
      isSystemProject: true,
      systemProjectKind: "execution_governance",
    });
    mockSystemProjectService.reconcile.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      companyId,
      isSystemProject: true,
      systemProjectKind: "execution_governance",
    });
    mockAccessService.ensureMembership.mockResolvedValue(undefined);
    mockBudgetService.upsertPolicy.mockResolvedValue(undefined);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("ensures the canonical system project when a company is created", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post("/api/companies")
      .send({ name: "Paperclip", description: null, budgetMonthlyCents: 0 });

    expect(res.status).toBe(201);
    expect(mockSystemProjectService.ensureCanonical).toHaveBeenCalledWith(companyId);
    expect(mockAccessService.ensureMembership).toHaveBeenCalledWith(
      companyId,
      "user",
      "board-user",
      "owner",
      "active",
    );
  });

  it("reconciles the canonical system project for an existing company", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app).post(`/api/companies/${companyId}/system-project/reconcile`);

    expect(res.status).toBe(200);
    expect(mockSystemProjectService.reconcile).toHaveBeenCalledWith(companyId);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId,
        action: "project.system_reconciled",
        entityType: "project",
        entityId: "22222222-2222-4222-8222-222222222222",
      }),
    );
  });
});
