export const REQUIRED_SYSTEM_PLUGIN_KEYS = [
  "paperclip.execution-improvement",
  "paperclip.skills-system",
] as const;
export type RequiredSystemPluginKey = (typeof REQUIRED_SYSTEM_PLUGIN_KEYS)[number];

export const SYSTEM_PLUGIN_ROLLOUT_KINDS = ["restart_path"] as const;
export type SystemPluginRolloutKind = (typeof SYSTEM_PLUGIN_ROLLOUT_KINDS)[number];

export const SYSTEM_PLUGIN_ROLLOUT_STATUSES = [
  "pending_approval",
  "approved",
  "rejected",
  "executing",
  "succeeded",
  "failed",
] as const;
export type SystemPluginRolloutStatus = (typeof SYSTEM_PLUGIN_ROLLOUT_STATUSES)[number];

export const SYSTEM_PLUGIN_ROLLOUT_APPROVAL_DECISIONS = [
  "approved",
  "rejected",
] as const;
export type SystemPluginRolloutApprovalDecision =
  (typeof SYSTEM_PLUGIN_ROLLOUT_APPROVAL_DECISIONS)[number];

export const SYSTEM_PLUGIN_ROLLOUT_COMMAND_KINDS = [
  "restart_worker",
  "restore_then_restart_worker",
] as const;
export type SystemPluginRolloutCommandKind =
  (typeof SYSTEM_PLUGIN_ROLLOUT_COMMAND_KINDS)[number];
