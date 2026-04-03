import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  companies,
  companySkillCandidates,
  companySkillPromotionRequests,
  createDb,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companySkillGovernanceService } from "../services/company-skill-governance.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

describeEmbeddedPostgres("companySkillGovernanceService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof companySkillGovernanceService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-company-skill-governance-");
    db = createDb(tempDb.connectionString);
    svc = companySkillGovernanceService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterEach(async () => {
    await db.delete(companySkillPromotionRequests);
    await db.delete(companySkillCandidates);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("reuses the existing pending promotion request for the same candidate", async () => {
    const companyId = randomUUID();
    const candidateId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PCP",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companySkillCandidates).values({
      id: candidateId,
      companyId,
      sourcePluginKey: "paperclip.skills-system",
      skillKey: "skill.execution-improvement",
      slug: "execution-improvement",
      name: "Execution Improvement",
      markdown: "# candidate",
    });

    const first = await svc.createPromotionRequest(companyId, "paperclip.skills-system", {
      candidateId,
      note: "first",
    });
    const second = await svc.createPromotionRequest(companyId, "paperclip.skills-system", {
      candidateId,
      note: "first",
    });

    expect(second.id).toBe(first.id);
    const rows = await db.select().from(companySkillPromotionRequests);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("pending");
  });
});
