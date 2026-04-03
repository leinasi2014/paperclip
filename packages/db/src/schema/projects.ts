import { check, pgTable, uuid, text, timestamp, date, index, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { goals } from "./goals.js";
import { agents } from "./agents.js";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    goalId: uuid("goal_id").references(() => goals.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    leadAgentId: uuid("lead_agent_id").references(() => agents.id),
    targetDate: date("target_date"),
    color: text("color"),
    pauseReason: text("pause_reason"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    executionWorkspacePolicy: jsonb("execution_workspace_policy").$type<Record<string, unknown>>(),
    isSystemProject: boolean("is_system_project").notNull().default(false),
    systemProjectKind: text("system_project_kind"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("projects_company_idx").on(table.companyId),
    canonicalSystemProjectIdx: uniqueIndex("projects_company_system_kind_uq")
      .on(table.companyId, table.systemProjectKind)
      .where(sql`${table.isSystemProject} = true and ${table.systemProjectKind} is not null`),
    systemProjectKindChk: check(
      "projects_system_project_kind_chk",
      sql`${table.systemProjectKind} is null or ${table.systemProjectKind} in ('execution_governance')`,
    ),
    systemProjectFlagConsistencyChk: check(
      "projects_system_project_flag_consistency_chk",
      sql`${table.systemProjectKind} is null or ${table.isSystemProject} = true`,
    ),
  }),
);
