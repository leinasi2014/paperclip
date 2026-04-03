import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict } from "../errors.js";
import { errorHandler } from "../middleware/index.js";
import { projectRoutes } from "../routes/projects.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const systemProjectId = "22222222-2222-4222-8222-222222222222";
const normalProjectId = "33333333-3333-4333-8333-333333333333";

const mockProjectService = vi.hoisted(() => ({
  resolveByReference: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  removeWorkspace: vi.fn(),
  getWorkspaceById: vi.fn(),
  getWorkspaceByReference: vi.fn(),
  setPrimaryWorkspace: vi.fn(),
  removeCascade: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  list: vi.fn(),
  listAttachments: vi.fn(),
}));

const mockSystemProjectService = vi.hoisted(() => ({
  assertNotSystemProject: vi.fn(),
}));

const mockWorkspaceOperationService = vi.hoisted(() => ({
  listByScope: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());
const mockDeleteObject = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  issueService: () => mockIssueService,
  projectService: () => mockProjectService,
  logActivity: mockLogActivity,
  systemProjectService: () => mockSystemProjectService,
  workspaceOperationService: () => mockWorkspaceOperationService,
}));

vi.mock("../storage/index.js", () => ({
  getStorageService: () => ({
    deleteObject: mockDeleteObject,
  }),
}));

function makeProject(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    companyId,
    name: id === systemProjectId ? "System Governance" : "Regular Project",
    description: null,
    status: "backlog",
    leadAgentId: null,
    targetDate: null,
    color: "#6366f1",
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    isSystemProject: id === systemProjectId,
    systemProjectKind: id === systemProjectId ? "execution_governance" : null,
    archivedAt: null,
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    urlKey: id === systemProjectId ? "system-governance" : "regular-project",
    goalIds: [],
    goals: [],
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "",
      effectiveLocalFolder: "",
      origin: "managed_checkout",
    },
    workspaces: [],
    primaryWorkspace: null,
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
  app.use("/api", projectRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("project system project protection routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectService.resolveByReference.mockImplementation(async (_companyId: string, raw: string) => ({
      ambiguous: false,
      project: raw === "system-governance" ? makeProject(systemProjectId) : makeProject(normalProjectId),
    }));
    mockProjectService.getById.mockImplementation(async (id: string) => (
      id === systemProjectId ? makeProject(systemProjectId) : makeProject(normalProjectId)
    ));
    mockProjectService.update.mockImplementation(async (id: string, patch: Record<string, unknown>) => (
      makeProject(id, patch)
    ));
    mockProjectService.removeCascade.mockResolvedValue({
      project: makeProject(normalProjectId),
      summary: {
        issueIds: [],
        deletedGoalIds: [],
        preservedGoalIds: [],
        projectWorkspaceIds: [],
        executionWorkspaceIds: [],
      },
    });
    mockIssueService.list.mockResolvedValue([]);
    mockIssueService.listAttachments.mockResolvedValue([]);
    mockSystemProjectService.assertNotSystemProject.mockResolvedValue(undefined);
    mockLogActivity.mockResolvedValue(undefined);
    mockDeleteObject.mockResolvedValue(undefined);
  });

  it("rejects deleting the canonical system project with 409", async () => {
    mockSystemProjectService.assertNotSystemProject.mockRejectedValueOnce(
      conflict("Cannot delete or archive the system governance project"),
    );
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app).delete(`/api/projects/${systemProjectId}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Cannot delete or archive the system governance project");
    expect(mockProjectService.removeCascade).not.toHaveBeenCalled();
  });

  it("rejects archiving the canonical system project for board users too", async () => {
    mockSystemProjectService.assertNotSystemProject.mockRejectedValueOnce(
      conflict("Cannot delete or archive the system governance project"),
    );
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .patch(`/api/projects/${systemProjectId}`)
      .send({ archivedAt: "2026-04-02T00:00:00.000Z" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Cannot delete or archive the system governance project");
    expect(mockProjectService.update).not.toHaveBeenCalled();
  });

  it("still allows normal project delete and archive flows", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const archiveRes = await request(app)
      .patch(`/api/projects/${normalProjectId}`)
      .send({ archivedAt: "2026-04-02T00:00:00.000Z" });
    expect(archiveRes.status).toBe(200);
    expect(mockProjectService.update).toHaveBeenCalled();

    const deleteRes = await request(app).delete(`/api/projects/${normalProjectId}`);
    expect(deleteRes.status).toBe(200);
    expect(mockProjectService.removeCascade).toHaveBeenCalledWith(normalProjectId);
  });
});
