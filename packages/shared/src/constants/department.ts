export const DEPARTMENT_STATUSES = [
  "active",
  "frozen_unstaffed",
  "frozen_suspended",
] as const;
export type DepartmentStatus = (typeof DEPARTMENT_STATUSES)[number];

export const DEPARTMENT_BUDGET_STATUSES = [
  "allocated",
  "reserved_only",
  "active",
] as const;
export type DepartmentBudgetStatus = (typeof DEPARTMENT_BUDGET_STATUSES)[number];

export const SYSTEM_ISSUE_TYPES = [
  "execution",
  "skill",
  "governance",
] as const;
export type SystemIssueType = (typeof SYSTEM_ISSUE_TYPES)[number];

export const SYSTEM_ISSUE_WORKFLOW_STATES = [
  "open",
  "triaging",
  "in_progress",
  "pending_review",
  "review_passed",
  "ready_to_resume",
  "done",
] as const;
export type SystemIssueWorkflowState = (typeof SYSTEM_ISSUE_WORKFLOW_STATES)[number];

export const SYSTEM_ISSUE_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;
export type SystemIssueSeverity = (typeof SYSTEM_ISSUE_SEVERITIES)[number];

export const SYSTEM_PROJECT_KINDS = ["execution_governance"] as const;
export type SystemProjectKind = (typeof SYSTEM_PROJECT_KINDS)[number];

export const MINISTER_INTAKE_RESPONSES = [
  "accept",
  "reject",
  "needs_clarification",
] as const;
export type MinisterIntakeResponse = (typeof MINISTER_INTAKE_RESPONSES)[number];

export const DEPARTMENT_INTAKE_STATUSES = [
  "ceo_intake",
  "routed",
  "accepted",
  "rejected",
  "needs_clarification",
] as const;
export type DepartmentIntakeStatus = (typeof DEPARTMENT_INTAKE_STATUSES)[number];

export const MINISTER_HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;

export const DEFAULT_MAX_CONCURRENT_TEMPORARY_WORKERS = 0;

export const TEMPORARY_WORKER_STATUSES = [
  "active",
  "paused_due_to_department_freeze",
  "paused_pending_ceo_resume",
  "ttl_expired_pending_minister",
  "ttl_expired_pending_ceo_or_board",
  "terminated",
] as const;
export type TemporaryWorkerStatus = (typeof TEMPORARY_WORKER_STATUSES)[number];

export const DEFAULT_TEMPORARY_WORKER_TTL_MINUTES = 8 * 60;
