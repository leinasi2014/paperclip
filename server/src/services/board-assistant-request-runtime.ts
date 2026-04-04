import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  boardAssistantBindingSessions,
  boardAssistantBindings,
  boardAssistantRequestTargets,
  boardAssistantRequests,
  boardAssistantThreads,
  issues,
} from "@paperclipai/db";
import type { BoardAssistantChannelKind } from "@paperclipai/shared";
import { badRequest, notFound } from "../errors.js";
import {
  ACTIVE_BINDING_SESSION_STATUSES,
  ACTIVE_REQUEST_STATUSES,
} from "./board-assistant-helpers.js";
import {
  getOrCreateExternalBoardAssistantThread,
  sendBoardAssistantFounderPrompt,
} from "./board-assistant-runtime.js";
import { queueIssueAssignmentWakeup, type IssueAssignmentWakeupDeps } from "./issue-assignment-wakeup.js";

type SettingsLike = {
  getBoardAssistant: () => Promise<{
    allowProactiveBriefing: boolean;
  }>;
};

type CompaniesLike = {
  create: (data: { name: string; description: string | null; budgetMonthlyCents: number }) => Promise<{ id: string; name: string }>;
  remove: (companyId: string) => Promise<unknown>;
  getEffectiveCeoAgentId: (companyId: string) => Promise<string | null>;
};

type AccessLike = {
  ensureMembership: (
    companyId: string,
    principalType: "user",
    principalId: string,
    membershipRole: string | null,
    status: "pending" | "active" | "suspended",
  ) => Promise<unknown>;
};

type SystemProjectsLike = {
  ensureCanonical: (companyId: string) => Promise<{ id: string }>;
};

export function createBoardAssistantRequestRuntime(input: {
  db: Db;
  settings: SettingsLike;
  companiesSvc: CompaniesLike;
  access: AccessLike;
  systemProjects: SystemProjectsLike;
  heartbeat: IssueAssignmentWakeupDeps;
  appendInternalAuditForCompany: (companyId: string, content: string) => Promise<unknown>;
}) {
  const { db, settings, companiesSvc, access, systemProjects, heartbeat, appendInternalAuditForCompany } = input;

  async function cancelPendingBindingSessions(
    channel: BoardAssistantChannelKind,
    nextStatus: "cancelled" | "revoked",
  ) {
    await db
      .update(boardAssistantBindingSessions)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(and(
        eq(boardAssistantBindingSessions.channel, channel),
        inArray(boardAssistantBindingSessions.status, [...ACTIVE_BINDING_SESSION_STATUSES]),
      ));
  }

  async function getLatestBindingSession(channel: BoardAssistantChannelKind) {
    return db
      .select()
      .from(boardAssistantBindingSessions)
      .where(and(
        eq(boardAssistantBindingSessions.channel, channel),
        inArray(boardAssistantBindingSessions.status, ["pending_channel_handshake", "pending_web_confirm", "active"]),
      ))
      .orderBy(desc(boardAssistantBindingSessions.updatedAt), desc(boardAssistantBindingSessions.createdAt))
      .then((rows) => rows[0] ?? null);
  }

  async function createCompanyWithBootstrap(name: string, actorUserId: string) {
    let companyId: string | null = null;
    try {
      const company = await companiesSvc.create({ name, description: null, budgetMonthlyCents: 0 });
      companyId = company.id;
      await systemProjects.ensureCanonical(company.id);
      await access.ensureMembership(company.id, "user", actorUserId, "owner", "active");
      return company;
    } catch (error) {
      if (companyId) {
        await companiesSvc.remove(companyId).catch(() => undefined);
      }
      throw error;
    }
  }

  async function reconcileCompanyTargetState(target: typeof boardAssistantRequestTargets.$inferSelect) {
    if (!target.issueId) return target;
    const issue = await db
      .select({
        id: issues.id,
        identifier: issues.identifier,
        status: issues.status,
        checkoutRunId: issues.checkoutRunId,
        assigneeAgentId: issues.assigneeAgentId,
        createdAt: issues.createdAt,
      })
      .from(issues)
      .where(eq(issues.id, target.issueId))
      .then((rows) => rows[0] ?? null);
    if (!issue) return target;

    let nextStatus = target.status;
    let nextBlockedReason = target.blockedReason;
    if (issue.status === "done") {
      nextStatus = "done";
      nextBlockedReason = null;
    } else if (issue.status === "in_progress" || issue.checkoutRunId) {
      nextStatus = "executing";
      nextBlockedReason = null;
    } else if (!issue.assigneeAgentId) {
      nextStatus = "blocked";
      nextBlockedReason = "ceo_not_claimed";
    } else if (
      ["backlog", "todo"].includes(issue.status)
      && Date.now() - issue.createdAt.getTime() >= 5 * 60 * 1000
    ) {
      nextStatus = "blocked";
      nextBlockedReason = "ceo_not_claimed";
    } else {
      nextStatus = "routed";
      nextBlockedReason = null;
    }

    if (nextStatus === target.status && nextBlockedReason === target.blockedReason) {
      return target;
    }
    return db
      .update(boardAssistantRequestTargets)
      .set({
        status: nextStatus,
        blockedReason: nextBlockedReason,
        summary: `CEO issue ${issue.identifier}`,
        updatedAt: new Date(),
      })
      .where(eq(boardAssistantRequestTargets.id, target.id))
      .returning()
      .then((rows) => rows[0] ?? target);
  }

  async function reconcileRequestFromTargets(requestId: string) {
    const request = await db
      .select()
      .from(boardAssistantRequests)
      .where(eq(boardAssistantRequests.id, requestId))
      .then((rows) => rows[0] ?? null);
    if (!request) return null;

    const rawTargets = await db
      .select()
      .from(boardAssistantRequestTargets)
      .where(eq(boardAssistantRequestTargets.requestId, requestId))
      .orderBy(asc(boardAssistantRequestTargets.createdAt));
    if (rawTargets.length === 0) return request;

    const targets = await Promise.all(rawTargets.map((target) => (
      target.targetKind === "company" ? reconcileCompanyTargetState(target) : Promise.resolve(target)
    )));

    let status = request.status;
    let blockedReason = request.blockedReason;
    if (targets.every((target) => target.status === "done")) {
      status = "done";
      blockedReason = null;
    } else if (targets.some((target) => target.status === "executing")) {
      status = "executing";
      blockedReason = null;
    } else if (targets.some((target) => target.status === "blocked")) {
      status = "blocked";
      blockedReason = targets.find((target) => target.status === "blocked")?.blockedReason ?? null;
    } else if (targets.some((target) => target.status === "routed")) {
      status = "routed";
      blockedReason = null;
    } else if (targets.some((target) => target.status === "queued")) {
      status = "queued";
      blockedReason = null;
    } else if (targets.every((target) => target.status === "cancelled")) {
      status = "cancelled";
      blockedReason = null;
    } else if (targets.some((target) => target.status === "failed")) {
      status = "failed";
      blockedReason = null;
    }

    if (status === request.status && blockedReason === request.blockedReason) {
      return request;
    }
    return db
      .update(boardAssistantRequests)
      .set({ status, blockedReason, updatedAt: new Date() })
      .where(eq(boardAssistantRequests.id, request.id))
      .returning()
      .then((rows) => rows[0] ?? request);
  }

  async function rewakeRequestTarget(targetId: string, actorUserId: string) {
    const target = await db
      .select()
      .from(boardAssistantRequestTargets)
      .where(eq(boardAssistantRequestTargets.id, targetId))
      .then((rows) => rows[0] ?? null);
    if (!target) throw notFound("Request target not found");
    if (target.targetKind !== "company" || !target.issueId) {
      throw badRequest("Only company targets with an issue can be re-woken");
    }
    const request = await db
      .select()
      .from(boardAssistantRequests)
      .where(eq(boardAssistantRequests.id, target.requestId))
      .then((rows) => rows[0] ?? null);
    if (!request) throw notFound("Request not found");

    const ceoAgentId = await companiesSvc.getEffectiveCeoAgentId(target.targetRef);
    if (!ceoAgentId) {
      const blockedTarget = await db
        .update(boardAssistantRequestTargets)
        .set({ status: "blocked", blockedReason: "ceo_not_claimed", updatedAt: new Date() })
        .where(eq(boardAssistantRequestTargets.id, target.id))
        .returning()
        .then((rows) => rows[0] ?? target);
      await reconcileRequestFromTargets(target.requestId);
      return blockedTarget;
    }

    const issue = await db
      .update(issues)
      .set({ assigneeAgentId: ceoAgentId, updatedAt: new Date() })
      .where(eq(issues.id, target.issueId))
      .returning()
      .then((rows) => rows[0] ?? null);
    if (!issue) throw notFound("Issue not found for request target");
    await queueIssueAssignmentWakeup({
      heartbeat,
      issue,
      reason: "board-assistant-rewake-target",
      mutation: "board_assistant.target_rewake",
      contextSource: "board_assistant",
      requestedByActorType: "user",
      requestedByActorId: actorUserId,
    });
    const updatedTarget = await db
      .update(boardAssistantRequestTargets)
      .set({ status: "routed", blockedReason: null, updatedAt: new Date() })
      .where(eq(boardAssistantRequestTargets.id, target.id))
      .returning()
      .then((rows) => rows[0] ?? target);
    await appendInternalAuditForCompany(target.targetRef, "Board Assistant 已重新唤醒 CEO。");

    const cfg = await settings.getBoardAssistant();
    if (cfg.allowProactiveBriefing && request.bindingId) {
      const binding = await db
        .select()
        .from(boardAssistantBindings)
        .where(eq(boardAssistantBindings.id, request.bindingId))
        .then((rows) => rows[0] ?? null);
      if (binding && binding.status === "active") {
        const thread = await getOrCreateExternalBoardAssistantThread(db, {
          channel: binding.channel,
          bindingId: binding.id,
          externalThreadId: binding.externalThreadId ?? request.externalThreadId,
        });
        await sendBoardAssistantFounderPrompt(db, {
          binding,
          thread,
          text: "已重新唤醒目标公司的 CEO 跟进这条任务。",
          checkpointKind: "target-rewake",
          payload: { requestId: request.id, targetId: target.id },
        });
      }
    }
    await reconcileRequestFromTargets(target.requestId);
    return updatedTarget;
  }

  async function cancelRequestTarget(targetId: string) {
    const target = await db
      .select()
      .from(boardAssistantRequestTargets)
      .where(eq(boardAssistantRequestTargets.id, targetId))
      .then((rows) => rows[0] ?? null);
    if (!target) throw notFound("Request target not found");
    const updatedTarget = await db
      .update(boardAssistantRequestTargets)
      .set({ status: "cancelled", blockedReason: null, updatedAt: new Date() })
      .where(eq(boardAssistantRequestTargets.id, target.id))
      .returning()
      .then((rows) => rows[0] ?? target);
    await reconcileRequestFromTargets(target.requestId);
    if (target.targetKind === "company") {
      await appendInternalAuditForCompany(target.targetRef, "Board Assistant 已取消该阻塞目标。");
    }
    return updatedTarget;
  }

  return {
    cancelPendingBindingSessions,
    getLatestBindingSession,
    createCompanyWithBootstrap,
    reconcileRequestFromTargets,
    rewakeRequestTarget,
    cancelRequestTarget,
  };
}
