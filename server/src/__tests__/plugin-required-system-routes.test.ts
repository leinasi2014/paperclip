import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pluginRoutes } from "../routes/plugins.js";
import { errorHandler } from "../middleware/index.js";

const pluginRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  pluginKey: "paperclip.execution-improvement",
  packageName: "@paperclipai/plugin-execution-improvement",
  version: "1.0.0",
  status: "ready",
  manifestJson: {
    id: "paperclip.execution-improvement",
    displayName: "Execution Improvement",
    version: "1.0.0",
  },
  lastError: null,
  createdAt: new Date("2026-04-02T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
};

const mockRegistry = vi.hoisted(() => ({
  getById: vi.fn(),
  getByKey: vi.fn(),
  listInstalled: vi.fn(),
  listByStatus: vi.fn(),
}));

const mockLifecycle = vi.hoisted(() => ({
  unload: vi.fn(),
  disable: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());
const mockPublishGlobalLiveEvent = vi.hoisted(() => vi.fn());

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => mockRegistry,
}));

vi.mock("../services/plugin-lifecycle.js", () => ({
  pluginLifecycleManager: () => mockLifecycle,
}));

vi.mock("../services/plugin-loader.js", () => ({
  pluginLoader: () => ({}),
  getPluginUiContributionMetadata: vi.fn(),
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: mockLogActivity,
}));

vi.mock("../services/live-events.js", () => ({
  publishGlobalLiveEvent: mockPublishGlobalLiveEvent,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [],
    };
    next();
  });
  app.use("/api", pluginRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("required system plugin route protections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.getById.mockResolvedValue(pluginRecord);
    mockRegistry.getByKey.mockResolvedValue(pluginRecord);
  });

  it("rejects uninstalling a required system plugin", async () => {
    const app = createApp();
    const res = await request(app).delete(`/api/plugins/${pluginRecord.id}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Required system plugins cannot be uninstalled");
    expect(mockLifecycle.unload).not.toHaveBeenCalled();
  });

  it("rejects disabling a required system plugin", async () => {
    const app = createApp();
    const res = await request(app).post(`/api/plugins/${pluginRecord.id}/disable`).send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Required system plugins cannot be disabled");
    expect(mockLifecycle.disable).not.toHaveBeenCalled();
  });
});
