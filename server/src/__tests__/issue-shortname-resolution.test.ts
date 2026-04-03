import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { issueRoutes } from "../routes/issues.js";

const missingIssueId = "00000000-0000-0000-0000-000000000000";
const existingIssueId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  getAncestors: vi.fn(),
  findMentionedProjectIds: vi.fn(),
  listComments: vi.fn(),
  listAttachments: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  listApprovalsForIssue: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => ({
    canUser: vi.fn(),
    hasPermission: vi.fn(),
  }),
  agentService: () => ({
    getById: vi.fn(),
  }),
  companyService: () => ({
    getEffectiveCeoAgentId: vi.fn(),
  }),
  documentService: () => ({
    getIssueDocumentPayload: vi.fn(async () => ({})),
  }),
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
  issueApprovalService: () => mockIssueApprovalService,
  issueRoutingService: () => ({
    route: vi.fn(),
    ministerIntake: vi.fn(),
  }),
  issueService: () => mockIssueService,
  logActivity: vi.fn(async () => undefined),
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

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("issue shortname resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.getByIdentifier.mockResolvedValue(null);
    mockIssueService.getById.mockResolvedValue(null);
    mockIssueService.getAncestors.mockResolvedValue([]);
    mockIssueService.findMentionedProjectIds.mockResolvedValue([]);
    mockIssueService.listComments.mockResolvedValue([]);
    mockIssueService.listAttachments.mockResolvedValue([]);
    mockIssueApprovalService.listApprovalsForIssue.mockResolvedValue([]);
  });

  it.each([
    ["/api/issues/AIC-2"],
    ["/api/issues/AIC-2/comments"],
    ["/api/issues/AIC-2/attachments"],
    ["/api/issues/AIC-2/approvals"],
  ])("returns 404 instead of 500 when a deleted issue shortname is requested: %s", async (path) => {
    const res = await request(createApp()).get(path);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Issue not found" });
    expect(mockIssueService.getByIdentifier).toHaveBeenCalledWith("AIC-2");
    expect(mockIssueService.getById).toHaveBeenCalledWith(missingIssueId);
    expect(mockIssueService.getById).not.toHaveBeenCalledWith("AIC-2");
  });

  it("keeps UUID issue ids untouched", async () => {
    mockIssueService.getById.mockResolvedValue({
      id: existingIssueId,
      companyId,
      identifier: "AIC-9",
      title: "Existing issue",
      description: null,
      status: "todo",
      priority: "medium",
      projectId: null,
      goalId: null,
      executionWorkspaceId: null,
    });

    const res = await request(createApp()).get(`/api/issues/${existingIssueId}`);

    expect(res.status).toBe(200);
    expect(mockIssueService.getByIdentifier).not.toHaveBeenCalled();
    expect(mockIssueService.getById).toHaveBeenCalledWith(existingIssueId);
  });
});
