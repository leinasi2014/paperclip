import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, departmentBudgetEnvelopes, departments } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { departmentService } from "../services/departments.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres department service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
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

describeEmbeddedPostgres("departmentService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof departmentService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-department-service-");
    db = createDb(tempDb.connectionString);
    svc = departmentService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(departmentBudgetEnvelopes);
    await db.delete(departments);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("rejects creating a department with a minister from another company", async () => {
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const ministerId = randomUUID();
    await db.insert(companies).values([
      { id: companyId, name: "A", issuePrefix: "AAA", requireBoardApprovalForNewAgents: false },
      { id: otherCompanyId, name: "B", issuePrefix: "BBB", requireBoardApprovalForNewAgents: false },
    ]);
    await db.insert(agents).values(makeAgent({
      id: ministerId,
      companyId: otherCompanyId,
      name: "Elsewhere",
      role: "engineer",
    }));

    await expect(svc.create(companyId, {
      name: "Engineering",
      slug: "engineering",
      ministerAgentId: ministerId,
    })).rejects.toMatchObject({
      status: 422,
      message: "Department minister must belong to the same company",
    });
  });

  it("rejects creating a department with the CEO as minister", async () => {
    const companyId = randomUUID();
    const ceoId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "A",
      issuePrefix: "AAA",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(makeAgent({
      id: ceoId,
      companyId,
      name: "CEO",
      role: "ceo",
    }));

    await expect(svc.create(companyId, {
      name: "Engineering",
      slug: "engineering",
      ministerAgentId: ceoId,
    })).rejects.toMatchObject({
      status: 422,
      message: "CEO cannot be assigned as a department minister",
    });
  });

  it("maps duplicate department slug to conflict", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "A",
      issuePrefix: "AAA",
      requireBoardApprovalForNewAgents: false,
    });

    await svc.create(companyId, { name: "Engineering", slug: "engineering" });
    await expect(svc.create(companyId, { name: "Platform", slug: "engineering" })).rejects.toMatchObject({
      status: 409,
      message: "Department slug already exists in this company",
    });
  });

  it("rejects assigning a minister who already occupies another seat", async () => {
    const companyId = randomUUID();
    const ministerId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "A",
      issuePrefix: "AAA",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(makeAgent({
      id: ministerId,
      companyId,
      name: "Minister",
      role: "engineer",
    }));
    const first = await svc.create(companyId, {
      name: "Engineering",
      slug: "engineering",
      ministerAgentId: ministerId,
    });
    const second = await svc.create(companyId, {
      name: "Design",
      slug: "design",
    });

    expect(first.ministerAgentId).toBe(ministerId);
    await expect(svc.assignMinister(second.id, ministerId)).rejects.toMatchObject({
      status: 409,
      message: "Agent is already assigned as a department minister",
    });
  });

  it("removing a minister freezes the department as unstaffed and reserves its budget", async () => {
    const companyId = randomUUID();
    const ministerId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "A",
      issuePrefix: "AAA",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(makeAgent({
      id: ministerId,
      companyId,
      name: "Minister",
      role: "engineer",
    }));
    const created = await svc.create(companyId, {
      name: "Engineering",
      slug: "engineering",
      ministerAgentId: ministerId,
    });

    const removed = await svc.removeMinister(created.id);
    const envelope = await db.select().from(departmentBudgetEnvelopes)
      .where(eq(departmentBudgetEnvelopes.departmentId, created.id))
      .then((rows) => rows[0] ?? null);

    expect(removed).toMatchObject({
      ministerAgentId: null,
      status: "frozen_unstaffed",
    });
    expect(envelope?.status).toBe("reserved_only");
  });

  it("rejects freezing a staffed department as unstaffed", async () => {
    const companyId = randomUUID();
    const ministerId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "A",
      issuePrefix: "AAA",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(makeAgent({
      id: ministerId,
      companyId,
      name: "Minister",
      role: "engineer",
    }));
    const created = await svc.create(companyId, {
      name: "Engineering",
      slug: "engineering",
      ministerAgentId: ministerId,
    });

    await expect(svc.freeze(created.id, "frozen_unstaffed")).rejects.toMatchObject({
      status: 422,
      message: "Remove the minister before freezing a department as unstaffed",
    });
  });

  it("rejects unfreezing a department without a minister", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "A",
      issuePrefix: "AAA",
      requireBoardApprovalForNewAgents: false,
    });
    const created = await svc.create(companyId, {
      name: "Engineering",
      slug: "engineering",
    });

    await expect(svc.unfreeze(created.id)).rejects.toMatchObject({
      status: 422,
      message: "Cannot unfreeze a department without a minister",
    });
  });

  it("activates the budget envelope when assigning a minister to an unstaffed department", async () => {
    const companyId = randomUUID();
    const ministerId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "A",
      issuePrefix: "AAA",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values(makeAgent({
      id: ministerId,
      companyId,
      name: "Minister",
      role: "engineer",
    }));
    const created = await svc.create(companyId, {
      name: "Engineering",
      slug: "engineering",
    });

    const updated = await svc.assignMinister(created.id, ministerId);
    const envelope = await db.select().from(departmentBudgetEnvelopes)
      .where(eq(departmentBudgetEnvelopes.departmentId, created.id))
      .then((rows) => rows[0] ?? null);

    expect(updated?.status).toBe("active");
    expect(updated?.ministerAgentId).toBe(ministerId);
    expect(envelope?.status).toBe("active");
  });
});
