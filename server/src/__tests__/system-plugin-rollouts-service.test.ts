import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, pluginRolloutApprovals, pluginRollouts, plugins } from "@paperclipai/db";
import { systemPluginRolloutService } from "../services/system-plugin-rollouts.ts";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres system plugin rollout service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

function makePlugin(input: { id: string; pluginKey: string; version?: string }) {
  return {
    id: input.id,
    pluginKey: input.pluginKey,
    packageName: `@paperclipai/${input.pluginKey}`,
    version: input.version ?? "1.0.0",
    apiVersion: 1,
    categories: ["automation"] as const,
    manifestJson: {
      id: input.pluginKey,
      apiVersion: 1 as const,
      version: input.version ?? "1.0.0",
      displayName: input.pluginKey,
      description: "test plugin",
      author: "Paperclip",
      categories: ["automation"] as const,
      capabilities: [],
      entrypoints: {
        worker: "dist/worker.js",
      },
    },
    status: "ready" as const,
    installOrder: 1,
    packagePath: `plugins/${input.pluginKey}`,
    lastError: null,
  };
}

describeEmbeddedPostgres("systemPluginRolloutService", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-system-plugin-rollouts-");
    db = createDb(tempDb.connectionString);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(pluginRolloutApprovals);
    await db.delete(pluginRollouts);
    await db.delete(plugins);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("creates rollout records for required system plugins with candidate metadata", async () => {
    const pluginId = randomUUID();
    await db.insert(plugins).values(
      makePlugin({
        id: pluginId,
        pluginKey: "paperclip.execution-improvement",
        version: "1.0.0",
      }),
    );

    const svc = systemPluginRolloutService(db);
    const rollout = await svc.create(
      {
        pluginId,
        candidateVersion: "1.1.0",
        candidateMetadata: { sourceSystemIssueId: "SYS-1", reason: "fix blocker" },
        note: "restart-path MVP",
      },
      "board-user",
    );

    expect(rollout.pluginId).toBe(pluginId);
    expect(rollout.pluginKey).toBe("paperclip.execution-improvement");
    expect(rollout.status).toBe("pending_approval");
    expect(rollout.baseVersion).toBe("1.0.0");
    expect(rollout.candidateVersion).toBe("1.1.0");
    expect(rollout.candidateMetadata).toMatchObject({
      sourceSystemIssueId: "SYS-1",
      reason: "fix blocker",
    });
  });

  it("rejects rollout creation for non-required plugins", async () => {
    const pluginId = randomUUID();
    await db.insert(plugins).values(
      makePlugin({
        id: pluginId,
        pluginKey: "paperclip.hello-world-example",
      }),
    );

    const svc = systemPluginRolloutService(db);

    await expect(
      svc.create(
        {
          pluginId,
        },
        "board-user",
      ),
    ).rejects.toMatchObject({
      status: 422,
      message: "Rollouts are only supported for required system plugins",
    });
  });

  it("records approvals, executes restart-path rollout, and builds rollback commands", async () => {
    const pluginId = randomUUID();
    await db.insert(plugins).values(
      makePlugin({
        id: pluginId,
        pluginKey: "paperclip.skills-system",
        version: "2.0.0",
      }),
    );

    const lifecycle = {
      restartWorker: vi.fn().mockResolvedValue(undefined),
    };
    const svc = systemPluginRolloutService(db, { lifecycle });

    const created = await svc.create(
      {
        pluginKey: "paperclip.skills-system",
        candidateVersion: "2.1.0",
        candidateMetadata: { releaseRef: "sha-123" },
      },
      "instance-admin",
    );
    const approved = await svc.recordApproval(
      created.id,
      {
        decision: "approved",
        note: "safe to restart",
      },
      "instance-admin",
    );
    const executed = await svc.executeRestartPath(created.id);
    const rollback = await svc.buildRollbackCommand(created.id);

    expect(approved.status).toBe("approved");
    expect(approved.approvals).toHaveLength(1);
    expect(lifecycle.restartWorker).toHaveBeenCalledWith(pluginId);
    expect(executed.status).toBe("succeeded");
    expect(executed.restartCommand).toMatchObject({
      kind: "restart_worker",
      strategy: "restart_path_mvp",
      pluginId,
      pluginKey: "paperclip.skills-system",
      baseVersion: "2.0.0",
      candidateVersion: "2.1.0",
    });
    expect(rollback.rollbackCommand).toMatchObject({
      kind: "restore_then_restart_worker",
      strategy: "restart_path_mvp",
      pluginId,
      pluginKey: "paperclip.skills-system",
      baseVersion: "2.0.0",
      candidateVersion: "2.1.0",
    });
  });

  it("rejects creating a second active rollout for the same required plugin", async () => {
    const pluginId = randomUUID();
    await db.insert(plugins).values(
      makePlugin({
        id: pluginId,
        pluginKey: "paperclip.execution-improvement",
      }),
    );

    const svc = systemPluginRolloutService(db);
    await svc.create(
      {
        pluginId,
        candidateVersion: "1.1.0",
      },
      "board-user",
    );

    await expect(
      svc.create(
        {
          pluginId,
          candidateVersion: "1.2.0",
        },
        "board-user",
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: "An active rollout already exists for this required system plugin",
    });
  });
});
