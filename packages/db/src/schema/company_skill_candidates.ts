import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const companySkillCandidates = pgTable(
  "company_skill_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    sourcePluginKey: text("source_plugin_key").notNull(),
    skillKey: text("skill_key").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    markdown: text("markdown").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdIdUq: uniqueIndex("company_skill_candidates_company_id_id_uq").on(
      table.companyId,
      table.id,
    ),
    companySkillKeyUq: uniqueIndex("company_skill_candidates_company_skill_key_uq").on(
      table.companyId,
      table.skillKey,
    ),
    companySlugIdx: index("company_skill_candidates_company_slug_idx").on(table.companyId, table.slug),
  }),
);
