import { beforeEach, describe, expect, it, vi } from "vitest";
import { requiredSystemPluginService } from "../services/required-system-plugins.js";

const mockRegistry = vi.hoisted(() => ({
  getById: vi.fn(),
  getByKey: vi.fn(),
  list: vi.fn(),
  listInstalled: vi.fn(),
}));

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => mockRegistry,
}));

describe("requiredSystemPluginService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.getById.mockResolvedValue(null);
    mockRegistry.getByKey.mockResolvedValue(null);
    mockRegistry.list.mockResolvedValue([]);
    mockRegistry.listInstalled.mockResolvedValue([]);
  });

  it("returns synthetic missing rows for required plugins when nothing is installed", async () => {
    const service = requiredSystemPluginService({} as never);

    await expect(service.listStatus()).resolves.toEqual([
      expect.objectContaining({
        pluginKey: "paperclip.execution-improvement",
        installed: false,
        runtimeStatus: "missing",
        required: true,
      }),
      expect.objectContaining({
        pluginKey: "paperclip.skills-system",
        installed: false,
        runtimeStatus: "missing",
        required: true,
      }),
    ]);
  });

  it("marks installed but non-ready plugins as installed instead of hiding them", async () => {
    mockRegistry.list.mockResolvedValue([
      {
        id: "plugin-1",
        pluginKey: "paperclip.execution-improvement",
        packageName: "@paperclipai/plugin-execution-improvement",
        version: "1.0.0",
        status: "installed",
        manifestJson: {},
        lastError: null,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      },
    ]);

    const service = requiredSystemPluginService({} as never);
    const rows = await service.listStatus();

    expect(rows.find((row) => row.pluginKey === "paperclip.execution-improvement")).toMatchObject({
      pluginId: "plugin-1",
      installed: true,
      runtimeStatus: "installed",
    });
    expect(rows.find((row) => row.pluginKey === "paperclip.skills-system")).toMatchObject({
      installed: false,
      runtimeStatus: "missing",
    });
  });
});
