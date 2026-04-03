import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { departments } from "./departments.js";
import { issues } from "./issues.js";

export const temporaryWorkers = pgTable(
  "temporary_workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    departmentId: uuid("department_id").notNull().references(() => departments.id),
    ownerMinisterAgentId: uuid("owner_minister_agent_id").notNull().references(() => agents.id),
    sourceIssueId: uuid("source_issue_id").notNull().references(() => issues.id),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    ttlExpiresAt: timestamp("ttl_expires_at", { withTimezone: true }).notNull(),
    statusReason: text("status_reason"),
    resumeRequestedAt: timestamp("resume_requested_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyDepartmentFk: foreignKey({
      columns: [table.companyId, table.departmentId],
      foreignColumns: [departments.companyId, departments.id],
      name: "temporary_workers_company_department_fk",
    }),
    companyMinisterFk: foreignKey({
      columns: [table.companyId, table.ownerMinisterAgentId],
      foreignColumns: [agents.companyId, agents.id],
      name: "temporary_workers_company_minister_fk",
    }),
    companySourceIssueFk: foreignKey({
      columns: [table.companyId, table.sourceIssueId],
      foreignColumns: [issues.companyId, issues.id],
      name: "temporary_workers_company_source_issue_fk",
    }),
    companyIdx: index("temporary_workers_company_idx").on(table.companyId),
    departmentIdx: index("temporary_workers_department_idx").on(table.departmentId),
    ownerMinisterIdx: index("temporary_workers_owner_minister_idx").on(table.ownerMinisterAgentId),
    sourceIssueIdx: index("temporary_workers_source_issue_idx").on(table.sourceIssueId),
    activeDepartmentIdx: index("temporary_workers_department_status_idx").on(table.departmentId, table.status),
    statusChk: check(
      "temporary_workers_status_chk",
      sql`${table.status} in (
        'active',
        'paused_due_to_department_freeze',
        'paused_pending_ceo_resume',
        'ttl_expired_pending_minister',
        'ttl_expired_pending_ceo_or_board',
        'terminated'
      )`,
    ),
  }),
);
