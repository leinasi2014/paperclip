export const BOARD_ASSISTANT_CHANNEL_KINDS = ["wechat"] as const;
export type BoardAssistantChannelKind = (typeof BOARD_ASSISTANT_CHANNEL_KINDS)[number];

export const BOARD_ASSISTANT_BINDING_SESSION_STATUSES = [
  "pending_channel_handshake",
  "pending_web_confirm",
  "active",
  "expired",
  "cancelled",
  "revoked",
] as const;
export type BoardAssistantBindingSessionStatus = (typeof BOARD_ASSISTANT_BINDING_SESSION_STATUSES)[number];

export const BOARD_ASSISTANT_ONBOARDING_SESSION_STATUSES = [
  "active",
  "completed",
  "expired",
  "cancelled",
] as const;
export type BoardAssistantOnboardingSessionStatus = (typeof BOARD_ASSISTANT_ONBOARDING_SESSION_STATUSES)[number];

export const BOARD_ASSISTANT_THREAD_KINDS = ["external", "internal"] as const;
export type BoardAssistantThreadKind = (typeof BOARD_ASSISTANT_THREAD_KINDS)[number];

export const BOARD_ASSISTANT_THREAD_MODES = ["observe", "joint_speaking", "takeover"] as const;
export type BoardAssistantThreadMode = (typeof BOARD_ASSISTANT_THREAD_MODES)[number];

export const BOARD_ASSISTANT_THREAD_MESSAGE_AUTHOR_KINDS = [
  "assistant",
  "founder",
  "employee",
  "ceo",
  "system",
] as const;
export type BoardAssistantThreadMessageAuthorKind =
  (typeof BOARD_ASSISTANT_THREAD_MESSAGE_AUTHOR_KINDS)[number];

export const BOARD_ASSISTANT_THREAD_MESSAGE_DIRECTIONS = ["inbound", "outbound", "internal"] as const;
export type BoardAssistantThreadMessageDirection =
  (typeof BOARD_ASSISTANT_THREAD_MESSAGE_DIRECTIONS)[number];

export const BOARD_ASSISTANT_REQUEST_STATUSES = [
  "received",
  "clarifying",
  "proposed",
  "confirmed",
  "queued",
  "routed",
  "executing",
  "blocked",
  "cancelled",
  "expired",
  "done",
  "failed",
] as const;
export type BoardAssistantRequestStatus = (typeof BOARD_ASSISTANT_REQUEST_STATUSES)[number];

export const BOARD_ASSISTANT_TARGET_STATUSES = [
  "queued",
  "routed",
  "executing",
  "blocked",
  "done",
  "failed",
  "cancelled",
] as const;
export type BoardAssistantTargetStatus = (typeof BOARD_ASSISTANT_TARGET_STATUSES)[number];

export const BOARD_ASSISTANT_OUTBOX_STATUSES = ["pending", "sending", "sent", "failed"] as const;
export type BoardAssistantOutboxStatus = (typeof BOARD_ASSISTANT_OUTBOX_STATUSES)[number];

export const BOARD_ASSISTANT_TARGET_KINDS = ["company", "instance"] as const;
export type BoardAssistantTargetKind = (typeof BOARD_ASSISTANT_TARGET_KINDS)[number];

export const BOARD_ASSISTANT_BUNDLE_KINDS = ["soul", "agents", "heartbeat", "tools"] as const;
export type BoardAssistantBundleKind = (typeof BOARD_ASSISTANT_BUNDLE_KINDS)[number];

export const BOARD_ASSISTANT_MEMORY_KINDS = [
  "persona",
  "preference",
  "relationship",
  "working",
  "skill",
  "audited_action",
] as const;
export type BoardAssistantMemoryKind = (typeof BOARD_ASSISTANT_MEMORY_KINDS)[number];

export const BOARD_ASSISTANT_MEMORY_VISIBILITY_POLICIES = [
  "private_only",
  "founder_reviewable",
  "audited_only",
] as const;
export type BoardAssistantMemoryVisibilityPolicy = (typeof BOARD_ASSISTANT_MEMORY_VISIBILITY_POLICIES)[number];

export const BOARD_ASSISTANT_MEMORY_STATUSES = ["active", "suppressed", "deleted"] as const;
export type BoardAssistantMemoryStatus = (typeof BOARD_ASSISTANT_MEMORY_STATUSES)[number];

export const BOARD_ASSISTANT_MEMORY_PROPOSAL_STATUSES = ["pending", "approved", "rejected", "expired"] as const;
export type BoardAssistantMemoryProposalStatus = (typeof BOARD_ASSISTANT_MEMORY_PROPOSAL_STATUSES)[number];

export const BOARD_ASSISTANT_BLOCKED_REASONS = [
  "ceo_not_claimed",
  "active_runs_present",
  "assistant_unavailable",
  "awaiting_founder_confirmation",
] as const;
export type BoardAssistantBlockedReason = (typeof BOARD_ASSISTANT_BLOCKED_REASONS)[number];

export const BOARD_ASSISTANT_INSTANCE_ACTIONS = ["create_company", "delete_company"] as const;
export type BoardAssistantInstanceAction = (typeof BOARD_ASSISTANT_INSTANCE_ACTIONS)[number];

export const BOARD_ASSISTANT_AUTO_EXECUTION_MODES = [
  "manual_confirm",
  "low_risk_auto",
  "enhanced_auto",
] as const;
export type BoardAssistantAutoExecutionMode = (typeof BOARD_ASSISTANT_AUTO_EXECUTION_MODES)[number];
