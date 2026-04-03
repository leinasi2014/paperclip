import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, departments, issues, projects } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { systemIssueService } from "../services/system-issues.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres system issue service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
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

describeEmbeddedPostgres("systemIssueService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof systemIssueService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-system-issue-service-");
    db = createDb(tempDb.connectionString);
    svc = systemIssueService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(issues);
    await db.delete(departments);
    await db.delete(agents);
    await db.delete(projects);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("creates system issues in the canonical system project and derives CEO intake", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });

    const issue = await svc.create(companyId, {
      title: "Execution chain blocked",
      systemIssueType: "execution",
      systemIssueSeverity: "critical",
    });

    expect(issue.projectId).toBeTruthy();
    expect(issue.systemIssueWorkflowState).toBe("open");
    expect(issue.isInCeoIntake).toBe(true);
    const project = await db.select().from(projects).where(eq(projects.id, issue.projectId!))
      .then((rows) => rows[0] ?? null);
    expect(project?.isSystemProject).toBe(true);
    expect(project?.systemProjectKind).toBe("execution_governance");
  });

  it("routes and unroutes system issues by owning department", async () => {
    const companyId = randomUUID();
    const departmentId = randomUUID();
    const ministerId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(
      makeAgent({ id: ministerId, companyId, name: "Exec Minister", role: "engineer" }),
    );
    await db.insert(departments).values({
      id: departmentId,
      companyId,
      name: "Execution",
      slug: "execution",
      status: "active",
      ministerAgentId: ministerId,
      maxConcurrentTemporaryWorkers: 0,
    });

    const created = await svc.create(companyId, {
      title: "Execution chain blocked",
      systemIssueType: "execution",
      systemIssueSeverity: "critical",
    });
    const routed = await svc.route(created.id, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });
    const unrouted = await svc.route(created.id, null, {
      actorType: "user",
      actorId: "board-user",
    });

    expect(routed.owningDepartmentId).toBe(departmentId);
    expect(routed.departmentIntakeStatus).toBe("routed");
    expect(routed.isInCeoIntake).toBe(false);
    expect(unrouted.owningDepartmentId).toBeNull();
    expect(unrouted.departmentIntakeStatus).toBe("ceo_intake");
    expect(unrouted.isInCeoIntake).toBe(true);
  });

  it("rejects routing a system issue to a department from another company", async () => {
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const foreignDepartmentId = randomUUID();
    const foreignMinisterId = randomUUID();
    await db.insert(companies).values([
      {
        id: companyId,
        name: "Paperclip",
        issuePrefix: "PAP",
        requireBoardApprovalForNewAgents: false,
      },
      {
        id: otherCompanyId,
        name: "Elsewhere",
        issuePrefix: "ELS",
        requireBoardApprovalForNewAgents: false,
      },
    ]);
    await db.insert(agents).values(
      makeAgent({ id: foreignMinisterId, companyId: otherCompanyId, name: "Foreign Minister", role: "engineer" }),
    );
    await db.insert(departments).values({
      id: foreignDepartmentId,
      companyId: otherCompanyId,
      name: "Foreign",
      slug: "foreign",
      status: "active",
      ministerAgentId: foreignMinisterId,
      maxConcurrentTemporaryWorkers: 0,
    });

    const issue = await svc.create(companyId, {
      title: "Need skills review",
      systemIssueType: "skill",
      systemIssueSeverity: "high",
    });

    await expect(
      svc.route(issue.id, foreignDepartmentId, {
        actorType: "user",
        actorId: "board-user",
      }),
    ).rejects.toMatchObject({
      status: 422,
      message: "System issue department must belong to the same company",
    });
  });

  it("rejects updating a non-system issue through the system issue service", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Regular Project",
      status: "planned",
      isSystemProject: false,
      systemProjectKind: null,
    });
    const issueId = randomUUID();
    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      title: "Normal issue",
      status: "backlog",
      priority: "medium",
      originKind: "manual",
      requestDepth: 0,
    });

    await expect(svc.update(issueId, { title: "Nope" })).rejects.toMatchObject({
      status: 422,
      message: "Issue is not a system issue",
    });
  });

  it("filters system issues by CEO intake state", async () => {
    const companyId = randomUUID();
    const departmentId = randomUUID();
    const ministerId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(
      makeAgent({ id: ministerId, companyId, name: "Gov Minister", role: "engineer" }),
    );
    await db.insert(departments).values({
      id: departmentId,
      companyId,
      name: "Governance",
      slug: "governance",
      status: "active",
      ministerAgentId: ministerId,
      maxConcurrentTemporaryWorkers: 0,
    });

    const intake = await svc.create(companyId, {
      title: "Blocked in CEO intake",
      systemIssueType: "governance",
      systemIssueSeverity: "high",
    });
    const createdForDepartment = await svc.create(companyId, {
      title: "Owned by department",
      systemIssueType: "execution",
      systemIssueSeverity: "medium",
    });
    const routed = await svc.route(createdForDepartment.id, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });

    expect((await svc.list(companyId, { inCeoIntake: true })).map((issue) => issue.id)).toContain(intake.id);
    expect((await svc.list(companyId, { inCeoIntake: true })).map((issue) => issue.id)).not.toContain(routed.id);
    expect((await svc.list(companyId, { inCeoIntake: false })).map((issue) => issue.id)).toContain(routed.id);
  });

  it("advances a system issue through triage, review, resume, and close", async () => {
    const companyId = randomUUID();
    const ownerDepartmentId = randomUUID();
    const reviewDepartmentId = randomUUID();
    const ownerMinisterId = randomUUID();
    const reviewerMinisterId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values([
      makeAgent({ id: ownerMinisterId, companyId, name: "Execution Minister", role: "engineer" }),
      makeAgent({ id: reviewerMinisterId, companyId, name: "Governance Minister", role: "designer" }),
    ]);
    await db.insert(departments).values([
      {
        id: ownerDepartmentId,
        companyId,
        name: "Execution",
        slug: "execution",
        status: "active",
        ministerAgentId: ownerMinisterId,
        maxConcurrentTemporaryWorkers: 0,
      },
      {
        id: reviewDepartmentId,
        companyId,
        name: "Governance",
        slug: "governance",
        status: "active",
        ministerAgentId: reviewerMinisterId,
        maxConcurrentTemporaryWorkers: 0,
      },
    ]);

    const created = await svc.create(companyId, {
      title: "Execution chain blocked",
      systemIssueType: "execution",
      systemIssueSeverity: "critical",
      blockRecommended: true,
    });
    const triaged = await svc.startTriage(created.id);
    const routed = await svc.route(created.id, ownerDepartmentId, {
      actorType: "user",
      actorId: "board-user",
    });
    const pendingReview = await svc.requestReview(created.id, {
      actorType: "agent",
      actorId: ownerMinisterId,
      agentId: ownerMinisterId,
    });
    const readyToResume = await svc.review(
      created.id,
      {
        actorType: "agent",
        actorId: reviewerMinisterId,
        agentId: reviewerMinisterId,
      },
      true,
    );
    const resumed = await svc.approveResume(created.id);
    const postResumePendingReview = await svc.requestReview(created.id, {
      actorType: "agent",
      actorId: ownerMinisterId,
      agentId: ownerMinisterId,
    });
    const postResumeReviewPassed = await svc.review(
      created.id,
      {
        actorType: "agent",
        actorId: reviewerMinisterId,
        agentId: reviewerMinisterId,
      },
      true,
    );
    const closed = await svc.close(created.id);

    expect(triaged.systemIssueWorkflowState).toBe("triaging");
    expect(routed.owningDepartmentId).toBe(ownerDepartmentId);
    expect(pendingReview.systemIssueWorkflowState).toBe("pending_review");
    expect(readyToResume.systemIssueWorkflowState).toBe("ready_to_resume");
    expect(resumed.systemIssueWorkflowState).toBe("in_progress");
    expect(resumed.blockRecommended).toBe(false);
    expect(postResumePendingReview.systemIssueWorkflowState).toBe("pending_review");
    expect(postResumeReviewPassed.systemIssueWorkflowState).toBe("review_passed");
    expect(closed.systemIssueWorkflowState).toBe("done");
    expect(closed.status).toBe("done");
  });

  it("rejects review by the same responsible department", async () => {
    const companyId = randomUUID();
    const departmentId = randomUUID();
    const ministerId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(
      makeAgent({ id: ministerId, companyId, name: "Execution Minister", role: "engineer" }),
    );
    await db.insert(departments).values({
      id: departmentId,
      companyId,
      name: "Execution",
      slug: "execution",
      status: "active",
      ministerAgentId: ministerId,
      maxConcurrentTemporaryWorkers: 0,
    });

    const created = await svc.create(companyId, {
      title: "Execution chain blocked",
      systemIssueType: "execution",
      systemIssueSeverity: "critical",
    });
    await svc.startTriage(created.id);
    await svc.route(created.id, departmentId, {
      actorType: "user",
      actorId: "board-user",
    });
    await svc.requestReview(created.id, {
      actorType: "agent",
      actorId: ministerId,
      agentId: ministerId,
    });

    await expect(
      svc.review(
        created.id,
        {
          actorType: "agent",
          actorId: ministerId,
          agentId: ministerId,
        },
        true,
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: "The responsible department cannot review its own system issue",
    });
  });

  it("only lets the current owning minister request review and disallows direct close from in-progress", async () => {
    const companyId = randomUUID();
    const ownerDepartmentId = randomUUID();
    const ownerMinisterId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(
      makeAgent({ id: ownerMinisterId, companyId, name: "Execution Minister", role: "engineer" }),
    );
    await db.insert(departments).values({
      id: ownerDepartmentId,
      companyId,
      name: "Execution",
      slug: "execution",
      status: "active",
      ministerAgentId: ownerMinisterId,
      maxConcurrentTemporaryWorkers: 0,
    });

    const created = await svc.create(companyId, {
      title: "Execution chain blocked",
      systemIssueType: "execution",
      systemIssueSeverity: "critical",
    });
    await svc.startTriage(created.id);
    await svc.route(created.id, ownerDepartmentId, {
      actorType: "user",
      actorId: "board-user",
    });

    await expect(
      svc.requestReview(created.id, {
        actorType: "user",
        actorId: "board-user",
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Only the current owning department minister may request review",
    });

    await expect(svc.close(created.id)).rejects.toMatchObject({
      status: 409,
      message: "System issue is not in a closable state",
    });
  });
});
