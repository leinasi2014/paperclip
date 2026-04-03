import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { departments, departmentBudgetEnvelopes, agents } from "@paperclipai/db";
import { conflict, notFound, unprocessable } from "../errors.js";
import {
  pauseTemporaryWorkersForDepartmentFreeze,
  queueTemporaryWorkersForCeoResume,
} from "./temporary-workers.js";

function normalizeSlug(input: string) {
  return input.trim().toLowerCase();
}

type DepartmentReader = Pick<Db, "select">;

async function getAgentForMinisterAssignment(db: DepartmentReader, agentId: string) {
  const agent = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .then((rows) => rows[0] ?? null);
  if (!agent) throw notFound("Agent not found");
  if (agent.role === "ceo") {
    throw unprocessable("CEO cannot be assigned as a department minister");
  }
  return agent;
}

function isPgUniqueViolation(error: unknown, constraint?: string) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: string }).code : undefined;
  if (code !== "23505") return false;
  if (!constraint) return true;
  const details = error as { constraint?: string; constraint_name?: string };
  return details.constraint === constraint || details.constraint_name === constraint;
}

export function departmentService(db: Db) {
  return {
    list: (companyId: string) =>
      db
        .select()
        .from(departments)
        .where(eq(departments.companyId, companyId)),

    getById: (id: string) =>
      db
        .select()
        .from(departments)
        .where(eq(departments.id, id))
        .then((rows) => rows[0] ?? null),

    create: async (
      companyId: string,
      data: {
        name: string;
        slug: string;
        mission?: string | null;
        ministerAgentId?: string | null;
        maxConcurrentTemporaryWorkers?: number;
        temporaryWorkerTtlMinutes?: number;
      },
    ) =>
      db.transaction(async (tx) => {
        let ministerAgentId: string | null = data.ministerAgentId ?? null;
        if (ministerAgentId) {
          const minister = await getAgentForMinisterAssignment(tx, ministerAgentId);
          if (minister.companyId !== companyId) {
            throw unprocessable("Department minister must belong to the same company");
          }
          const existingSeat = await tx
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.ministerAgentId, ministerAgentId))
            .then((rows) => rows[0] ?? null);
          if (existingSeat) {
            throw conflict("Agent is already assigned as a department minister");
          }
        }

        let created: typeof departments.$inferSelect | null = null;
        try {
          created = await tx
            .insert(departments)
            .values({
              companyId,
              name: data.name.trim(),
              slug: normalizeSlug(data.slug),
              mission: data.mission?.trim() || null,
              ministerAgentId,
              maxConcurrentTemporaryWorkers: data.maxConcurrentTemporaryWorkers ?? 0,
              temporaryWorkerTtlMinutes: data.temporaryWorkerTtlMinutes ?? 8 * 60,
              status: ministerAgentId ? "active" : "frozen_unstaffed",
            })
            .returning()
            .then((rows) => rows[0] ?? null);
        } catch (error) {
          if (isPgUniqueViolation(error, "departments_company_slug_idx")) {
            throw conflict("Department slug already exists in this company");
          }
          if (isPgUniqueViolation(error, "departments_minister_agent_idx")) {
            throw conflict("Agent is already assigned as a department minister");
          }
          throw error;
        }
        if (!created) throw notFound("Department not created");

        await tx.insert(departmentBudgetEnvelopes).values({
          departmentId: created.id,
          companyId,
          status: ministerAgentId ? "active" : "reserved_only",
        });

        return created;
      }),

    update: async (
      id: string,
      data: {
        name?: string;
        slug?: string;
        mission?: string | null;
        maxConcurrentTemporaryWorkers?: number;
        temporaryWorkerTtlMinutes?: number;
      },
    ) => {
      const patch: Partial<typeof departments.$inferInsert> = {};
      if (data.name !== undefined) patch.name = data.name.trim();
      if (data.slug !== undefined) patch.slug = normalizeSlug(data.slug);
      if (data.mission !== undefined) patch.mission = data.mission?.trim() || null;
      if (data.maxConcurrentTemporaryWorkers !== undefined) {
        patch.maxConcurrentTemporaryWorkers = data.maxConcurrentTemporaryWorkers;
      }
      if (data.temporaryWorkerTtlMinutes !== undefined) {
        patch.temporaryWorkerTtlMinutes = data.temporaryWorkerTtlMinutes;
      }
      patch.updatedAt = new Date();
      try {
        return await db
          .update(departments)
          .set(patch)
          .where(eq(departments.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
      } catch (error) {
        if (isPgUniqueViolation(error, "departments_company_slug_idx")) {
          throw conflict("Department slug already exists in this company");
        }
        throw error;
      }
    },

    assignMinister: async (id: string, agentId: string) =>
      db.transaction(async (tx) => {
        const department = await tx
          .select()
          .from(departments)
          .where(eq(departments.id, id))
          .then((rows) => rows[0] ?? null);
        if (!department) return null;

        const minister = await getAgentForMinisterAssignment(tx, agentId);
        if (minister.companyId !== department.companyId) {
          throw unprocessable("Department minister must belong to the same company");
        }

        const existingSeat = await tx
          .select({ id: departments.id })
          .from(departments)
          .where(and(eq(departments.ministerAgentId, agentId), eq(departments.companyId, department.companyId)))
          .then((rows) => rows[0] ?? null);
        if (existingSeat && existingSeat.id !== id) {
          throw conflict("Agent is already assigned as a department minister");
        }

        const updated = await tx
          .update(departments)
          .set({
            ministerAgentId: agentId,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(departments.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!updated) return null;

        await tx
          .insert(departmentBudgetEnvelopes)
          .values({
            departmentId: updated.id,
            companyId: updated.companyId,
            status: "active",
          })
          .onConflictDoUpdate({
            target: departmentBudgetEnvelopes.departmentId,
            set: {
              status: "active",
              updatedAt: new Date(),
            },
          });

        await queueTemporaryWorkersForCeoResume(tx, id, {
          nextMinisterAgentId: agentId,
          reason: "department_restaffed_ceo_resume_required",
        });

        return updated;
      }),

    removeMinister: async (id: string) =>
      db.transaction(async (tx) => {
        const updated = await tx
          .update(departments)
          .set({
            ministerAgentId: null,
            status: "frozen_unstaffed",
            updatedAt: new Date(),
          })
          .where(eq(departments.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!updated) return null;

        await tx
          .update(departmentBudgetEnvelopes)
          .set({
            status: "reserved_only",
            updatedAt: new Date(),
          })
          .where(eq(departmentBudgetEnvelopes.departmentId, id));

        await queueTemporaryWorkersForCeoResume(tx, id, {
          reason: "minister_removed_ceo_resume_required",
        });

        return updated;
      }),

    freeze: async (id: string, status: "frozen_unstaffed" | "frozen_suspended") =>
      db.transaction(async (tx) => {
        const department = await tx
          .select()
          .from(departments)
          .where(eq(departments.id, id))
          .then((rows) => rows[0] ?? null);
        if (!department) return null;
        if (status === "frozen_unstaffed" && department.ministerAgentId) {
          throw unprocessable("Remove the minister before freezing a department as unstaffed");
        }

        const updated = await tx
          .update(departments)
          .set({
            status,
            updatedAt: new Date(),
          })
          .where(eq(departments.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!updated) return null;

        await tx
          .update(departmentBudgetEnvelopes)
          .set({
            status: "reserved_only",
            updatedAt: new Date(),
          })
          .where(eq(departmentBudgetEnvelopes.departmentId, id));

        await pauseTemporaryWorkersForDepartmentFreeze(tx, id);

        return updated;
      }),

    unfreeze: async (id: string) =>
      db.transaction(async (tx) => {
        const department = await tx
          .select()
          .from(departments)
          .where(eq(departments.id, id))
          .then((rows) => rows[0] ?? null);
        if (!department) return null;
        if (!department.ministerAgentId) {
          throw unprocessable("Cannot unfreeze a department without a minister");
        }

        const updated = await tx
          .update(departments)
          .set({
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(departments.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!updated) return null;

        await tx
          .insert(departmentBudgetEnvelopes)
          .values({
            departmentId: updated.id,
            companyId: updated.companyId,
            status: "active",
          })
          .onConflictDoUpdate({
            target: departmentBudgetEnvelopes.departmentId,
            set: {
              status: "active",
              updatedAt: new Date(),
            },
          });

        await queueTemporaryWorkersForCeoResume(tx, id, {
          nextMinisterAgentId: department.ministerAgentId,
          reason: "department_unfrozen_ceo_resume_required",
        });

        return updated;
      }),
  };
}
