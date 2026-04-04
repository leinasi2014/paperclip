import type {
  BoardAssistantBindingSessionStatus,
  BoardAssistantBlockedReason,
  BoardAssistantBundleKind,
  BoardAssistantChannelKind,
  BoardAssistantMemoryKind,
  BoardAssistantMemoryProposalStatus,
  BoardAssistantMemoryStatus,
  BoardAssistantMemoryVisibilityPolicy,
  BoardAssistantOnboardingSessionStatus,
  BoardAssistantOutboxStatus,
  BoardAssistantRequestStatus,
  BoardAssistantTargetKind,
  BoardAssistantTargetStatus,
  BoardAssistantThreadKind,
  BoardAssistantThreadMessageAuthorKind,
  BoardAssistantThreadMessageDirection,
  BoardAssistantThreadMode,
  BoardAssistantInstanceAction,
} from "../constants.js";

export interface BoardAssistantBinding {
  id: string;
  channel: BoardAssistantChannelKind;
  externalUserId: string;
  externalThreadId: string | null;
  externalDisplayName: string | null;
  status: "active" | "revoked";
  activatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantBindingSession {
  id: string;
  channel: BoardAssistantChannelKind;
  status: BoardAssistantBindingSessionStatus;
  bindingCode: string;
  expiresAt: Date;
  initiatedBy: string;
  externalUserId: string | null;
  externalThreadId: string | null;
  externalDisplayName: string | null;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantBindingSessionCreateResult {
  session: BoardAssistantBindingSession;
  bindingToken: string;
}

export interface BoardAssistantBindingSessionConfirmResult {
  binding: BoardAssistantBinding;
  onboarding: BoardAssistantOnboardingSession;
}

export interface BoardAssistantThread {
  id: string;
  threadKind: BoardAssistantThreadKind;
  channel: BoardAssistantChannelKind | null;
  externalThreadId: string | null;
  subjectType: string | null;
  subjectId: string | null;
  mode: BoardAssistantThreadMode;
  activeContextSummary: string | null;
  archivedAt: Date | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  setBy: string | null;
  setAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantThreadMessage {
  id: string;
  threadId: string;
  authorKind: BoardAssistantThreadMessageAuthorKind;
  authorRef: string | null;
  direction: BoardAssistantThreadMessageDirection;
  content: string;
  metadata: Record<string, unknown>;
  supersedesMessageId: string | null;
  supersededByMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantOnboardingSession {
  id: string;
  bindingSessionId: string | null;
  externalThreadId: string | null;
  currentStep: number;
  answers: Record<string, unknown>;
  status: BoardAssistantOnboardingSessionStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantRequest {
  id: string;
  channel: BoardAssistantChannelKind;
  externalUserId: string;
  externalThreadId: string;
  externalMessageId: string;
  status: BoardAssistantRequestStatus;
  messageText: string;
  normalizedPayload: Record<string, unknown>;
  intentKind: string | null;
  summary: string | null;
  cardPayload: Record<string, unknown> | null;
  blockedReason: BoardAssistantBlockedReason | null;
  targetKind: BoardAssistantTargetKind | null;
  targetRef: string | null;
  proposedAction: BoardAssistantInstanceAction | null;
  proposedPayload: Record<string, unknown> | null;
  expiresAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantRequestTarget {
  id: string;
  requestId: string;
  targetKind: BoardAssistantTargetKind;
  targetRef: string;
  status: BoardAssistantTargetStatus;
  blockedReason: BoardAssistantBlockedReason | null;
  issueId: string | null;
  instanceAction: BoardAssistantInstanceAction | null;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantOutboxItem {
  id: string;
  requestId: string;
  channel: BoardAssistantChannelKind;
  externalUserId: string;
  externalThreadId: string;
  status: BoardAssistantOutboxStatus;
  checkpointKind: string;
  targetRef: string | null;
  payload: Record<string, unknown>;
  attemptCount: number;
  nextAttemptAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantBundleRevision {
  id: string;
  bundleKind: BoardAssistantBundleKind;
  revisionLabel: string;
  content: string;
  isActive: boolean;
  updatedBy: string;
  changeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantMemory {
  id: string;
  memoryKind: BoardAssistantMemoryKind;
  summary: string;
  sourceRefs: string[];
  confidence: number;
  visibilityPolicy: BoardAssistantMemoryVisibilityPolicy;
  status: BoardAssistantMemoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantMemoryProposal {
  id: string;
  memoryKind: BoardAssistantMemoryKind;
  summary: string;
  sourceRefs: string[];
  confidence: number;
  visibilityPolicy: BoardAssistantMemoryVisibilityPolicy;
  status: BoardAssistantMemoryProposalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardAssistantDestructivePreview {
  riskLevel: "high";
  impactSummary: string;
  activeRunCount: number;
  entityCounts: Record<string, number>;
}

export interface BoardAssistantRequestDetail {
  request: BoardAssistantRequest;
  targets: BoardAssistantRequestTarget[];
  destructivePreview: BoardAssistantDestructivePreview | null;
}
