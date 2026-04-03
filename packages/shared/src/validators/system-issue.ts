import { z } from "zod";
import {
  ISSUE_PRIORITIES,
  SYSTEM_ISSUE_SEVERITIES,
  SYSTEM_ISSUE_TYPES,
  SYSTEM_ISSUE_WORKFLOW_STATES,
} from "../constants.js";

export const createSystemIssueSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(ISSUE_PRIORITIES).optional().default("medium"),
  systemIssueType: z.enum(SYSTEM_ISSUE_TYPES),
  systemIssueSeverity: z.enum(SYSTEM_ISSUE_SEVERITIES),
  blockRecommended: z.boolean().optional().default(false),
}).strict();

export type CreateSystemIssue = z.infer<typeof createSystemIssueSchema>;

export const updateSystemIssueSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
  systemIssueType: z.enum(SYSTEM_ISSUE_TYPES).optional(),
  systemIssueSeverity: z.enum(SYSTEM_ISSUE_SEVERITIES).optional(),
}).strict();

export type UpdateSystemIssue = z.infer<typeof updateSystemIssueSchema>;

export const routeSystemIssueSchema = z.object({
  owningDepartmentId: z.string().uuid().nullable(),
});

export type RouteSystemIssue = z.infer<typeof routeSystemIssueSchema>;

export const setSystemIssueBlockRecommendationSchema = z.object({
  blockRecommended: z.boolean(),
});

export type SetSystemIssueBlockRecommendation = z.infer<typeof setSystemIssueBlockRecommendationSchema>;

export const startSystemIssueTriageSchema = z.object({});
export type StartSystemIssueTriage = z.infer<typeof startSystemIssueTriageSchema>;

const systemIssueNotesSchema = z.string().trim().max(4000).nullable().optional();

export const requestSystemIssueReviewSchema = z.object({
  notes: systemIssueNotesSchema,
});
export type RequestSystemIssueReview = z.infer<typeof requestSystemIssueReviewSchema>;

export const reviewSystemIssueSchema = z.object({
  approved: z.boolean(),
  notes: systemIssueNotesSchema,
});
export type ReviewSystemIssue = z.infer<typeof reviewSystemIssueSchema>;

export const requestSystemIssueResumeSchema = z.object({
  notes: systemIssueNotesSchema,
});
export type RequestSystemIssueResume = z.infer<typeof requestSystemIssueResumeSchema>;

export const approveSystemIssueResumeSchema = z.object({
  notes: systemIssueNotesSchema,
});
export type ApproveSystemIssueResume = z.infer<typeof approveSystemIssueResumeSchema>;

export const closeSystemIssueSchema = z.object({
  notes: systemIssueNotesSchema,
});
export type CloseSystemIssue = z.infer<typeof closeSystemIssueSchema>;

export const listSystemIssuesQuerySchema = z.object({
  type: z.enum(SYSTEM_ISSUE_TYPES).optional(),
  severity: z.enum(SYSTEM_ISSUE_SEVERITIES).optional(),
  workflowState: z.enum(SYSTEM_ISSUE_WORKFLOW_STATES).optional(),
  owningDepartmentId: z.string().uuid().optional(),
  inCeoIntake: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === "boolean") return value;
      return value === "true";
    }),
  blockRecommended: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === "boolean") return value;
      return value === "true";
    }),
});

export type ListSystemIssuesQuery = z.infer<typeof listSystemIssuesQuerySchema>;
