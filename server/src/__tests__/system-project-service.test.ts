import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, projects } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { systemProjectService } from "../services/system-project.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres system project service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("systemProjectService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof systemProjectService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-system-project-service-");
    db = createDb(tempDb.connectionString);
    svc = systemProjectService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(projects);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("creates exactly one canonical system project per company", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });

    const first = await svc.ensureCanonical(companyId);
    const second = await svc.ensureCanonical(companyId);

    expect(first.id).toBe(second.id);
    expect(first.isSystemProject).toBe(true);
    expect(first.systemProjectKind).toBe("execution_governance");

    const rows = await db.select().from(projects).where(eq(projects.companyId, companyId));
    expect(rows).toHaveLength(1);
  });

  it("reconciles by creating a canonical system project when missing", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });

    const project = await svc.reconcile(companyId);

    expect(project.isSystemProject).toBe(true);
    expect(project.systemProjectKind).toBe("execution_governance");
    expect(await svc.getCanonical(companyId)).toMatchObject({
      id: project.id,
      systemProjectKind: "execution_governance",
    });
  });

  it("reconcile preserves the canonical system project when one already exists", async () => {
    const companyId = randomUUID();
    const firstId = randomUUID();
    const secondId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(projects).values([
      {
        id: firstId,
        companyId,
        name: "System Governance",
        status: "planned",
        isSystemProject: true,
        systemProjectKind: "execution_governance",
      },
      {
        id: secondId,
        companyId,
        name: "Regular Project",
        status: "planned",
        isSystemProject: false,
        systemProjectKind: null,
      },
    ]);

    const canonical = await svc.reconcile(companyId);
    const rows = await db.select().from(projects).where(eq(projects.companyId, companyId));
    const regular = rows.find((row) => row.id === secondId);

    expect(canonical.id).toBe(firstId);
    expect(await svc.getCanonical(companyId)).toMatchObject({ id: firstId });
    expect(regular?.isSystemProject).toBe(false);
    expect(regular?.systemProjectKind).toBeNull();
  });

  it("protects the canonical system project from deletion or archive flows", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });

    const systemProject = await svc.ensureCanonical(companyId);
    const normalProjectId = randomUUID();
    await db.insert(projects).values({
      id: normalProjectId,
      companyId,
      name: "Regular Project",
      status: "backlog",
      isSystemProject: false,
      systemProjectKind: null,
    });

    await expect(svc.assertNotSystemProject(systemProject.id)).rejects.toMatchObject({
      status: 409,
      message: "Cannot delete or archive the system governance project",
    });
    await expect(svc.assertNotSystemProject(normalProjectId)).resolves.toBeUndefined();
  });

  it("returns 404 when asserting protection for a missing project", async () => {
    await expect(svc.assertNotSystemProject(randomUUID())).rejects.toMatchObject({
      status: 404,
      message: "Project not found",
    });
  });
});
