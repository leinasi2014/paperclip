import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companySkillCandidates,
  companySkillPromotionRequests,
} from "@paperclipai/db";
import type {
  CompanySkillCandidate,
  CompanySkillListItem,
  CompanySkillPromotionRequest,
  CreateCompanySkillPromotionRequest,
  UpsertCompanySkillCandidate,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { companySkillService } from "./company-skills.js";

function isPendingPromotionRequestConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { code?: string; constraint?: string; constraint_name?: string };
  const constraint = err.constraint ?? err.constraint_name;
  return err.code === "23505" && constraint === "company_skill_promotion_requests_pending_candidate_uq";
}

function toCandidate(row: typeof companySkillCandidates.$inferSelect): CompanySkillCandidate {
  return {
    id: row.id,
    companyId: row.companyId,
    sourcePluginKey: row.sourcePluginKey,
    skillKey: row.skillKey,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    markdown: row.markdown,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPromotionRequest(
  row: typeof companySkillPromotionRequests.$inferSelect,
): CompanySkillPromotionRequest {
  return {
    id: row.id,
    companyId: row.companyId,
    candidateId: row.candidateId,
    sourcePluginKey: row.sourcePluginKey,
    status: row.status as CompanySkillPromotionRequest["status"],
    note: row.note ?? null,
    approvedByUserId: row.approvedByUserId ?? null,
    approvedAt: row.approvedAt ?? null,
    rejectedAt: row.rejectedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function companySkillGovernanceService(db: Db) {
  const approvedSkills = companySkillService(db);

  async function getCandidateOrThrow(companyId: string, candidateId: string) {
    const candidate = await db
      .select()
      .from(companySkillCandidates)
      .where(
        and(
          eq(companySkillCandidates.companyId, companyId),
          eq(companySkillCandidates.id, candidateId),
        ),
      )
      .then((rows) => rows[0] ?? null);
    if (!candidate) throw notFound("Company skill candidate not found");
    return candidate;
  }

  return {
    async listApproved(companyId: string): Promise<CompanySkillListItem[]> {
      return approvedSkills.list(companyId);
    },

    async listCandidates(companyId: string): Promise<CompanySkillCandidate[]> {
      const rows = await db
        .select()
        .from(companySkillCandidates)
        .where(eq(companySkillCandidates.companyId, companyId))
        .orderBy(desc(companySkillCandidates.updatedAt), desc(companySkillCandidates.createdAt));
      return rows.map(toCandidate);
    },

    async createOrUpdateCandidate(
      companyId: string,
      sourcePluginKey: string,
      input: UpsertCompanySkillCandidate,
    ): Promise<CompanySkillCandidate> {
      const now = new Date();
      const existing = await db
        .select()
        .from(companySkillCandidates)
        .where(
          and(
            eq(companySkillCandidates.companyId, companyId),
            eq(companySkillCandidates.skillKey, input.skillKey),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (existing) {
        const updated = await db
          .update(companySkillCandidates)
          .set({
            sourcePluginKey,
            slug: input.slug,
            name: input.name,
            description: input.description ?? null,
            markdown: input.markdown,
            metadata: input.metadata ?? null,
            updatedAt: now,
          })
          .where(eq(companySkillCandidates.id, existing.id))
          .returning()
          .then((rows) => rows[0]);
        return toCandidate(updated!);
      }

      const created = await db
        .insert(companySkillCandidates)
        .values({
          companyId,
          sourcePluginKey,
          skillKey: input.skillKey,
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          markdown: input.markdown,
          metadata: input.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .then((rows) => rows[0]);
      return toCandidate(created!);
    },

    async listPromotionRequests(companyId: string): Promise<CompanySkillPromotionRequest[]> {
      const rows = await db
        .select()
        .from(companySkillPromotionRequests)
        .where(eq(companySkillPromotionRequests.companyId, companyId))
        .orderBy(
          desc(companySkillPromotionRequests.updatedAt),
          desc(companySkillPromotionRequests.createdAt),
        );
      return rows.map(toPromotionRequest);
    },

    async createPromotionRequest(
      companyId: string,
      sourcePluginKey: string,
      input: CreateCompanySkillPromotionRequest,
    ): Promise<CompanySkillPromotionRequest> {
      const candidate = await getCandidateOrThrow(companyId, input.candidateId);
      if (candidate.sourcePluginKey !== sourcePluginKey) {
        throw unprocessable("Company skill candidate source plugin mismatch");
      }

      const existingPending = await db
        .select()
        .from(companySkillPromotionRequests)
        .where(
          and(
            eq(companySkillPromotionRequests.companyId, companyId),
            eq(companySkillPromotionRequests.candidateId, input.candidateId),
            eq(companySkillPromotionRequests.status, "pending"),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (existingPending) {
        if ((existingPending.note ?? null) !== (input.note ?? null)) {
          const updated = await db
            .update(companySkillPromotionRequests)
            .set({
              note: input.note ?? null,
              updatedAt: new Date(),
            })
            .where(eq(companySkillPromotionRequests.id, existingPending.id))
            .returning()
            .then((rows) => rows[0]);
          return toPromotionRequest(updated!);
        }
        return toPromotionRequest(existingPending);
      }

      const approvedSkill = await approvedSkills.getByKey(companyId, candidate.skillKey);
      if (approvedSkill) {
        throw conflict("Approved company skill already exists for this candidate key");
      }

      try {
        const created = await db
          .insert(companySkillPromotionRequests)
          .values({
            companyId,
            candidateId: input.candidateId,
            sourcePluginKey,
            status: "pending",
            note: input.note ?? null,
          })
          .returning()
          .then((rows) => rows[0]);
        return toPromotionRequest(created!);
      } catch (error) {
        if (!isPendingPromotionRequestConflict(error)) {
          throw error;
        }
        const pending = await db
          .select()
          .from(companySkillPromotionRequests)
          .where(
            and(
              eq(companySkillPromotionRequests.companyId, companyId),
              eq(companySkillPromotionRequests.candidateId, input.candidateId),
              eq(companySkillPromotionRequests.status, "pending"),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (pending) {
          return toPromotionRequest(pending);
        }
        throw conflict("A pending promotion request already exists for this candidate");
      }
    },
  };
}
