import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentRoutes } from "../routes/agents.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "22222222-2222-4222-8222-222222222222";
const ceoAgentId = "11111111-1111-4111-8111-111111111111";

const baseAgent = {
  id: ceoAgentId,
  companyId,
  name: "CEO",
  urlKey: "ceo",
  role: "ceo",
  title: "CEO",
  icon: null,
  status: "idle",
  reportsTo: null,
  capabilities: null,
  adapterType: "claude_local",
  adapterConfig: {},
  runtimeConfig: {},
  budgetMonthlyCents: 0,
  spentMonthlyCents: 0,
  pauseReason: null,
  pausedAt: null,
  permissions: null,
  lastHeartbeatAt: null,
  metadata: null,
  createdAt: new Date("2026-04-02T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
};

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getChainOfCommand: vi.fn(),
  resolveByReference: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listPrincipalGrants: vi.fn(),
  setPrincipalPermission: vi.fn(),
}));

const mockApprovalService = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockCompanyService = vi.hoisted(() => ({
  getEffectiveCeoAgentId: vi.fn(),
  assignCeoAgent: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  listTaskSessions: vi.fn(),
  resetRuntimeSession: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  linkManyForApproval: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(async (_companyId: string, config: Record<string, unknown>) => config),
  resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({ config })),
}));

const mockAgentInstructionsService = vi.hoisted(() => ({
  materializeManagedBundle: vi.fn(async (agent: Record<string, unknown>, files: Record<string, string>) => ({
    bundle: null,
    adapterConfig: {
      ...((agent.adapterConfig as Record<string, unknown> | undefined) ?? {}),
      instructionsBundleMode: "managed",
      instructionsRootPath: `/tmp/${String(agent.id)}/instructions`,
      instructionsEntryFile: "AGENTS.md",
      instructionsFilePath: `/tmp/${String(agent.id)}/instructions/AGENTS.md`,
      promptTemplate: files["AGENTS.md"] ?? "",
    },
  })),
}));

const mockCompanySkillService = vi.hoisted(() => ({
  listRuntimeSkillEntries: vi.fn(async () => []),
  resolveRequestedSkillKeys: vi.fn(async (_companyId: string, requested: string[]) => requested),
}));

const mockWorkspaceOperationService = vi.hoisted(() => ({}));
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  agentInstructionsService: () => mockAgentInstructionsService,
  accessService: () => mockAccessService,
  approvalService: () => mockApprovalService,
  companyService: () => mockCompanyService,
  companySkillService: () => mockCompanySkillService,
  budgetService: () => mockBudgetService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  secretService: () => mockSecretService,
  syncInstructionsBundleConfigFromFilePath: vi.fn((_agent, config) => config),
  workspaceOperationService: () => mockWorkspaceOperationService,
}));

function createDbStub(requireBoardApprovalForNewAgents = false) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: vi.fn().mockResolvedValue([{
            id: companyId,
            name: "Paperclip",
            requireBoardApprovalForNewAgents,
          }]),
        }),
      }),
    }),
  };
}

function createApp(db: Record<string, unknown> = createDbStub()) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    };
    next();
  });
  app.use("/api", agentRoutes(db as any));
  app.use(errorHandler);
  return app;
}

describe("agent CEO seat routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.create.mockResolvedValue(baseAgent);
    mockAgentService.update.mockResolvedValue(baseAgent);
    mockAgentService.getById.mockResolvedValue(baseAgent);
    mockAgentService.getChainOfCommand.mockResolvedValue([]);
    mockAgentService.resolveByReference.mockResolvedValue({ ambiguous: false, agent: baseAgent });
    mockAccessService.getMembership.mockResolvedValue(null);
    mockAccessService.listPrincipalGrants.mockResolvedValue([]);
    mockAccessService.ensureMembership.mockResolvedValue(undefined);
    mockAccessService.setPrincipalPermission.mockResolvedValue(undefined);
    mockApprovalService.create.mockResolvedValue({
      id: "approval-1",
      companyId,
      type: "hire_agent",
      status: "pending",
      payload: {},
    });
    mockCompanyService.getEffectiveCeoAgentId.mockResolvedValue(null);
    mockCompanyService.assignCeoAgent.mockResolvedValue(undefined);
    mockBudgetService.upsertPolicy.mockResolvedValue(undefined);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("rejects creating a second CEO when the company already has one", async () => {
    mockCompanyService.getEffectiveCeoAgentId.mockResolvedValue("existing-ceo-id");

    const res = await request(createApp())
      .post(`/api/companies/${companyId}/agents`)
      .send({
        name: "CEO",
        role: "ceo",
        adapterType: "claude_local",
        adapterConfig: {},
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("already has a CEO");
    expect(mockAgentService.create).not.toHaveBeenCalled();
  });

  it("assigns the CEO seat after creating the first CEO directly", async () => {
    const res = await request(createApp())
      .post(`/api/companies/${companyId}/agents`)
      .send({
        name: "CEO",
        role: "ceo",
        adapterType: "claude_local",
        adapterConfig: {},
      });

    expect(res.status).toBe(201);
    expect(mockCompanyService.assignCeoAgent).toHaveBeenCalledWith(companyId, ceoAgentId);
  });

  it("assigns the CEO seat after a direct CEO hire when no approval is required", async () => {
    const res = await request(createApp(createDbStub(false)))
      .post(`/api/companies/${companyId}/agent-hires`)
      .send({
        name: "CEO",
        role: "ceo",
        adapterType: "claude_local",
        adapterConfig: {},
      });

    expect(res.status).toBe(201);
    expect(mockCompanyService.assignCeoAgent).toHaveBeenCalledWith(companyId, ceoAgentId);
  });
});
