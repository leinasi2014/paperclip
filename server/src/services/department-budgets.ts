import { eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { departmentBudgetEnvelopes, departments } from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";

type DepartmentBudgetReader = Pick<Db, "select">;

async function getEnvelope(db: DepartmentBudgetReader, departmentId: string) {
  return db
    .select()
    .from(departmentBudgetEnvelopes)
    .where(eq(departmentBudgetEnvelopes.departmentId, departmentId))
    .then((rows) => rows[0] ?? null);
}

export function departmentBudgetService(db: Db) {
  return {
    getByDepartmentId: (departmentId: string) => getEnvelope(db, departmentId),

    allocate: async (
      departmentId: string,
      input: {
        monthlyLimitCents: number;
        status?: "allocated" | "reserved_only" | "active";
      },
    ) =>
      db.transaction(async (tx) => {
        const department = await tx
          .select()
          .from(departments)
          .where(eq(departments.id, departmentId))
          .then((rows) => rows[0] ?? null);
        if (!department) throw notFound("Department not found");

        const nextStatus = input.status
          ?? (department.status === "active" ? "active" : "reserved_only");

        const existing = await getEnvelope(tx, departmentId);
        if (!existing) {
          return tx
            .insert(departmentBudgetEnvelopes)
            .values({
              departmentId,
              companyId: department.companyId,
              monthlyLimitCents: input.monthlyLimitCents,
              status: nextStatus,
            })
            .returning()
            .then((rows) => rows[0] ?? null);
        }

        return tx
          .update(departmentBudgetEnvelopes)
          .set({
            monthlyLimitCents: input.monthlyLimitCents,
            status: nextStatus,
            updatedAt: new Date(),
          })
          .where(eq(departmentBudgetEnvelopes.departmentId, departmentId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    activate: async (departmentId: string) =>
      db
        .update(departmentBudgetEnvelopes)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(departmentBudgetEnvelopes.departmentId, departmentId))
        .returning()
        .then((rows) => rows[0] ?? null),

    reserve: async (departmentId: string, amountCents: number) =>
      db.transaction(async (tx) => {
        const envelope = await getEnvelope(tx, departmentId);
        if (!envelope) throw notFound("Department budget envelope not found");
        if (amountCents < 0) throw unprocessable("Reservation amount must be non-negative");
        if (envelope.status !== "active") {
          throw unprocessable("Department budget envelope is not active");
        }
        const nextReserved = envelope.reservedCents + amountCents;
        if (envelope.spentCents + nextReserved > envelope.monthlyLimitCents) {
          throw unprocessable("Department budget envelope exceeded");
        }
        return tx
          .update(departmentBudgetEnvelopes)
          .set({
            reservedCents: nextReserved,
            updatedAt: new Date(),
          })
          .where(eq(departmentBudgetEnvelopes.departmentId, departmentId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    release: async (departmentId: string, amountCents: number) =>
      db.transaction(async (tx) => {
        const envelope = await getEnvelope(tx, departmentId);
        if (!envelope) throw notFound("Department budget envelope not found");
        if (amountCents < 0) throw unprocessable("Release amount must be non-negative");
        if (amountCents > envelope.reservedCents) {
          throw unprocessable("Cannot release more than reserved amount");
        }
        return tx
          .update(departmentBudgetEnvelopes)
          .set({
            reservedCents: envelope.reservedCents - amountCents,
            updatedAt: new Date(),
          })
          .where(eq(departmentBudgetEnvelopes.departmentId, departmentId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    settle: async (departmentId: string, amountCents: number) =>
      db.transaction(async (tx) => {
        const envelope = await getEnvelope(tx, departmentId);
        if (!envelope) throw notFound("Department budget envelope not found");
        if (amountCents < 0) throw unprocessable("Settlement amount must be non-negative");
        if (amountCents > envelope.reservedCents) {
          throw unprocessable("Cannot settle more than reserved amount");
        }
        return tx
          .update(departmentBudgetEnvelopes)
          .set({
            reservedCents: envelope.reservedCents - amountCents,
            spentCents: envelope.spentCents + amountCents,
            updatedAt: new Date(),
          })
          .where(eq(departmentBudgetEnvelopes.departmentId, departmentId))
          .returning()
          .then((rows) => rows[0] ?? null);
      }),

    resetForDepartmentState: async (
      departmentId: string,
      status: "allocated" | "reserved_only" | "active",
    ) =>
      db
        .update(departmentBudgetEnvelopes)
        .set({ status, updatedAt: new Date() })
        .where(eq(departmentBudgetEnvelopes.departmentId, departmentId))
        .returning()
        .then((rows) => rows[0] ?? null),

    summaryByCompany: async (companyId: string) =>
      db
        .select({
          monthlyLimitCents: sql<number>`coalesce(sum(${departmentBudgetEnvelopes.monthlyLimitCents}), 0)::int`,
          reservedCents: sql<number>`coalesce(sum(${departmentBudgetEnvelopes.reservedCents}), 0)::int`,
          spentCents: sql<number>`coalesce(sum(${departmentBudgetEnvelopes.spentCents}), 0)::int`,
        })
        .from(departmentBudgetEnvelopes)
        .where(eq(departmentBudgetEnvelopes.companyId, companyId))
        .then((rows) => rows[0] ?? { monthlyLimitCents: 0, reservedCents: 0, spentCents: 0 }),
  };
}
