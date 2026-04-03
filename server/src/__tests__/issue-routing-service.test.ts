import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, departments, issues, temporaryWorkers } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { issueRoutingService } from "../services/issue-routing.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres issue routing service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
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

describeEmbeddedPostgres("issueRoutingService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof issueRoutingService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-issue-routing-service-");
    db = createDb(tempDb.connectionString);
    svc = issueRoutingService(db);
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

  async function seedRoutableIssue() {
    const companyId = randomUUID();
    const ministerId = randomUUID();
    const otherMinisterId = randomUUID();
    const issueId = randomUUID();
    const departmentId = randomUUID();
    const otherDepartmentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values([
      makeAgent({ id: ministerId, companyId, name: "Minister", role: "engineer" }),
      makeAgent({ id: otherMinisterId, companyId, name: "Other", role: "designer" }),
    ]);
    await db.insert(departments).values([
      {
        id: departmentId,
        companyId,
        name: "Engineering",
        slug: "engineering",
        status: "active",
        ministerAgentId: ministerId,
        maxConcurrentTemporaryWorkers: 3,
      },
      {
        id: otherDepartmentId,
        companyId,
        name: "Design",
        slug: "design",
        status: "active",
        ministerAgentId: otherMinisterId,
        maxConcurrentTemporaryWorkers: 2,
      },
    ]);
    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Route me",
      status: "todo",
      priority: "medium",
      originKind: "manual",
      requestDepth: 0,
    });

    return { companyId, issueId, departmentId, otherDepartmentId, ministerId, otherMinisterId };
  }

  it("routes an issue into a department and records audit fields", async () => {
    const { issueId, departmentId } = await seedRoutableIssue();

    const routed = await svc.route(issueId, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });

    expect(routed.owningDepartmentId).toBe(departmentId);
    expect(routed.departmentIntakeStatus).toBe("routed");
    expect(routed.routedByUserId).toBe("board-user");
    expect(routed.routedAt).toBeTruthy();
    expect(routed.isInCeoIntake).toBe(false);
  });

  it("returns a routed issue to CEO intake when unrouted", async () => {
    const { issueId, departmentId } = await seedRoutableIssue();
    await svc.route(issueId, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });

    const unrouted = await svc.route(issueId, null, {
      actorType: "user",
      actorId: "board-user",
    });

    expect(unrouted.owningDepartmentId).toBeNull();
    expect(unrouted.departmentIntakeStatus).toBe("ceo_intake");
    expect(unrouted.isInCeoIntake).toBe(true);
  });

  it("records minister acceptance while keeping department ownership", async () => {
    const { issueId, departmentId, ministerId } = await seedRoutableIssue();
    await svc.route(issueId, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });

    const accepted = await svc.ministerIntake(issueId, ministerId, "accept", "We can take this");

    expect(accepted.owningDepartmentId).toBe(departmentId);
    expect(accepted.departmentIntakeStatus).toBe("accepted");
    expect(accepted.ministerDecisionResponse).toBe("accept");
    expect(accepted.ministerDecisionByAgentId).toBe(ministerId);
    expect(accepted.isInCeoIntake).toBe(false);
  });

  it("returns rejected issues to CEO intake while preserving the decision", async () => {
    const { issueId, departmentId, ministerId } = await seedRoutableIssue();
    await svc.route(issueId, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });

    const rejected = await svc.ministerIntake(issueId, ministerId, "reject", "Not our charter");

    expect(rejected.owningDepartmentId).toBeNull();
    expect(rejected.departmentIntakeStatus).toBe("rejected");
    expect(rejected.ministerDecisionResponse).toBe("reject");
    expect(rejected.ministerDecisionReason).toBe("Not our charter");
    expect(rejected.isInCeoIntake).toBe(true);
  });

  it("rejects intake decisions from non-current ministers", async () => {
    const { issueId, departmentId, otherMinisterId } = await seedRoutableIssue();
    await svc.route(issueId, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });

    await expect(svc.ministerIntake(issueId, otherMinisterId, "accept")).rejects.toMatchObject({
      status: 409,
      message: "Only the current department minister can submit an intake decision",
    });
  });

  it("queues existing temporary workers for CEO resume when an accepted issue is rerouted", async () => {
    const { companyId, issueId, departmentId, otherDepartmentId, ministerId } = await seedRoutableIssue();
    await svc.route(issueId, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });
    await svc.ministerIntake(issueId, ministerId, "accept", "Accepted");
    await db.insert(temporaryWorkers).values({
      id: randomUUID(),
      companyId,
      departmentId,
      ownerMinisterAgentId: ministerId,
      sourceIssueId: issueId,
      name: "Worker",
      status: "active",
      ttlExpiresAt: new Date(Date.now() + 60_000),
    });

    await svc.route(issueId, otherDepartmentId, {
      actorType: "user",
      actorId: "board-user",
    });

    const workers = await db.select().from(temporaryWorkers).where(eq(temporaryWorkers.sourceIssueId, issueId));
    expect(workers).toHaveLength(1);
    expect(workers[0]?.status).toBe("paused_pending_ceo_resume");
    expect(workers[0]?.statusReason).toBe("issue_rerouted");
  });
});
