import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, departments, issues, temporaryWorkers } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { temporaryWorkerService } from "../services/temporary-workers.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres temporary worker service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

function makeAgent(input: {
  id: string;
  companyId: string;
  name: string;
  role: "ceo" | "engineer" | "designer";
}) {
  return {
    id: input.id,
    companyId: input.companyId,
    name: input.name,
    role: input.role,
    status: "active" as const,
    adapterType: "codex_local" as const,
    adapterConfig: {},
    runtimeConfig: {},
    permissions: {},
  };
}

describeEmbeddedPostgres("temporaryWorkerService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof temporaryWorkerService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-temp-worker-service-");
    db = createDb(tempDb.connectionString);
    svc = temporaryWorkerService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(temporaryWorkers);
    await db.delete(issues);
    await db.delete(departments);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedDepartmentIssue() {
    const companyId = randomUUID();
    const ministerId = randomUUID();
    const issueId = randomUUID();
    const departmentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(makeAgent({
      id: ministerId,
      companyId,
      name: "Minister",
      role: "engineer",
    }));
    await db.insert(departments).values({
      id: departmentId,
      companyId,
      name: "Engineering",
      slug: "engineering",
      status: "active",
      ministerAgentId: ministerId,
      maxConcurrentTemporaryWorkers: 1,
      temporaryWorkerTtlMinutes: 60,
    });
    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Accepted issue",
      status: "todo",
      priority: "medium",
      originKind: "manual",
      requestDepth: 0,
      owningDepartmentId: departmentId,
      departmentIntakeStatus: "accepted",
    });

    return { companyId, departmentId, ministerId, issueId };
  }

  it("spawns a temporary worker from an accepted department issue", async () => {
    const { departmentId, ministerId, issueId } = await seedDepartmentIssue();

    const worker = await svc.spawn(departmentId, ministerId, {
      sourceIssueId: issueId,
      name: "Execution Worker",
    });

    expect(worker).toMatchObject({
      departmentId,
      ownerMinisterAgentId: ministerId,
      sourceIssueId: issueId,
      status: "active",
      name: "Execution Worker",
    });
  });

  it("enforces the department concurrent temporary worker limit", async () => {
    const { departmentId, ministerId, issueId } = await seedDepartmentIssue();
    await svc.spawn(departmentId, ministerId, {
      sourceIssueId: issueId,
      name: "Worker 1",
    });

    await expect(svc.spawn(departmentId, ministerId, {
      sourceIssueId: issueId,
      name: "Worker 2",
    })).rejects.toMatchObject({
      status: 409,
      message: "Department has reached its concurrent temporary worker limit",
    });
  });

  it("moves workers into CEO-governed states across pause, resume, and TTL reconciliation", async () => {
    const { companyId, departmentId, ministerId, issueId } = await seedDepartmentIssue();
    const worker = await svc.spawn(departmentId, ministerId, {
      sourceIssueId: issueId,
      name: "Worker 1",
    });

    const paused = await svc.requestPause(worker!.id, ministerId, "Need CEO approval");
    expect(paused?.status).toBe("paused_pending_ceo_resume");

    const extended = await svc.extendTtl(worker!.id, 5);
    expect(extended?.ttlExpiresAt).toBeTruthy();

    const resumed = await svc.approveResume(worker!.id);
    expect(resumed?.status).toBe("active");

    await db
      .update(temporaryWorkers)
      .set({ ttlExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(temporaryWorkers.id, worker!.id));

    const reconciled = await svc.reconcileExpired(companyId);
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]?.status).toBe("ttl_expired_pending_minister");
  });

  it("refuses to resume a worker after its source issue has left the department", async () => {
    const { departmentId, ministerId, issueId, otherDepartmentId } = await (async () => {
      const seeded = await seedDepartmentIssue();
      const otherMinisterId = randomUUID();
      await db.insert(agents).values(makeAgent({
        id: otherMinisterId,
        companyId: seeded.companyId,
        name: "Other Minister",
        role: "designer",
      }));
      const newDepartmentId = randomUUID();
      await db.insert(departments).values({
        id: newDepartmentId,
        companyId: seeded.companyId,
        name: "Design",
        slug: "design",
        status: "active",
        ministerAgentId: otherMinisterId,
        maxConcurrentTemporaryWorkers: 1,
        temporaryWorkerTtlMinutes: 60,
      });
      return { ...seeded, otherDepartmentId: newDepartmentId };
    })();

    const worker = await svc.spawn(departmentId, ministerId, {
      sourceIssueId: issueId,
      name: "Worker 1",
    });
    await svc.requestPause(worker!.id, ministerId, "Need CEO approval");

    await db
      .update(issues)
      .set({
        owningDepartmentId: otherDepartmentId,
        departmentIntakeStatus: "routed",
      })
      .where(eq(issues.id, issueId));

    await expect(svc.approveResume(worker!.id)).rejects.toMatchObject({
      status: 422,
      message: "Temporary worker source issue must still belong to the department and be accepted",
    });
  });
});
