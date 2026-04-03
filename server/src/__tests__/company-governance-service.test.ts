import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companyService } from "../services/companies.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company governance service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("companyService governance helpers", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof companyService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-company-governance-service-");
    db = createDb(tempDb.connectionString);
    svc = companyService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("assigns and resolves the explicit CEO seat", async () => {
    const companyId = randomUUID();
    const ceoAgentId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: ceoAgentId,
      companyId,
      name: "CEO",
      role: "ceo",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    const updated = await svc.assignCeoAgent(companyId, ceoAgentId);

    expect(updated?.ceoAgentId).toBe(ceoAgentId);
    await expect(svc.getEffectiveCeoAgentId(companyId)).resolves.toBe(ceoAgentId);
  });

  it("falls back to the unique CEO-by-role when ceoAgentId is unset", async () => {
    const companyId = randomUUID();
    const ceoAgentId = randomUUID();
    const engineerAgentId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values([
      {
        id: ceoAgentId,
        companyId,
        name: "CEO",
        role: "ceo",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: engineerAgentId,
        companyId,
        name: "Builder",
        role: "engineer",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await expect(svc.getEffectiveCeoAgentId(companyId)).resolves.toBe(ceoAgentId);
  });

  it("returns null when multiple CEO-role agents exist but no explicit seat is set", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values([
      {
        id: randomUUID(),
        companyId,
        name: "CEO One",
        role: "ceo",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: randomUUID(),
        companyId,
        name: "CEO Two",
        role: "ceo",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await expect(svc.getEffectiveCeoAgentId(companyId)).resolves.toBeNull();
  });

  it("rejects assigning a different second CEO after the seat is occupied", async () => {
    const companyId = randomUUID();
    const firstCeoId = randomUUID();
    const secondCeoId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values([
      {
        id: firstCeoId,
        companyId,
        name: "CEO One",
        role: "ceo",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: secondCeoId,
        companyId,
        name: "CEO Two",
        role: "ceo",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await svc.assignCeoAgent(companyId, firstCeoId);
    await expect(svc.assignCeoAgent(companyId, secondCeoId)).rejects.toMatchObject({
      status: 409,
      message: "Company already has a CEO",
    });
  });

  it("rejects assigning a CEO from another company", async () => {
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const ceoAgentId = randomUUID();
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
    await db.insert(agents).values({
      id: ceoAgentId,
      companyId: otherCompanyId,
      name: "External CEO",
      role: "ceo",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await expect(svc.assignCeoAgent(companyId, ceoAgentId)).rejects.toMatchObject({
      status: 422,
      message: "CEO agent must belong to the same company",
    });
  });

  it("rejects assigning a non-CEO agent into the CEO seat", async () => {
    const companyId = randomUUID();
    const engineerId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: engineerId,
      companyId,
      name: "Engineer",
      role: "engineer",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await expect(svc.assignCeoAgent(companyId, engineerId)).rejects.toMatchObject({
      status: 422,
      message: "Only agents with role CEO can become company CEO",
    });
  });

  it("treats assigning the same explicit CEO seat as idempotent", async () => {
    const companyId = randomUUID();
    const ceoAgentId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: ceoAgentId,
      companyId,
      name: "CEO",
      role: "ceo",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    const first = await svc.assignCeoAgent(companyId, ceoAgentId);
    const second = await svc.assignCeoAgent(companyId, ceoAgentId);

    expect(first?.ceoAgentId).toBe(ceoAgentId);
    expect(second?.ceoAgentId).toBe(ceoAgentId);
  });

  it("falls back to the unique CEO-by-role when the explicit CEO seat is stale", async () => {
    const companyId = randomUUID();
    const staleSeatId = randomUUID();
    const actualCeoId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
      ceoAgentId: staleSeatId,
    });
    await db.insert(agents).values({
      id: actualCeoId,
      companyId,
      name: "Actual CEO",
      role: "ceo",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await expect(svc.getEffectiveCeoAgentId(companyId)).resolves.toBe(actualCeoId);
  });
});
