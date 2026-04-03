import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    mission: text("mission"),
    status: text("status").notNull().default("frozen_unstaffed"),
    ministerAgentId: uuid("minister_agent_id").references(() => agents.id),
    maxConcurrentTemporaryWorkers: integer("max_concurrent_temporary_workers").notNull().default(0),
    temporaryWorkerTtlMinutes: integer("temporary_worker_ttl_minutes").notNull().default(480),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdIdUq: unique("departments_company_id_id_uq").on(table.companyId, table.id),
    companyIdx: index("departments_company_idx").on(table.companyId),
    companySlugIdx: uniqueIndex("departments_company_slug_idx").on(table.companyId, table.slug),
    ministerIdx: uniqueIndex("departments_minister_agent_idx").on(table.ministerAgentId),
    companyMinisterFk: foreignKey({
      columns: [table.companyId, table.ministerAgentId],
      foreignColumns: [agents.companyId, agents.id],
      name: "departments_company_minister_fk",
    }),
    statusChk: check(
      "departments_status_chk",
      sql`${table.status} in ('active', 'frozen_unstaffed', 'frozen_suspended')`,
    ),
    maxWorkersNonNegativeChk: check(
      "departments_max_workers_non_negative_chk",
      sql`${table.maxConcurrentTemporaryWorkers} >= 0`,
    ),
    temporaryWorkerTtlPositiveChk: check(
      "departments_temporary_worker_ttl_positive_chk",
      sql`${table.temporaryWorkerTtlMinutes} > 0`,
    ),
  }),
);
