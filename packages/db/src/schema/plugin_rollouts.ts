import {
  check,
  uniqueIndex,
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  SystemPluginRolloutApprovalDecision,
  SystemPluginRolloutCommand,
  SystemPluginRolloutKind,
  SystemPluginRolloutStatus,
} from "@paperclipai/shared";
import { plugins } from "./plugins.js";

export const pluginRollouts = pgTable(
  "plugin_rollouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    pluginKey: text("plugin_key").notNull(),
    rolloutKind: text("rollout_kind")
      .$type<SystemPluginRolloutKind>()
      .notNull()
      .default("restart_path"),
    status: text("status")
      .$type<SystemPluginRolloutStatus>()
      .notNull()
      .default("pending_approval"),
    baseVersion: text("base_version").notNull(),
    candidateVersion: text("candidate_version"),
    candidateMetadata: jsonb("candidate_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    note: text("note"),
    lastError: text("last_error"),
    requestedByUserId: text("requested_by_user_id").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    restartCommandJson: jsonb("restart_command_json").$type<SystemPluginRolloutCommand>(),
    rollbackCommandJson: jsonb("rollback_command_json").$type<SystemPluginRolloutCommand>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginIdx: index("plugin_rollouts_plugin_idx").on(table.pluginId, table.createdAt),
    statusIdx: index("plugin_rollouts_status_idx").on(table.status, table.createdAt),
    activePluginUq: uniqueIndex("plugin_rollouts_active_plugin_uq")
      .on(table.pluginId)
      .where(sql`${table.status} in ('pending_approval', 'approved', 'executing')`),
    rolloutKindChk: check(
      "plugin_rollouts_kind_chk",
      sql`${table.rolloutKind} in ('restart_path')`,
    ),
    rolloutStatusChk: check(
      "plugin_rollouts_status_chk",
      sql`${table.status} in ('pending_approval', 'approved', 'rejected', 'executing', 'succeeded', 'failed')`,
    ),
  }),
);

export const pluginRolloutApprovals = pgTable(
  "plugin_rollout_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rolloutId: uuid("rollout_id")
      .notNull()
      .references(() => pluginRollouts.id, { onDelete: "cascade" }),
    decision: text("decision")
      .$type<SystemPluginRolloutApprovalDecision>()
      .notNull(),
    actorUserId: text("actor_user_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    rolloutIdx: index("plugin_rollout_approvals_rollout_idx").on(table.rolloutId, table.createdAt),
    decisionChk: check(
      "plugin_rollout_approvals_decision_chk",
      sql`${table.decision} in ('approved', 'rejected')`,
    ),
  }),
);
