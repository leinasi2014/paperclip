import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { systemPluginRolloutRoutes } from "../routes/system-plugin-rollouts.js";

const rolloutId = "11111111-1111-4111-8111-111111111111";
const pluginId = "22222222-2222-4222-8222-222222222222";

const mockSystemPluginRolloutService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  recordApproval: vi.fn(),
  executeRestartPath: vi.fn(),
  buildRollbackCommand: vi.fn(),
}));

vi.mock("../services/system-plugin-rollouts.js", () => ({
  systemPluginRolloutService: () => mockSystemPluginRolloutService,
}));

function makeRollout(overrides: Record<string, unknown> = {}) {
  return {
    id: rolloutId,
    pluginId,
    pluginKey: "paperclip.execution-improvement",
    pluginPackageName: "@paperclipai/execution-improvement",
    pluginStatus: "ready",
    rolloutKind: "restart_path",
    status: "approved",
    baseVersion: "1.0.0",
    candidateVersion: "1.1.0",
    candidateMetadata: { releaseRef: "sha-123" },
    note: null,
    lastError: null,
    requestedByUserId: "instance-admin",
    approvedAt: new Date("2026-04-02T00:00:00.000Z"),
    rejectedAt: null,
    executedAt: null,
    completedAt: null,
    restartCommand: null,
    rollbackCommand: null,
    approvals: [],
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
  app.use("/api", systemPluginRolloutRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("system plugin rollout routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSystemPluginRolloutService.list.mockResolvedValue([makeRollout()]);
    mockSystemPluginRolloutService.getById.mockResolvedValue(makeRollout());
    mockSystemPluginRolloutService.create.mockResolvedValue(makeRollout({ status: "pending_approval" }));
    mockSystemPluginRolloutService.recordApproval.mockResolvedValue(makeRollout({ approvals: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        rolloutId,
        decision: "approved",
        actorUserId: "instance-admin",
        note: "looks good",
        createdAt: new Date("2026-04-02T00:01:00.000Z"),
      },
    ] }));
    mockSystemPluginRolloutService.executeRestartPath.mockResolvedValue(
      makeRollout({
        status: "succeeded",
        restartCommand: {
          kind: "restart_worker",
          strategy: "restart_path_mvp",
          rolloutId,
          pluginId,
          pluginKey: "paperclip.execution-improvement",
          baseVersion: "1.0.0",
          candidateVersion: "1.1.0",
          instructions: "Restart the worker.",
          metadata: {},
        },
      }),
    );
    mockSystemPluginRolloutService.buildRollbackCommand.mockResolvedValue(
      makeRollout({
        rollbackCommand: {
          kind: "restore_then_restart_worker",
          strategy: "restart_path_mvp",
          rolloutId,
          pluginId,
          pluginKey: "paperclip.execution-improvement",
          baseVersion: "1.0.0",
          candidateVersion: "1.1.0",
          instructions: "Restore and restart.",
          metadata: {},
        },
      }),
    );
  });

  it("allows instance admins to create rollout records", async () => {
    const app = createApp({
      type: "board",
      userId: "instance-admin",
      companyIds: [],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post("/api/system-plugin-rollouts")
      .send({
        pluginKey: "paperclip.execution-improvement",
        candidateVersion: "1.1.0",
        candidateMetadata: { releaseRef: "sha-123" },
      });

    expect(res.status).toBe(201);
    expect(mockSystemPluginRolloutService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginKey: "paperclip.execution-improvement",
        candidateVersion: "1.1.0",
      }),
      "instance-admin",
    );
  });

  it("rejects non-instance-admin board users", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [],
      source: "session",
      isInstanceAdmin: false,
    });

    const res = await request(app).get("/api/system-plugin-rollouts");

    expect(res.status).toBe(403);
    expect(mockSystemPluginRolloutService.list).not.toHaveBeenCalled();
  });

  it("records rollout approvals", async () => {
    const app = createApp({
      type: "board",
      userId: "instance-admin",
      companyIds: [],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-plugin-rollouts/${rolloutId}/approvals`)
      .send({ decision: "approved", note: "looks good" });

    expect(res.status).toBe(200);
    expect(mockSystemPluginRolloutService.recordApproval).toHaveBeenCalledWith(
      rolloutId,
      expect.objectContaining({
        decision: "approved",
      }),
      "instance-admin",
    );
  });

  it("executes the restart-path rollout and returns the restart command payload", async () => {
    const app = createApp({
      type: "board",
      userId: "instance-admin",
      companyIds: [],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-plugin-rollouts/${rolloutId}/restart-path`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockSystemPluginRolloutService.executeRestartPath).toHaveBeenCalledWith(rolloutId);
    expect(res.body.restartCommand.kind).toBe("restart_worker");
  });

  it("builds rollback commands for approved or executed rollouts", async () => {
    const app = createApp({
      type: "board",
      userId: "instance-admin",
      companyIds: [],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post(`/api/system-plugin-rollouts/${rolloutId}/rollback-command`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockSystemPluginRolloutService.buildRollbackCommand).toHaveBeenCalledWith(rolloutId);
    expect(res.body.rollbackCommand.kind).toBe("restore_then_restart_worker");
  });
});
