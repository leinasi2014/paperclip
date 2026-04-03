import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { pluginRolloutApprovals, pluginRollouts, plugins } from "@paperclipai/db";
import type {
  CreateSystemPluginRollout,
  ListSystemPluginRolloutsQuery,
  PluginRecord,
  RecordSystemPluginRolloutApproval,
  RequiredSystemPluginKey,
  SystemPluginRollout,
  SystemPluginRolloutApprovalDecision,
  SystemPluginRolloutApprovalRecord,
  SystemPluginRolloutCommand,
} from "@paperclipai/shared";
import { REQUIRED_SYSTEM_PLUGIN_KEYS } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { pluginRegistryService } from "./plugin-registry.js";
import type { PluginLifecycleManager } from "./plugin-lifecycle.js";

function isActiveRolloutConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { code?: string; constraint?: string; constraint_name?: string };
  const constraint = err.constraint ?? err.constraint_name;
  return err.code === "23505" && constraint === "plugin_rollouts_active_plugin_uq";
}

type RestartLifecycle = Pick<PluginLifecycleManager, "restartWorker">;

type RolloutRow = typeof pluginRollouts.$inferSelect;
type ApprovalRow = typeof pluginRolloutApprovals.$inferSelect;

type HydratedRolloutRow = {
  rollout: RolloutRow;
  plugin: PluginRecord;
};

function toApproval(row: ApprovalRow): SystemPluginRolloutApprovalRecord {
  return {
    id: row.id,
    rolloutId: row.rolloutId,
    decision: row.decision,
    actorUserId: row.actorUserId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

function isRequiredSystemPluginKey(pluginKey: string): pluginKey is RequiredSystemPluginKey {
  return (REQUIRED_SYSTEM_PLUGIN_KEYS as readonly string[]).includes(pluginKey);
}

function buildRestartCommand(input: {
  rolloutId: string;
  pluginId: string;
  pluginKey: RequiredSystemPluginKey;
  baseVersion: string;
  candidateVersion: string | null;
}): SystemPluginRolloutCommand {
  return {
    kind: "restart_worker",
    strategy: "restart_path_mvp",
    rolloutId: input.rolloutId,
    pluginId: input.pluginId,
    pluginKey: input.pluginKey,
    baseVersion: input.baseVersion,
    candidateVersion: input.candidateVersion,
    instructions:
      "Ensure the candidate plugin package/config is already present on disk, then restart the worker to pick up the candidate.",
    metadata: {},
  };
}

function buildRollbackCommand(input: {
  rolloutId: string;
  pluginId: string;
  pluginKey: RequiredSystemPluginKey;
  baseVersion: string;
  candidateVersion: string | null;
}): SystemPluginRolloutCommand {
  return {
    kind: "restore_then_restart_worker",
    strategy: "restart_path_mvp",
    rolloutId: input.rolloutId,
    pluginId: input.pluginId,
    pluginKey: input.pluginKey,
    baseVersion: input.baseVersion,
    candidateVersion: input.candidateVersion,
    instructions:
      "Restore the plugin package or deployment artifact back to the baseVersion, then restart the worker to resume the previous live code path.",
    metadata: {},
  };
}

export function systemPluginRolloutService(
  db: Db,
  deps?: {
    lifecycle?: RestartLifecycle;
  },
) {
  const registry = pluginRegistryService(db);

  async function resolvePluginRef(input: { pluginId?: string; pluginKey?: string }) {
    const plugin = input.pluginId
      ? await registry.getById(input.pluginId)
      : input.pluginKey
        ? await registry.getByKey(input.pluginKey)
        : null;
    if (!plugin) throw notFound("Required system plugin not found");
    if (!isRequiredSystemPluginKey(plugin.pluginKey)) {
      throw unprocessable("Rollouts are only supported for required system plugins");
    }
    if (plugin.status === "uninstalled") {
      throw conflict("Cannot manage rollouts for an uninstalled plugin");
    }
    return plugin as PluginRecord & { pluginKey: RequiredSystemPluginKey };
  }

  async function loadApprovals(rolloutId: string) {
    return db
      .select()
      .from(pluginRolloutApprovals)
      .where(eq(pluginRolloutApprovals.rolloutId, rolloutId))
      .orderBy(pluginRolloutApprovals.createdAt)
      .then((rows) => rows.map(toApproval));
  }

  async function hydrateRollout(row: HydratedRolloutRow): Promise<SystemPluginRollout> {
    const approvals = await loadApprovals(row.rollout.id);
    return {
      id: row.rollout.id,
      pluginId: row.rollout.pluginId,
      pluginKey: row.plugin.pluginKey as RequiredSystemPluginKey,
      pluginPackageName: row.plugin.packageName,
      pluginStatus: row.plugin.status,
      rolloutKind: row.rollout.rolloutKind,
      status: row.rollout.status,
      baseVersion: row.rollout.baseVersion,
      candidateVersion: row.rollout.candidateVersion,
      candidateMetadata: row.rollout.candidateMetadata ?? {},
      note: row.rollout.note,
      lastError: row.rollout.lastError,
      requestedByUserId: row.rollout.requestedByUserId,
      approvedAt: row.rollout.approvedAt,
      rejectedAt: row.rollout.rejectedAt,
      executedAt: row.rollout.executedAt,
      completedAt: row.rollout.completedAt,
      restartCommand: row.rollout.restartCommandJson ?? null,
      rollbackCommand: row.rollout.rollbackCommandJson ?? null,
      approvals,
      createdAt: row.rollout.createdAt,
      updatedAt: row.rollout.updatedAt,
    };
  }

  async function getHydratedById(id: string) {
    return db
      .select({ rollout: pluginRollouts, plugin: plugins })
      .from(pluginRollouts)
      .innerJoin(plugins, eq(pluginRollouts.pluginId, plugins.id))
      .where(eq(pluginRollouts.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function getByIdOrThrow(id: string) {
    const row = await getHydratedById(id);
    if (!row) throw notFound("System plugin rollout not found");
    return row;
  }

  async function updateRollout(
    id: string,
    patch: Partial<typeof pluginRollouts.$inferInsert>,
  ) {
    const row = await db
      .update(pluginRollouts)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(pluginRollouts.id, id))
      .returning()
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("System plugin rollout not found");
    return row;
  }

  return {
    list: async (query: ListSystemPluginRolloutsQuery = {}) => {
      const conditions = [];
      if (query.pluginId) conditions.push(eq(pluginRollouts.pluginId, query.pluginId));
      if (query.pluginKey) conditions.push(eq(pluginRollouts.pluginKey, query.pluginKey));
      if (query.status) conditions.push(eq(pluginRollouts.status, query.status));

      const rows = await db
        .select({ rollout: pluginRollouts, plugin: plugins })
        .from(pluginRollouts)
        .innerJoin(plugins, eq(pluginRollouts.pluginId, plugins.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(pluginRollouts.createdAt))
        .limit(query.limit ?? 100)
        .offset(query.offset ?? 0);

      return Promise.all(rows.map((row) => hydrateRollout(row)));
    },

    getById: async (id: string) => {
      const row = await getHydratedById(id);
      return row ? hydrateRollout(row) : null;
    },

    create: async (input: CreateSystemPluginRollout, actorUserId: string) => {
      const plugin = await resolvePluginRef({
        pluginId: input.pluginId,
        pluginKey: input.pluginKey,
      });

      const existingActive = await db
        .select({ id: pluginRollouts.id })
        .from(pluginRollouts)
        .where(
          and(
            eq(pluginRollouts.pluginId, plugin.id),
            inArray(pluginRollouts.status, ["pending_approval", "approved", "executing"]),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (existingActive) {
        throw conflict("An active rollout already exists for this required system plugin");
      }

      let created: typeof pluginRollouts.$inferSelect | null = null;
      try {
        created = await db
          .insert(pluginRollouts)
          .values({
            pluginId: plugin.id,
            pluginKey: plugin.pluginKey,
            rolloutKind: "restart_path",
            status: "pending_approval",
            baseVersion: plugin.version,
            candidateVersion: input.candidateVersion ?? null,
            candidateMetadata: input.candidateMetadata ?? {},
            note: input.note ?? null,
            requestedByUserId: actorUserId,
          })
          .returning()
          .then((rows) => rows[0] ?? null);
      } catch (error) {
        if (!isActiveRolloutConflict(error)) {
          throw error;
        }
        throw conflict("An active rollout already exists for this required system plugin");
      }

      if (!created) throw conflict("System plugin rollout was not created");
      return hydrateRollout({
        rollout: created,
        plugin,
      });
    },

    recordApproval: async (
      id: string,
      input: RecordSystemPluginRolloutApproval,
      actorUserId: string,
    ) => {
      const existing = await getByIdOrThrow(id);
      if (existing.rollout.status !== "pending_approval") {
        throw conflict("Only pending rollouts can be approved or rejected");
      }

      await db.insert(pluginRolloutApprovals).values({
        rolloutId: id,
        decision: input.decision as SystemPluginRolloutApprovalDecision,
        actorUserId,
        note: input.note ?? null,
      });

      const now = new Date();
      await updateRollout(id, {
        status: input.decision === "approved" ? "approved" : "rejected",
        approvedAt: input.decision === "approved" ? now : null,
        rejectedAt: input.decision === "rejected" ? now : null,
      });

      const updated = await getByIdOrThrow(id);
      return hydrateRollout(updated);
    },

    executeRestartPath: async (id: string) => {
      if (!deps?.lifecycle) {
        throw conflict("Controlled restart path is not configured");
      }

      const existing = await getByIdOrThrow(id);
      if (existing.rollout.status !== "approved") {
        throw conflict("Only approved rollouts can execute the restart path");
      }
      if (!isRequiredSystemPluginKey(existing.rollout.pluginKey)) {
        throw unprocessable("Rollouts are only supported for required system plugins");
      }

      const restartCommand = buildRestartCommand({
        rolloutId: existing.rollout.id,
        pluginId: existing.plugin.id,
        pluginKey: existing.rollout.pluginKey,
        baseVersion: existing.rollout.baseVersion,
        candidateVersion: existing.rollout.candidateVersion,
      });

      await updateRollout(id, {
        status: "executing",
        executedAt: new Date(),
        restartCommandJson: restartCommand,
        lastError: null,
      });

      try {
        await deps.lifecycle.restartWorker(existing.plugin.id);
      } catch (error) {
        await updateRollout(id, {
          status: "failed",
          completedAt: new Date(),
          lastError: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      await updateRollout(id, {
        status: "succeeded",
        completedAt: new Date(),
      });

      const updated = await getByIdOrThrow(id);
      return hydrateRollout(updated);
    },

    buildRollbackCommand: async (id: string) => {
      const existing = await getByIdOrThrow(id);
      if (existing.rollout.status === "pending_approval" || existing.rollout.status === "rejected") {
        throw conflict("Rollback commands are only available after approval");
      }
      if (!isRequiredSystemPluginKey(existing.rollout.pluginKey)) {
        throw unprocessable("Rollouts are only supported for required system plugins");
      }

      const rollbackCommand = buildRollbackCommand({
        rolloutId: existing.rollout.id,
        pluginId: existing.plugin.id,
        pluginKey: existing.rollout.pluginKey,
        baseVersion: existing.rollout.baseVersion,
        candidateVersion: existing.rollout.candidateVersion,
      });

      await updateRollout(id, {
        rollbackCommandJson: rollbackCommand,
      });

      const updated = await getByIdOrThrow(id);
      return hydrateRollout(updated);
    },
  };
}
