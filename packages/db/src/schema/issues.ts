import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  foreignKey,
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { projects } from "./projects.js";
import { goals } from "./goals.js";
import { companies } from "./companies.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { projectWorkspaces } from "./project_workspaces.js";
import { executionWorkspaces } from "./execution_workspaces.js";
import { departments } from "./departments.js";

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").references(() => projects.id),
    projectWorkspaceId: uuid("project_workspace_id").references(() => projectWorkspaces.id, { onDelete: "set null" }),
    owningDepartmentId: uuid("owning_department_id").references(() => departments.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => issues.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("medium"),
    assigneeAgentId: uuid("assignee_agent_id").references(() => agents.id),
    assigneeUserId: text("assignee_user_id"),
    checkoutRunId: uuid("checkout_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    executionRunId: uuid("execution_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    executionAgentNameKey: text("execution_agent_name_key"),
    executionLockedAt: timestamp("execution_locked_at", { withTimezone: true }),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    issueNumber: integer("issue_number"),
    identifier: text("identifier"),
    originKind: text("origin_kind").notNull().default("manual"),
    originId: text("origin_id"),
    originRunId: text("origin_run_id"),
    requestDepth: integer("request_depth").notNull().default(0),
    departmentIntakeStatus: text("department_intake_status"),
    routedByAgentId: uuid("routed_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    routedByUserId: text("routed_by_user_id"),
    routedAt: timestamp("routed_at", { withTimezone: true }),
    ministerDecisionResponse: text("minister_decision_response"),
    ministerDecisionByAgentId: uuid("minister_decision_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    ministerDecisionAt: timestamp("minister_decision_at", { withTimezone: true }),
    ministerDecisionReason: text("minister_decision_reason"),
    systemIssueType: text("system_issue_type"),
    systemIssueSeverity: text("system_issue_severity"),
    systemIssueWorkflowState: text("system_issue_workflow_state"),
    blockRecommended: boolean("block_recommended").notNull().default(false),
    billingCode: text("billing_code"),
    assigneeAdapterOverrides: jsonb("assignee_adapter_overrides").$type<Record<string, unknown>>(),
    executionWorkspaceId: uuid("execution_workspace_id")
      .references((): AnyPgColumn => executionWorkspaces.id, { onDelete: "set null" }),
    executionWorkspacePreference: text("execution_workspace_preference"),
    executionWorkspaceSettings: jsonb("execution_workspace_settings").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("issues_company_status_idx").on(table.companyId, table.status),
    assigneeStatusIdx: index("issues_company_assignee_status_idx").on(
      table.companyId,
      table.assigneeAgentId,
      table.status,
    ),
    assigneeUserStatusIdx: index("issues_company_assignee_user_status_idx").on(
      table.companyId,
      table.assigneeUserId,
      table.status,
    ),
    parentIdx: index("issues_company_parent_idx").on(table.companyId, table.parentId),
    projectIdx: index("issues_company_project_idx").on(table.companyId, table.projectId),
    owningDepartmentIdx: index("issues_company_owning_department_idx").on(table.companyId, table.owningDepartmentId),
    originIdx: index("issues_company_origin_idx").on(table.companyId, table.originKind, table.originId),
    projectWorkspaceIdx: index("issues_company_project_workspace_idx").on(table.companyId, table.projectWorkspaceId),
    executionWorkspaceIdx: index("issues_company_execution_workspace_idx").on(table.companyId, table.executionWorkspaceId),
    identifierIdx: uniqueIndex("issues_identifier_idx").on(table.identifier),
    companyIdIdUq: uniqueIndex("issues_company_id_id_uq").on(table.companyId, table.id),
    companyOwningDepartmentFk: foreignKey({
      columns: [table.companyId, table.owningDepartmentId],
      foreignColumns: [departments.companyId, departments.id],
      name: "issues_company_owning_department_fk",
    }),
    companyRoutedByAgentFk: foreignKey({
      columns: [table.companyId, table.routedByAgentId],
      foreignColumns: [agents.companyId, agents.id],
      name: "issues_company_routed_by_agent_fk",
    }),
    companyMinisterDecisionByAgentFk: foreignKey({
      columns: [table.companyId, table.ministerDecisionByAgentId],
      foreignColumns: [agents.companyId, agents.id],
      name: "issues_company_minister_decision_by_agent_fk",
    }),
    departmentIntakeStatusChk: check(
      "issues_department_intake_status_chk",
      sql`${table.departmentIntakeStatus} is null or ${table.departmentIntakeStatus} in ('ceo_intake', 'routed', 'accepted', 'rejected', 'needs_clarification')`,
    ),
    ministerDecisionResponseChk: check(
      "issues_minister_decision_response_chk",
      sql`${table.ministerDecisionResponse} is null or ${table.ministerDecisionResponse} in ('accept', 'reject', 'needs_clarification')`,
    ),
    systemIssueTypeChk: check(
      "issues_system_issue_type_chk",
      sql`${table.systemIssueType} is null or ${table.systemIssueType} in ('execution', 'skill', 'governance')`,
    ),
    systemIssueSeverityChk: check(
      "issues_system_issue_severity_chk",
      sql`${table.systemIssueSeverity} is null or ${table.systemIssueSeverity} in ('critical', 'high', 'medium', 'low')`,
    ),
    systemIssueWorkflowStateChk: check(
      "issues_system_issue_workflow_state_chk",
      sql`${table.systemIssueWorkflowState} is null or ${table.systemIssueWorkflowState} in ('open', 'triaging', 'in_progress', 'pending_review', 'review_passed', 'ready_to_resume', 'done')`,
    ),
    openRoutineExecutionIdx: uniqueIndex("issues_open_routine_execution_uq")
      .on(table.companyId, table.originKind, table.originId)
      .where(
        sql`${table.originKind} = 'routine_execution'
          and ${table.originId} is not null
          and ${table.hiddenAt} is null
          and ${table.executionRunId} is not null
          and ${table.status} in ('backlog', 'todo', 'in_progress', 'in_review', 'blocked')`,
      ),
  }),
);
