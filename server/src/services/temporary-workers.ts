import { and, eq, inArray, lte, ne, notInArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, departments, issues, temporaryWorkers } from "@paperclipai/db";
import type { CreateTemporaryWorker, TemporaryWorkerStatus } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";

const ACTIVE_TEMPORARY_WORKER_STATUSES = ["active"] as const;
const RESUMABLE_TEMPORARY_WORKER_STATUSES = [
  "paused_pending_ceo_resume",
  "ttl_expired_pending_ceo_or_board",
] as const;
const TTL_PENDING_STATUSES = [
  "active",
  "paused_due_to_department_freeze",
  "paused_pending_ceo_resume",
] as const;

type WorkerDb = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

async function getDepartment(database: WorkerDb, departmentId: string) {
  return database
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .then((rows) => rows[0] ?? null);
}

async function getWorker(database: WorkerDb, workerId: string) {
  return database
    .select()
    .from(temporaryWorkers)
    .where(eq(temporaryWorkers.id, workerId))
    .then((rows) => rows[0] ?? null);
}

async function getSourceIssue(database: WorkerDb, issueId: string) {
  return database
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .then((rows) => rows[0] ?? null);
}

function ensureWorkerWritableStatus(status: string) {
  if (status === "terminated") {
    throw conflict("Temporary worker has already been terminated");
  }
}

export async function pauseTemporaryWorkersForDepartmentFreeze(
  database: WorkerDb,
  departmentId: string,
) {
  await database
    .update(temporaryWorkers)
    .set({
      status: "paused_due_to_department_freeze",
      statusReason: "department_frozen",
      resumeRequestedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(temporaryWorkers.departmentId, departmentId),
        notInArray(temporaryWorkers.status, ["terminated", "ttl_expired_pending_ceo_or_board", "ttl_expired_pending_minister"]),
      ),
    );
}

export async function queueTemporaryWorkersForCeoResume(
  database: WorkerDb,
  departmentId: string,
  options?: { nextMinisterAgentId?: string | null; reason?: string | null },
) {
  const patch: Partial<typeof temporaryWorkers.$inferInsert> = {
    status: "paused_pending_ceo_resume",
    statusReason: options?.reason?.trim() || "ceo_resume_required",
    updatedAt: new Date(),
  };
  if (options?.nextMinisterAgentId) {
    patch.ownerMinisterAgentId = options.nextMinisterAgentId;
  }
  await database
    .update(temporaryWorkers)
    .set(patch)
    .where(
      and(
        eq(temporaryWorkers.departmentId, departmentId),
        ne(temporaryWorkers.status, "terminated"),
      ),
    );
}

export async function queueTemporaryWorkersForIssueRoutingChange(
  database: WorkerDb,
  issueId: string,
  reason = "issue_rerouted",
) {
  await database
    .update(temporaryWorkers)
    .set({
      status: "paused_pending_ceo_resume",
      statusReason: reason,
      resumeRequestedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(temporaryWorkers.sourceIssueId, issueId),
        ne(temporaryWorkers.status, "terminated"),
      ),
    );
}

export function temporaryWorkerService(db: Db) {
  return {
    listByDepartment: (departmentId: string) =>
      db
        .select()
        .from(temporaryWorkers)
        .where(eq(temporaryWorkers.departmentId, departmentId)),

    getById: (id: string) => getWorker(db, id),

    spawn: async (
      departmentId: string,
      ministerAgentId: string,
      input: CreateTemporaryWorker,
    ) =>
      db.transaction(async (tx) => {
        const department = await getDepartment(tx, departmentId);
        if (!department) throw notFound("Department not found");
        if (department.status !== "active") {
          throw unprocessable("Department must be active before spawning temporary workers");
        }
        if (department.ministerAgentId !== ministerAgentId) {
          throw conflict("Only the current department minister can spawn temporary workers");
        }

        const issue = await tx
          .select()
          .from(issues)
          .where(eq(issues.id, input.sourceIssueId))
          .then((rows) => rows[0] ?? null);
        if (!issue) throw notFound("Issue not found");
        if (issue.companyId !== department.companyId) {
          throw unprocessable("Issue must belong to the same company");
        }
        if (issue.owningDepartmentId !== departmentId || issue.departmentIntakeStatus !== "accepted") {
          throw unprocessable("Temporary workers may only be spawned from accepted issues owned by the department");
        }

        if (department.maxConcurrentTemporaryWorkers > 0) {
          const activeCount = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(temporaryWorkers)
            .where(
              and(
                eq(temporaryWorkers.departmentId, departmentId),
                inArray(temporaryWorkers.status, ACTIVE_TEMPORARY_WORKER_STATUSES as unknown as string[]),
              ),
            )
            .then((rows) => rows[0]?.count ?? 0);
          if (activeCount >= department.maxConcurrentTemporaryWorkers) {
            throw conflict("Department has reached its concurrent temporary worker limit");
          }
        }

        const ttlMinutes = input.ttlMinutes ?? department.temporaryWorkerTtlMinutes;
        const ttlExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
        return tx
          .insert(temporaryWorkers)
          .values({
            companyId: department.companyId,
            departmentId,
            ownerMinisterAgentId: ministerAgentId,
            sourceIssueId: issue.id,
            name: input.name.trim(),
            status: "active",
            ttlExpiresAt,
          })
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    requestPause: async (workerId: string, ministerAgentId: string, reason?: string | null) =>
      db.transaction(async (tx) => {
        const worker = await getWorker(tx, workerId);
        if (!worker) throw notFound("Temporary worker not found");
        ensureWorkerWritableStatus(worker.status);

        const department = await getDepartment(tx, worker.departmentId);
        if (!department) throw notFound("Department not found");
        if (department.ministerAgentId !== ministerAgentId || worker.ownerMinisterAgentId !== ministerAgentId) {
          throw conflict("Only the current owning minister can pause this temporary worker");
        }

        return tx
          .update(temporaryWorkers)
          .set({
            status: "paused_pending_ceo_resume",
            statusReason: reason?.trim() || "minister_pause_requested",
            resumeRequestedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(temporaryWorkers.id, workerId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    requestResume: async (workerId: string, ministerAgentId: string, reason?: string | null) =>
      db.transaction(async (tx) => {
        const worker = await getWorker(tx, workerId);
        if (!worker) throw notFound("Temporary worker not found");
        ensureWorkerWritableStatus(worker.status);

        const department = await getDepartment(tx, worker.departmentId);
        if (!department) throw notFound("Department not found");
        if (department.ministerAgentId !== ministerAgentId) {
          throw conflict("Only the current department minister can request temporary worker resume");
        }
        if (!RESUMABLE_TEMPORARY_WORKER_STATUSES.includes(worker.status as (typeof RESUMABLE_TEMPORARY_WORKER_STATUSES)[number])
          && worker.status !== "paused_due_to_department_freeze"
          && worker.status !== "ttl_expired_pending_minister") {
          throw conflict("Temporary worker is not waiting on a resume request");
        }

        return tx
          .update(temporaryWorkers)
          .set({
            status:
              worker.status === "ttl_expired_pending_minister"
                ? "ttl_expired_pending_ceo_or_board"
                : "paused_pending_ceo_resume",
            statusReason: reason?.trim() || "resume_requested",
            resumeRequestedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(temporaryWorkers.id, workerId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    approveResume: async (workerId: string) =>
      db.transaction(async (tx) => {
        const worker = await getWorker(tx, workerId);
        if (!worker) throw notFound("Temporary worker not found");
        ensureWorkerWritableStatus(worker.status);
        if (!RESUMABLE_TEMPORARY_WORKER_STATUSES.includes(worker.status as (typeof RESUMABLE_TEMPORARY_WORKER_STATUSES)[number])) {
          throw conflict("Temporary worker is not awaiting CEO or board resume");
        }

        const department = await getDepartment(tx, worker.departmentId);
        if (!department) throw notFound("Department not found");
        if (department.status !== "active" || !department.ministerAgentId) {
          throw unprocessable("Department must be active with a minister before a temporary worker can resume");
        }
        const issue = await getSourceIssue(tx, worker.sourceIssueId);
        if (!issue) {
          throw notFound("Issue not found");
        }
        if (issue.companyId !== worker.companyId) {
          throw unprocessable("Temporary worker source issue must belong to the same company");
        }
        if (issue.owningDepartmentId !== worker.departmentId || issue.departmentIntakeStatus !== "accepted") {
          throw unprocessable("Temporary worker source issue must still belong to the department and be accepted");
        }
        if (worker.ttlExpiresAt.getTime() <= Date.now()) {
          throw unprocessable("Extend the temporary worker TTL before resuming it");
        }

        return tx
          .update(temporaryWorkers)
          .set({
            status: "active",
            ownerMinisterAgentId: department.ministerAgentId,
            statusReason: null,
            resumeRequestedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(temporaryWorkers.id, workerId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    terminate: async (workerId: string, reason?: string | null) =>
      db.transaction(async (tx) => {
        const worker = await getWorker(tx, workerId);
        if (!worker) throw notFound("Temporary worker not found");
        if (worker.status === "terminated") return worker;
        return tx
          .update(temporaryWorkers)
          .set({
            status: "terminated",
            statusReason: reason?.trim() || "terminated",
            terminatedAt: new Date(),
            resumeRequestedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(temporaryWorkers.id, workerId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    extendTtl: async (workerId: string, ttlMinutes: number) =>
      db.transaction(async (tx) => {
        const worker = await getWorker(tx, workerId);
        if (!worker) throw notFound("Temporary worker not found");
        ensureWorkerWritableStatus(worker.status);
        return tx
          .update(temporaryWorkers)
          .set({
            ttlExpiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(temporaryWorkers.id, workerId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    reconcileExpired: async (companyId: string, asOf = new Date()) =>
      db.transaction(async (tx) => {
        const expired = await tx
          .select()
          .from(temporaryWorkers)
          .where(
            and(
              eq(temporaryWorkers.companyId, companyId),
              lte(temporaryWorkers.ttlExpiresAt, asOf),
              inArray(temporaryWorkers.status, TTL_PENDING_STATUSES as unknown as string[]),
            ),
          );

        const reconciled: typeof temporaryWorkers.$inferSelect[] = [];
        for (const worker of expired) {
          const department = await getDepartment(tx, worker.departmentId);
          const nextStatus: TemporaryWorkerStatus =
            department?.status === "active" && department.ministerAgentId === worker.ownerMinisterAgentId
              ? "ttl_expired_pending_minister"
              : "ttl_expired_pending_ceo_or_board";
          const updated = await tx
            .update(temporaryWorkers)
            .set({
              status: nextStatus,
              statusReason: "ttl_expired",
              updatedAt: new Date(),
            })
            .where(eq(temporaryWorkers.id, worker.id))
            .returning()
            .then((rows) => rows[0] ?? null);
          if (updated) reconciled.push(updated);
        }

        return reconciled;
      }),
  };
}
