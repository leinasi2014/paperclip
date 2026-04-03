import { z } from "zod";
import {
  DEFAULT_MAX_CONCURRENT_TEMPORARY_WORKERS,
  DEFAULT_TEMPORARY_WORKER_TTL_MINUTES,
  DEPARTMENT_BUDGET_STATUSES,
  DEPARTMENT_STATUSES,
  TEMPORARY_WORKER_STATUSES,
} from "../constants/department.js";

const departmentSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Department slug must be lowercase letters, numbers, _ or -");

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: departmentSlugSchema,
  mission: z.string().trim().max(500).nullable().optional(),
  ministerAgentId: z.string().uuid().nullable().optional(),
  maxConcurrentTemporaryWorkers: z.number().int().nonnegative().optional()
    .default(DEFAULT_MAX_CONCURRENT_TEMPORARY_WORKERS),
  temporaryWorkerTtlMinutes: z.number().int().positive().max(60 * 24 * 30).optional()
    .default(DEFAULT_TEMPORARY_WORKER_TTL_MINUTES),
});

export type CreateDepartment = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: departmentSlugSchema.optional(),
    mission: z.string().trim().max(500).nullable().optional(),
    maxConcurrentTemporaryWorkers: z.number().int().nonnegative().optional(),
    temporaryWorkerTtlMinutes: z.number().int().positive().max(60 * 24 * 30).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;

export const assignDepartmentMinisterSchema = z.object({
  agentId: z.string().uuid(),
});

export type AssignDepartmentMinister = z.infer<typeof assignDepartmentMinisterSchema>;

export const removeDepartmentMinisterSchema = z.object({});

export type RemoveDepartmentMinister = z.infer<typeof removeDepartmentMinisterSchema>;

export const freezeDepartmentSchema = z.object({
  status: z.enum(DEPARTMENT_STATUSES).refine((value) => value !== "active", {
    message: "Freeze status must not be active",
  }),
});

export type FreezeDepartment = z.infer<typeof freezeDepartmentSchema>;

export const unfreezeDepartmentSchema = z.object({});

export type UnfreezeDepartment = z.infer<typeof unfreezeDepartmentSchema>;

export const allocateDepartmentBudgetSchema = z.object({
  monthlyLimitCents: z.number().int().nonnegative(),
  status: z.enum(DEPARTMENT_BUDGET_STATUSES).optional(),
});

export type AllocateDepartmentBudget = z.infer<typeof allocateDepartmentBudgetSchema>;

export const createTemporaryWorkerSchema = z.object({
  sourceIssueId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  ttlMinutes: z.number().int().positive().max(60 * 24 * 30).optional(),
});

export type CreateTemporaryWorker = z.infer<typeof createTemporaryWorkerSchema>;

export const updateTemporaryWorkerPauseSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type UpdateTemporaryWorkerPause = z.infer<typeof updateTemporaryWorkerPauseSchema>;

export const extendTemporaryWorkerTtlSchema = z.object({
  ttlMinutes: z.number().int().positive().max(60 * 24 * 30),
});

export type ExtendTemporaryWorkerTtl = z.infer<typeof extendTemporaryWorkerTtlSchema>;

export const requestTemporaryWorkerResumeSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type RequestTemporaryWorkerResume = z.infer<typeof requestTemporaryWorkerResumeSchema>;

export const approveTemporaryWorkerResumeSchema = z.object({});

export type ApproveTemporaryWorkerResume = z.infer<typeof approveTemporaryWorkerResumeSchema>;

export const terminateTemporaryWorkerSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type TerminateTemporaryWorker = z.infer<typeof terminateTemporaryWorkerSchema>;

export const reconcileTemporaryWorkerTtlSchema = z.object({
  asOf: z.coerce.date().optional(),
});

export type ReconcileTemporaryWorkerTtl = z.infer<typeof reconcileTemporaryWorkerTtlSchema>;

export const temporaryWorkerStatusSchema = z.enum(TEMPORARY_WORKER_STATUSES);

export type TemporaryWorkerStatusInput = z.infer<typeof temporaryWorkerStatusSchema>;
