import { heartbeatRuns } from "@paperclipai/db";
import { parseObject } from "../../adapters/utils.js";
import { HEARTBEAT_TASK_KEY, readNonEmptyString } from "./shared.js";

function deriveTaskKey(
  contextSnapshot: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown> | null | undefined,
) {
  return (
    readNonEmptyString(contextSnapshot?.taskKey) ??
    readNonEmptyString(contextSnapshot?.taskId) ??
    readNonEmptyString(contextSnapshot?.issueId) ??
    readNonEmptyString(payload?.taskKey) ??
    readNonEmptyString(payload?.taskId) ??
    readNonEmptyString(payload?.issueId) ??
    null
  );
}

export function deriveTaskKeyWithHeartbeatFallback(
  contextSnapshot: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown> | null | undefined,
) {
  const explicit = deriveTaskKey(contextSnapshot, payload);
  if (explicit) return explicit;

  const wakeSource = readNonEmptyString(contextSnapshot?.wakeSource);
  if (wakeSource === "timer") return HEARTBEAT_TASK_KEY;

  return null;
}

export function shouldResetTaskSessionForWake(
  contextSnapshot: Record<string, unknown> | null | undefined,
) {
  if (contextSnapshot?.forceFreshSession === true) return true;
  return false;
}

export function describeSessionResetReason(
  contextSnapshot: Record<string, unknown> | null | undefined,
) {
  if (contextSnapshot?.forceFreshSession === true) return "forceFreshSession was requested";
  return null;
}

export function deriveCommentId(
  contextSnapshot: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown> | null | undefined,
) {
  return (
    readNonEmptyString(contextSnapshot?.wakeCommentId) ??
    readNonEmptyString(contextSnapshot?.commentId) ??
    readNonEmptyString(payload?.commentId) ??
    null
  );
}

export function enrichWakeContextSnapshot(input: {
  contextSnapshot: Record<string, unknown>;
  reason: string | null;
  source: "timer" | "assignment" | "on_demand" | "automation" | undefined;
  triggerDetail: "manual" | "ping" | "callback" | "system" | null;
  payload: Record<string, unknown> | null;
}) {
  const { contextSnapshot, reason, source, triggerDetail, payload } = input;
  const issueIdFromPayload = readNonEmptyString(payload?.issueId);
  const commentIdFromPayload = readNonEmptyString(payload?.commentId);
  const taskKey = deriveTaskKey(contextSnapshot, payload);
  const wakeCommentId = deriveCommentId(contextSnapshot, payload);

  if (!readNonEmptyString(contextSnapshot.wakeReason) && reason) {
    contextSnapshot.wakeReason = reason;
  }
  if (!readNonEmptyString(contextSnapshot.issueId) && issueIdFromPayload) {
    contextSnapshot.issueId = issueIdFromPayload;
  }
  if (!readNonEmptyString(contextSnapshot.taskId) && issueIdFromPayload) {
    contextSnapshot.taskId = issueIdFromPayload;
  }
  if (!readNonEmptyString(contextSnapshot.taskKey) && taskKey) {
    contextSnapshot.taskKey = taskKey;
  }
  if (!readNonEmptyString(contextSnapshot.commentId) && commentIdFromPayload) {
    contextSnapshot.commentId = commentIdFromPayload;
  }
  if (!readNonEmptyString(contextSnapshot.wakeCommentId) && wakeCommentId) {
    contextSnapshot.wakeCommentId = wakeCommentId;
  }
  if (!readNonEmptyString(contextSnapshot.wakeSource) && source) {
    contextSnapshot.wakeSource = source;
  }
  if (!readNonEmptyString(contextSnapshot.wakeTriggerDetail) && triggerDetail) {
    contextSnapshot.wakeTriggerDetail = triggerDetail;
  }
  return {
    contextSnapshot,
    issueIdFromPayload,
    commentIdFromPayload,
    taskKey,
    wakeCommentId,
  };
}

export function mergeCoalescedContextSnapshot(
  existingRaw: unknown,
  incoming: Record<string, unknown>,
) {
  const existing = parseObject(existingRaw);
  const merged: Record<string, unknown> = {
    ...existing,
    ...incoming,
  };
  const commentId = deriveCommentId(incoming, null);
  if (commentId) {
    merged.commentId = commentId;
    merged.wakeCommentId = commentId;
  }
  return merged;
}

export function runTaskKey(run: typeof heartbeatRuns.$inferSelect) {
  return deriveTaskKey(run.contextSnapshot as Record<string, unknown> | null, null);
}

export function isSameTaskScope(left: string | null, right: string | null) {
  if (!left && !right) return true;
  return left === right;
}
