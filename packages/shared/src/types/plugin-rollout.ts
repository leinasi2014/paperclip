import type {
  PluginStatus,
  RequiredSystemPluginKey,
  SystemPluginRolloutApprovalDecision,
  SystemPluginRolloutCommandKind,
  SystemPluginRolloutKind,
  SystemPluginRolloutStatus,
} from "../constants.js";

export interface SystemPluginRolloutCommand {
  kind: SystemPluginRolloutCommandKind;
  strategy: "restart_path_mvp";
  rolloutId: string;
  pluginId: string;
  pluginKey: RequiredSystemPluginKey;
  baseVersion: string;
  candidateVersion: string | null;
  instructions: string;
  metadata: Record<string, unknown>;
}

export interface SystemPluginRolloutApprovalRecord {
  id: string;
  rolloutId: string;
  decision: SystemPluginRolloutApprovalDecision;
  actorUserId: string;
  note: string | null;
  createdAt: Date;
}

export interface SystemPluginRollout {
  id: string;
  pluginId: string;
  pluginKey: RequiredSystemPluginKey;
  pluginPackageName: string;
  pluginStatus: PluginStatus;
  rolloutKind: SystemPluginRolloutKind;
  status: SystemPluginRolloutStatus;
  baseVersion: string;
  candidateVersion: string | null;
  candidateMetadata: Record<string, unknown>;
  note: string | null;
  lastError: string | null;
  requestedByUserId: string;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  executedAt: Date | null;
  completedAt: Date | null;
  restartCommand: SystemPluginRolloutCommand | null;
  rollbackCommand: SystemPluginRolloutCommand | null;
  approvals: SystemPluginRolloutApprovalRecord[];
  createdAt: Date;
  updatedAt: Date;
}
