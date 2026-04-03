import { check, foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { companySkillCandidates } from "./company_skill_candidates.js";

export const companySkillPromotionRequests = pgTable(
  "company_skill_promotion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => companySkillCandidates.id, { onDelete: "cascade" }),
    sourcePluginKey: text("source_plugin_key").notNull(),
    status: text("status").notNull().default("pending"),
    note: text("note"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCandidateFk: foreignKey({
      columns: [table.companyId, table.candidateId],
      foreignColumns: [companySkillCandidates.companyId, companySkillCandidates.id],
      name: "company_skill_promotion_requests_company_candidate_fk",
    }),
    companyIdx: index("company_skill_promotion_requests_company_idx").on(table.companyId, table.createdAt),
    candidateIdx: index("company_skill_promotion_requests_candidate_idx").on(table.candidateId, table.createdAt),
    pendingCandidateUq: uniqueIndex("company_skill_promotion_requests_pending_candidate_uq")
      .on(table.companyId, table.candidateId)
      .where(sql`${table.status} = 'pending'`),
    statusChk: check(
      "company_skill_promotion_requests_status_chk",
      sql`${table.status} in ('pending', 'approved', 'rejected')`,
    ),
  }),
);
