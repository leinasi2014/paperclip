import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, timestamp, uniqueIndex, uuid, text } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { departments } from "./departments.js";

export const departmentBudgetEnvelopes = pgTable(
  "department_budget_envelopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    departmentId: uuid("department_id").notNull().references(() => departments.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    monthlyLimitCents: integer("monthly_limit_cents").notNull().default(0),
    reservedCents: integer("reserved_cents").notNull().default(0),
    spentCents: integer("spent_cents").notNull().default(0),
    status: text("status").notNull().default("reserved_only"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("department_budget_envelopes_company_idx").on(table.companyId),
    departmentIdx: uniqueIndex("department_budget_envelopes_department_idx").on(table.departmentId),
    companyDepartmentFk: foreignKey({
      columns: [table.companyId, table.departmentId],
      foreignColumns: [departments.companyId, departments.id],
      name: "department_budget_envelopes_company_department_fk",
    }),
    statusChk: check(
      "department_budget_envelopes_status_chk",
      sql`${table.status} in ('allocated', 'reserved_only', 'active')`,
    ),
    monthlyLimitNonNegativeChk: check(
      "department_budget_envelopes_monthly_limit_non_negative_chk",
      sql`${table.monthlyLimitCents} >= 0`,
    ),
    reservedNonNegativeChk: check(
      "department_budget_envelopes_reserved_non_negative_chk",
      sql`${table.reservedCents} >= 0`,
    ),
    spentNonNegativeChk: check(
      "department_budget_envelopes_spent_non_negative_chk",
      sql`${table.spentCents} >= 0`,
    ),
  }),
);
