import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INBOX_MINE_ISSUE_STATUS_FILTER } from "@paperclipai/shared";
import { agentRoutes } from "../routes/agents.js";
import { errorHandler } from "../middleware/index.js";

const agentId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

const baseAgent = {
  id: agentId,
  companyId,
  name: "Builder",
  urlKey: "builder",
  role: "engineer",
  title: "Builder",
  icon: null,
  status: "idle",
  reportsTo: null,
  capabilities: null,
  adapterType: "process",
  adapterConfig: {},
  runtimeConfig: {},
  budgetMonthlyCents: 0,
  spentMonthlyCents: 0,
  pauseReason: null,
  pausedAt: null,
  permissions: { canCreateAgents: false, canUpdateDirectReportProfiles: false },
  lastHeartbeatAt: null,
  metadata: null,
  createdAt: new Date("2026-03-19T00:00:00.000Z"),
  updatedAt: new Date("2026-03-19T00:00:00.000Z"),
};

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updatePermissions: vi.fn(),
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
  getById: vi.fn(),
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
  normalizeAdapterConfigForPersistence: vi.fn(),
  resolveAdapterConfigForRuntime: vi.fn(),
}));

const mockAgentInstructionsService = vi.hoisted(() => ({
  materializeManagedBundle: vi.fn(),
}));
const mockCompanySkillService = vi.hoisted(() => ({
  listRuntimeSkillEntries: vi.fn(),
  resolveRequestedSkillKeys: vi.fn(),
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

function createDbStub(options?: {
  snapshot?: () => unknown;
  restore?: (snapshot: unknown) => void;
}) {
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: vi.fn().mockResolvedValue([{
            id: companyId,
            name: "Paperclip",
            requireBoardApprovalForNewAgents: false,
          }]),
        }),
      }),
    }),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = options?.snapshot ? options.snapshot() : undefined;
      try {
        return await fn(db);
      } catch (error) {
        if (options?.restore) {
          options.restore(snapshot);
        }
        throw error;
      }
    }),
  };
  return db;
}

function createApp(actor: Record<string, unknown>, db: Record<string, unknown> = createDbStub()) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", agentRoutes(db as any));
  app.use(errorHandler);
  return app;
}

describe("agent permission routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.getById.mockResolvedValue(baseAgent);
    mockAgentService.getChainOfCommand.mockResolvedValue([]);
    mockAgentService.resolveByReference.mockResolvedValue({ ambiguous: false, agent: baseAgent });
    mockAgentService.create.mockResolvedValue(baseAgent);
    mockAgentService.updatePermissions.mockResolvedValue(baseAgent);
    mockAgentService.update.mockImplementation(async (id: string, patch: Record<string, unknown>) => ({
      ...baseAgent,
      id,
      ...patch,
    }));
    mockAccessService.getMembership.mockResolvedValue({
      id: "membership-1",
      companyId,
      principalType: "agent",
      principalId: agentId,
      status: "active",
      membershipRole: "member",
      createdAt: new Date("2026-03-19T00:00:00.000Z"),
      updatedAt: new Date("2026-03-19T00:00:00.000Z"),
    });
    mockAccessService.listPrincipalGrants.mockResolvedValue([]);
    mockAccessService.ensureMembership.mockResolvedValue(undefined);
    mockAccessService.setPrincipalPermission.mockResolvedValue(undefined);
    mockCompanyService.getEffectiveCeoAgentId.mockResolvedValue(null);
    mockCompanyService.assignCeoAgent.mockResolvedValue(undefined);
    mockCompanySkillService.listRuntimeSkillEntries.mockResolvedValue([]);
    mockCompanySkillService.resolveRequestedSkillKeys.mockImplementation(async (_companyId, requested) => requested);
    mockBudgetService.upsertPolicy.mockResolvedValue(undefined);
    mockAgentInstructionsService.materializeManagedBundle.mockImplementation(
      async (agent: Record<string, unknown>, files: Record<string, string>) => ({
        bundle: null,
        adapterConfig: {
          ...((agent.adapterConfig as Record<string, unknown> | undefined) ?? {}),
          instructionsBundleMode: "managed",
          instructionsRootPath: `/tmp/${String(agent.id)}/instructions`,
          instructionsEntryFile: "AGENTS.md",
          instructionsFilePath: `/tmp/${String(agent.id)}/instructions/AGENTS.md`,
          promptTemplate: files["AGENTS.md"] ?? "",
        },
      }),
    );
    mockCompanySkillService.listRuntimeSkillEntries.mockResolvedValue([]);
    mockCompanySkillService.resolveRequestedSkillKeys.mockImplementation(
      async (_companyId: string, requested: string[]) => requested,
    );
    mockSecretService.normalizeAdapterConfigForPersistence.mockImplementation(async (_companyId, config) => config);
    mockSecretService.resolveAdapterConfigForRuntime.mockImplementation(async (_companyId, config) => ({ config }));
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("grants tasks:assign by default when board creates a new agent", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/agents`)
      .send({
        name: "Builder",
        role: "engineer",
        adapterType: "process",
        adapterConfig: {},
      });

    expect(res.status).toBe(201);
    expect(mockAccessService.ensureMembership).toHaveBeenCalledWith(
      companyId,
      "agent",
      agentId,
      "member",
      "active",
    );
    expect(mockAccessService.setPrincipalPermission).toHaveBeenCalledWith(
      companyId,
      "agent",
      agentId,
      "tasks:assign",
      true,
      "board-user",
    );
  });

  it("exposes explicit task assignment access on agent detail", async () => {
    mockAccessService.listPrincipalGrants.mockResolvedValue([
      {
        id: "grant-1",
        companyId,
        principalType: "agent",
        principalId: agentId,
        permissionKey: "tasks:assign",
        scope: null,
        grantedByUserId: "board-user",
        createdAt: new Date("2026-03-19T00:00:00.000Z"),
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
      },
    ]);

    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await request(app).get(`/api/agents/${agentId}`);

    expect(res.status).toBe(200);
    expect(res.body.access.canAssignTasks).toBe(true);
    expect(res.body.access.taskAssignSource).toBe("explicit_grant");
  });

  it("keeps task assignment enabled when agent creation privilege is enabled", async () => {
    mockAgentService.updatePermissions.mockResolvedValue({
      ...baseAgent,
      permissions: { canCreateAgents: true, canUpdateDirectReportProfiles: false },
    });

    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await request(app)
      .patch(`/api/agents/${agentId}/permissions`)
      .send({ canCreateAgents: true, canAssignTasks: false });

    expect(res.status).toBe(200);
    expect(mockAccessService.setPrincipalPermission).toHaveBeenCalledWith(
      companyId,
      "agent",
      agentId,
      "tasks:assign",
      true,
      "board-user",
    );
    expect(res.body.access.canAssignTasks).toBe(true);
    expect(res.body.access.taskAssignSource).toBe("agent_creator");
  });

  it("allows the board to batch update basic agent profile fields", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await request(app)
      .patch(`/api/companies/${companyId}/agents/basic-profile`)
      .send({
        updates: [
          {
            agentId,
            name: "Platform CTO",
            title: "Chief Technology Officer",
            icon: "crown",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(mockAgentService.update).toHaveBeenCalledWith(
      agentId,
      {
        name: "Platform CTO",
        title: "Chief Technology Officer",
        icon: "crown",
      },
      expect.objectContaining({
        recordRevision: expect.objectContaining({
          source: "basic_profile_batch",
        }),
      }),
    );
    expect(res.body).toEqual([
      expect.objectContaining({
        id: agentId,
        name: "Platform CTO",
        title: "Chief Technology Officer",
        icon: "crown",
      }),
    ]);
  });

  it("allows scoped managers to batch update direct reports only", async () => {
    const managerId = "33333333-3333-4333-8333-333333333333";
    const directReportId = "44444444-4444-4444-8444-444444444444";
    const manager = {
      ...baseAgent,
      id: managerId,
      role: "cto",
      permissions: { canCreateAgents: false, canUpdateDirectReportProfiles: true },
    };
    const directReport = {
      ...baseAgent,
      id: directReportId,
      reportsTo: managerId,
    };
    mockAgentService.getById.mockImplementation(async (id: string) => {
      if (id === managerId) return manager;
      if (id === directReportId) return directReport;
      return baseAgent;
    });
    mockAgentService.update.mockImplementation(async (id: string, patch: Record<string, unknown>) => ({
      ...directReport,
      id,
      ...patch,
    }));

    const app = createApp({
      type: "agent",
      agentId: managerId,
      companyId,
      runId: "run-1",
      source: "agent_key",
    });

    const res = await request(app)
      .patch(`/api/companies/${companyId}/agents/basic-profile`)
      .send({
        updates: [
          {
            agentId: directReportId,
            name: "Frontend Designer",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(mockAgentService.update).toHaveBeenCalledWith(
      directReportId,
      { name: "Frontend Designer" },
      expect.any(Object),
    );
  });

  it("rolls back the batch when a later profile update activity write fails", async () => {
    const firstAgentId = "44444444-4444-4444-8444-444444444444";
    const secondAgentId = "55555555-5555-4555-8555-555555555555";
    const agentState = new Map<string, typeof baseAgent>([
      [firstAgentId, { ...baseAgent, id: firstAgentId, name: "Designer One" }],
      [secondAgentId, { ...baseAgent, id: secondAgentId, name: "Designer Two" }],
    ]);
    mockAgentService.getById.mockImplementation(async (id: string) => agentState.get(id) ?? null);
    mockAgentService.update.mockImplementation(async (id: string, patch: Record<string, unknown>) => {
      const current = agentState.get(id);
      if (!current) return null;
      const next = { ...current, ...patch, updatedAt: new Date("2026-03-20T00:00:00.000Z") };
      agentState.set(id, next);
      return next;
    });
    mockLogActivity
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("activity write failed"));

    const db = createDbStub({
      snapshot: () => Array.from(agentState.entries()).map(([id, value]) => [id, { ...value }]),
      restore: (snapshot) => {
        agentState.clear();
        for (const [id, value] of snapshot as Array<[string, typeof baseAgent]>) {
          agentState.set(id, value);
        }
      },
    });
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    }, db);

    const res = await request(app)
      .patch(`/api/companies/${companyId}/agents/basic-profile`)
      .send({
        updates: [
          { agentId: firstAgentId, name: "Renamed One" },
          { agentId: secondAgentId, name: "Renamed Two" },
        ],
      });

    expect(res.status).toBe(500);
    expect(agentState.get(firstAgentId)?.name).toBe("Designer One");
    expect(agentState.get(secondAgentId)?.name).toBe("Designer Two");
  });

  it("exposes a dedicated agent route for the inbox mine view", async () => {
    mockIssueService.list.mockResolvedValue([
      {
        id: "issue-1",
        identifier: "PAP-910",
        title: "Inbox follow-up",
        status: "todo",
      },
    ]);

    const app = createApp({
      type: "agent",
      agentId,
      companyId,
      runId: "run-1",
      source: "agent_key",
    });

    const res = await request(app)
      .get("/api/agents/me/inbox/mine")
      .query({ userId: "board-user" });

    expect(res.status).toBe(200);
    expect(mockIssueService.list).toHaveBeenCalledWith(companyId, {
      touchedByUserId: "board-user",
      inboxArchivedByUserId: "board-user",
      status: INBOX_MINE_ISSUE_STATUS_FILTER,
    });
    expect(res.body).toEqual([
      {
        id: "issue-1",
        identifier: "PAP-910",
        title: "Inbox follow-up",
        status: "todo",
      },
    ]);
  });
});
