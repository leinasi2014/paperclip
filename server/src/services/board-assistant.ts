import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  boardAssistantBindings,
  boardAssistantBindingSessions,
  boardAssistantOnboardingSessions,
  boardAssistantOutbox,
  boardAssistantRequests,
  boardAssistantRequestTargets,
  boardAssistantThreads,
} from "@paperclipai/db";
import {
  type BoardAssistantChannelKind,
  type CreateBoardAssistantBindingSession,
  type BoardAssistantIngress,
  type BoardAssistantRequestQuery,
  type ConfirmBoardAssistantRequest,
  type RejectBoardAssistantRequest,
  type PatchBoardAssistantSettings,
  type BoardAssistantOutboxAck,
} from "@paperclipai/shared";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import {
  accessService,
  companyService,
  issueService,
  instanceSettingsService,
  logActivity,
  systemProjectService,
} from "./index.js";
import {
  ACTIVE_BINDING_SESSION_STATUSES,
  ACTIVE_REQUEST_STATUSES,
  TERMINAL_REQUEST_STATUSES,
  addHours,
  addMinutes,
  createDeleteCompanyPreview,
  currentOnboardingKey,
  ensureDefaultAssistantBundles,
  getOrCreateInternalCompanyThread,
  hashValue,
  interpretAssistantMessageWithSettings,
  nextOnboardingStep,
  onboardingPrompt,
  shouldAutoExecuteBoardAssistantRequest,
  verifyChannelSecret,
} from "./board-assistant-helpers.js";
import { queueIssueAssignmentWakeup } from "./issue-assignment-wakeup.js";
import { heartbeatService } from "./heartbeat.js";
import { createBoardAssistantRequestRuntime } from "./board-assistant-request-runtime.js";
import { completeBoardAssistantOnboarding } from "./board-assistant-onboarding.js";
import {
  enqueueBoardAssistantOutbound,
  getActiveBoardAssistantBinding,
  getOrCreateExternalBoardAssistantThread,
  insertBoardAssistantThreadMessage,
  sendBoardAssistantFounderPrompt,
} from "./board-assistant-runtime.js";
import { createBoardAssistantMemoryService } from "./board-assistant-memory.js";
import { createBoardAssistantThreadService, getOrCreateInternalAgentThread } from "./board-assistant-threads.js";
import { deriveBoardAssistantMemoryProposalSeeds, persistBoardAssistantMemoryProposalSeeds } from "./board-assistant-memory-proposals.js";

export function boardAssistantService(db: Db) {
  const settings = instanceSettingsService(db);
  const companiesSvc = companyService(db);
  const issuesSvc = issueService(db);
  const systemProjects = systemProjectService(db);
  const access = accessService(db);
  const heartbeat = heartbeatService(db);
  const memoryService = createBoardAssistantMemoryService(db);
  const threadService = createBoardAssistantThreadService(db);

  async function appendInternalAuditForCompany(companyId: string, content: string) {
    const ceoAgentId = await companiesSvc.getEffectiveCeoAgentId(companyId);
    const thread = ceoAgentId
      ? await getOrCreateInternalAgentThread(db, {
          agentId: ceoAgentId,
          fallbackSummary: `CEO coordination thread for company ${companyId}`,
        })
      : await getOrCreateInternalCompanyThread(db, companyId);
    await insertBoardAssistantThreadMessage(db, {
      threadId: thread.id,
      authorKind: "system",
      direction: "internal",
      content,
      metadata: {
        companyId,
        threadMode: thread.mode,
      },
    });
    return thread;
  }

  async function checkIngressRateLimit(input: BoardAssistantIngress) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60_000);
    const [userCountRow, channelCountRow] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(boardAssistantRequests)
        .where(and(
          eq(boardAssistantRequests.channel, input.channel),
          eq(boardAssistantRequests.externalUserId, input.externalUserId),
          gt(boardAssistantRequests.createdAt, windowStart),
        ))
        .then((rows) => rows[0] ?? { count: 0 }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(boardAssistantRequests)
        .where(and(
          eq(boardAssistantRequests.channel, input.channel),
          gt(boardAssistantRequests.createdAt, windowStart),
        ))
        .then((rows) => rows[0] ?? { count: 0 }),
    ]);
    if (Number(userCountRow.count ?? 0) >= 60) {
      throw conflict("Ingress rate limit exceeded for this external user");
    }
    if (Number(channelCountRow.count ?? 0) >= 300) {
      throw conflict("Ingress rate limit exceeded for this channel");
    }
  }
  const requestRuntime = createBoardAssistantRequestRuntime({
    db,
    settings,
    companiesSvc,
    access,
    systemProjects,
    heartbeat,
    appendInternalAuditForCompany,
  });

  return {
    ensureDefaultBundles: () => ensureDefaultAssistantBundles(db),

    getSettings: () => settings.getBoardAssistant(),

    updateSettings: (patch: PatchBoardAssistantSettings) => settings.updateBoardAssistant(patch),

    createBindingSession: async (input: CreateBoardAssistantBindingSession, initiatedBy: string) => {
      const cfg = await settings.getBoardAssistant();
      const now = new Date();
      const token = `pcp_ba_bind_${randomBytes(18).toString("hex")}`;
      const bindingCode = randomBytes(3).toString("hex").toUpperCase();
      await requestRuntime.cancelPendingBindingSessions(input.channel, "cancelled");
      const created = await db
        .insert(boardAssistantBindingSessions)
        .values({
          channel: input.channel,
          status: "pending_channel_handshake",
          bindingCode,
          bindingTokenHash: hashValue(token),
          initiatedBy,
          expiresAt: addMinutes(now, cfg.bindingTokenTtlMinutes),
        })
        .returning()
        .then((rows) => rows[0]!);
      return { session: created, bindingToken: token };
    },

    getLatestBindingSession: requestRuntime.getLatestBindingSession,

    getBindingSession: async (bindingSessionId: string) =>
      db
        .select()
        .from(boardAssistantBindingSessions)
        .where(eq(boardAssistantBindingSessions.id, bindingSessionId))
        .then((rows) => rows[0] ?? null),

    confirmBindingSession: async (bindingSessionId: string) => {
      await ensureDefaultAssistantBundles(db);
      return db.transaction(async (tx) => {
        const session = await tx
          .select()
          .from(boardAssistantBindingSessions)
          .where(eq(boardAssistantBindingSessions.id, bindingSessionId))
          .then((rows) => rows[0] ?? null);
        if (!session) throw notFound("Binding session not found");
        if (session.expiresAt.getTime() <= Date.now()) throw conflict("Binding session expired");
        if (session.status !== "pending_web_confirm") {
          throw conflict("Binding session is not ready for confirmation");
        }
        if (!session.externalUserId || !session.externalThreadId) {
          throw conflict("Binding session has not completed channel handshake");
        }
        const existingBinding = await tx
          .select()
          .from(boardAssistantBindings)
          .where(eq(boardAssistantBindings.status, "active"))
          .then((rows) => rows[0] ?? null);
        if (existingBinding && existingBinding.externalUserId !== session.externalUserId) {
          throw conflict("Another active external binding already exists");
        }
        const binding = existingBinding
          ? await tx
              .update(boardAssistantBindings)
              .set({
                channel: session.channel,
                externalUserId: session.externalUserId ?? existingBinding.externalUserId,
                externalThreadId: session.externalThreadId,
                externalDisplayName: session.externalDisplayName,
                activatedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(boardAssistantBindings.id, existingBinding.id))
              .returning()
              .then((rows) => rows[0]!)
          : await tx
              .insert(boardAssistantBindings)
              .values({
                channel: session.channel,
                externalUserId: session.externalUserId ?? "unknown-external-user",
                externalThreadId: session.externalThreadId,
                externalDisplayName: session.externalDisplayName,
                status: "active",
                activatedAt: new Date(),
              })
              .returning()
              .then((rows) => rows[0]!);
        await tx
          .update(boardAssistantBindingSessions)
          .set({ status: "active", usedAt: new Date(), updatedAt: new Date() })
          .where(eq(boardAssistantBindingSessions.id, session.id));

        const externalThread = session.externalThreadId
          ? await getOrCreateExternalBoardAssistantThread(db, {
              channel: binding.channel,
              bindingId: binding.id,
              externalThreadId: session.externalThreadId,
            })
          : null;
        const onboarding = await tx
          .insert(boardAssistantOnboardingSessions)
          .values({
            bindingSessionId: session.id,
            externalThreadId: session.externalThreadId,
            currentStep: 1,
            answers: {},
            status: "active",
            expiresAt: addHours(new Date(), 24),
          })
          .returning()
          .then((rows) => rows[0]!);

        if (externalThread) {
          await sendBoardAssistantFounderPrompt(db, {
            binding,
            thread: externalThread,
            text: onboardingPrompt(1),
            checkpointKind: "onboarding-step-1",
            payload: { kind: "onboarding", step: 1 },
          });
        }
        return { binding, onboarding };
      });
    },

    getActiveBinding: () => getActiveBoardAssistantBinding(db),

    revokeBinding: async (bindingId: string) => {
      const binding = await db
        .select()
        .from(boardAssistantBindings)
        .where(eq(boardAssistantBindings.id, bindingId))
        .then((rows) => rows[0] ?? null);
      if (!binding) throw notFound("Binding not found");

      await db.transaction(async (tx) => {
        await tx
          .update(boardAssistantBindings)
          .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
          .where(eq(boardAssistantBindings.id, bindingId));
        await tx
          .update(boardAssistantBindingSessions)
          .set({ status: "revoked", updatedAt: new Date() })
          .where(and(
            eq(boardAssistantBindingSessions.channel, binding.channel),
            inArray(boardAssistantBindingSessions.status, [...ACTIVE_BINDING_SESSION_STATUSES]),
          ));
        await tx
          .update(boardAssistantRequests)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(and(
            eq(boardAssistantRequests.bindingId, bindingId),
            inArray(boardAssistantRequests.status, ACTIVE_REQUEST_STATUSES),
          ));
        await tx
          .update(boardAssistantThreads)
          .set({ bindingId: null, archivedAt: new Date(), updatedAt: new Date() })
          .where(eq(boardAssistantThreads.bindingId, bindingId));
      });
      return { ...binding, status: "revoked" as const, revokedAt: new Date(), updatedAt: new Date() };
    },

    ingest: async (input: BoardAssistantIngress) => {
      const cfg = await settings.getBoardAssistant();
      verifyChannelSecret(input, cfg.previousSecretGraceWindowMinutes);
      const timestampMs = new Date(input.timestamp).getTime();
      if (Number.isNaN(timestampMs)) throw badRequest("Invalid ingress timestamp");
      if (Math.abs(Date.now() - timestampMs) > cfg.ingressReplayWindowMinutes * 60 * 1000) {
        throw conflict("Ingress timestamp outside replay window");
      }

      const existingRequest = await db
        .select()
        .from(boardAssistantRequests)
        .where(and(
          eq(boardAssistantRequests.channel, input.channel),
          eq(boardAssistantRequests.externalUserId, input.externalUserId),
          eq(boardAssistantRequests.externalThreadId, input.externalThreadId),
          eq(boardAssistantRequests.externalMessageId, input.externalMessageId),
        ))
        .then((rows) => rows[0] ?? null);
      if (existingRequest) return { request: existingRequest, duplicate: true };
      await checkIngressRateLimit(input);

      if (input.bindingToken) {
        const updatedSessions = await db
          .update(boardAssistantBindingSessions)
          .set({
            status: "pending_web_confirm",
            externalUserId: input.externalUserId,
            externalThreadId: input.externalThreadId,
            externalDisplayName: input.externalDisplayName ?? null,
            usedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(boardAssistantBindingSessions.channel, input.channel),
            eq(boardAssistantBindingSessions.bindingTokenHash, hashValue(input.bindingToken)),
            eq(boardAssistantBindingSessions.status, "pending_channel_handshake"),
            isNull(boardAssistantBindingSessions.usedAt),
            gt(boardAssistantBindingSessions.expiresAt, new Date()),
          ))
          .returning();
        const updated = updatedSessions[0] ?? null;
        if (!updated) {
          throw forbidden("Binding token invalid or expired");
        }
        return { bindingSession: updated, duplicate: false };
      }

      const binding = await getActiveBoardAssistantBinding(db);
      if (!binding || binding.channel !== input.channel || binding.externalUserId !== input.externalUserId) {
        throw forbidden("Active binding not found for inbound external identity");
      }

      const thread = await getOrCreateExternalBoardAssistantThread(db, {
        channel: input.channel,
        bindingId: binding.id,
        externalThreadId: input.externalThreadId,
      });
      await db
        .update(boardAssistantThreads)
        .set({ lastInboundAt: new Date(), updatedAt: new Date() })
        .where(eq(boardAssistantThreads.id, thread.id));
      await insertBoardAssistantThreadMessage(db, {
        threadId: thread.id,
        authorKind: "founder",
        direction: "inbound",
        content: input.messageText ?? "",
        metadata: {
          normalizedPayload: input.normalizedPayload,
          externalMessageId: input.externalMessageId,
        },
      });

      const onboarding = await db
        .select()
        .from(boardAssistantOnboardingSessions)
        .where(and(
          eq(boardAssistantOnboardingSessions.status, "active"),
          eq(boardAssistantOnboardingSessions.externalThreadId, input.externalThreadId),
        ))
        .orderBy(desc(boardAssistantOnboardingSessions.createdAt))
        .then((rows) => rows[0] ?? null);

      if (onboarding) {
        const currentKey = currentOnboardingKey(onboarding.currentStep);
        const nextAnswers = {
          ...onboarding.answers,
          ...(currentKey ? { [currentKey]: input.messageText.trim() } : {}),
        };
        const nextStep = nextOnboardingStep(onboarding.currentStep);
        const updated = await db
          .update(boardAssistantOnboardingSessions)
          .set({
            answers: nextAnswers,
            currentStep: nextStep ?? onboarding.currentStep,
            status: nextStep ? "active" : "completed",
            updatedAt: new Date(),
          })
          .where(eq(boardAssistantOnboardingSessions.id, onboarding.id))
          .returning()
          .then((rows) => rows[0]!);

        if (nextStep) {
          await sendBoardAssistantFounderPrompt(db, {
            binding,
            thread,
            text: onboardingPrompt(nextStep),
            checkpointKind: `onboarding-step-${nextStep}`,
            payload: { kind: "onboarding", step: nextStep },
          });
        } else {
          await completeBoardAssistantOnboarding({ db, settings, onboarding: updated, binding });
        }
        return { onboarding: updated, duplicate: false };
      }

      const requestsAllActiveCompanies = /\ball-active-companies\b/i.test(input.messageText ?? "")
        || (input.messageText ?? "").includes("所有活跃公司");
      if (requestsAllActiveCompanies) {
        const activeCompanies = (await companiesSvc.list()).filter((company) => company.status === "active");
        const allowed = cfg.allowAllActiveCompaniesQueryGroup;
        const request = await db
          .insert(boardAssistantRequests)
          .values({
            channel: input.channel,
            bindingId: binding.id,
            threadId: thread.id,
            externalUserId: input.externalUserId,
            externalThreadId: input.externalThreadId,
            externalMessageId: input.externalMessageId,
            status: "done",
            messageText: input.messageText ?? "",
            normalizedPayload: input.normalizedPayload ?? {},
            intentKind: "company_group_query",
            summary: "查询 built-in group：all-active-companies",
            cardPayload: allowed
              ? {
                  group: "all-active-companies",
                  result: `当前共有 ${activeCompanies.length} 家活跃公司。`,
                  companies: activeCompanies.map((company) => ({
                    id: company.id,
                    name: company.name,
                    status: company.status,
                  })),
                }
              : {
                  group: "all-active-companies",
                  result: "实例设置尚未开启 all-active-companies built-in group 查询。",
                },
          })
          .returning()
          .then((rows) => rows[0]!);
        const memorySeeds = deriveBoardAssistantMemoryProposalSeeds({
          messageText: input.messageText ?? "",
          sourceRef: `request:${request.id}`,
          interpretation: {
            status: request.status,
            summary: request.summary,
            intentKind: request.intentKind,
            targetKind: request.targetKind,
            targetLabel: "all-active-companies",
          },
        });
        await persistBoardAssistantMemoryProposalSeeds(db, memorySeeds);
        await enqueueBoardAssistantOutbound(db, {
          requestId: request.id,
          channel: request.channel,
          externalUserId: request.externalUserId,
          externalThreadId: request.externalThreadId,
          checkpointKind: "request-done",
          payload: {
            text: allowed
              ? `已按 built-in group all-active-companies 汇总 ${activeCompanies.length} 家活跃公司。`
              : "all-active-companies built-in group 当前未开启。",
            card: request.cardPayload,
          },
        });
        return { request, duplicate: false };
      }

      const interpretation = await interpretAssistantMessageWithSettings(db, input.messageText ?? "", {
        staticCompanyGroups: cfg.staticCompanyGroups ?? [],
      });
      const autoExecute = shouldAutoExecuteBoardAssistantRequest({
        autoExecutionMode: cfg.autoExecutionMode,
        intentKind: interpretation.intentKind,
        targetKind: interpretation.targetKind,
        proposedPayload: interpretation.proposedPayload,
      });
      const request = await db
        .insert(boardAssistantRequests)
        .values({
          channel: input.channel,
          bindingId: binding.id,
          threadId: thread.id,
          externalUserId: input.externalUserId,
          externalThreadId: input.externalThreadId,
          externalMessageId: input.externalMessageId,
          status: interpretation.status,
          messageText: input.messageText ?? "",
          normalizedPayload: input.normalizedPayload ?? {},
          intentKind: interpretation.intentKind,
          summary: interpretation.summary,
          cardPayload: interpretation.cardPayload,
          targetKind: interpretation.targetKind,
          targetRef: interpretation.targetRef,
          proposedAction: interpretation.proposedAction,
          proposedPayload: interpretation.proposedPayload,
          expiresAt: interpretation.status === "proposed"
            ? addHours(new Date(), cfg.proposedTtlHours)
            : null,
        })
        .returning()
        .then((rows) => rows[0]!);

      const memorySeeds = deriveBoardAssistantMemoryProposalSeeds({
        messageText: input.messageText ?? "",
        sourceRef: `request:${request.id}`,
        interpretation: {
          status: request.status,
          summary: request.summary,
          intentKind: request.intentKind,
          targetKind: request.targetKind,
          targetLabel: typeof request.cardPayload?.target === "string" ? request.cardPayload.target : null,
        },
      });
      await persistBoardAssistantMemoryProposalSeeds(db, memorySeeds);

      if (autoExecute && request.status === "proposed") {
        await db
          .update(boardAssistantRequests)
          .set({ status: "done", confirmedAt: new Date(), updatedAt: new Date() })
          .where(eq(boardAssistantRequests.id, request.id));
        request.status = "done";
      }

      if (request.status === "proposed") {
        await enqueueBoardAssistantOutbound(db, {
          requestId: request.id,
          channel: request.channel,
          externalUserId: request.externalUserId,
          externalThreadId: request.externalThreadId,
          checkpointKind: "request-proposed",
          payload: {
            text: "我已经整理成可确认任务卡片，等待你确认。",
            card: request.cardPayload,
          },
        });
      }
      if (request.status === "done") {
        await enqueueBoardAssistantOutbound(db, {
          requestId: request.id,
          channel: request.channel,
          externalUserId: request.externalUserId,
          externalThreadId: request.externalThreadId,
          checkpointKind: "request-done",
          payload: {
            text: autoExecute
              ? "这条消息已按当前自动执行策略处理。"
              : "这条消息我先按普通分析处理，没有直接进入正式执行。",
            card: request.cardPayload,
          },
        });
      }
      return { request, duplicate: false };
    },

    listRequests: async (query: BoardAssistantRequestQuery) => {
      const limit = query.limit ?? 50;
      const requests = await db
        .select()
        .from(boardAssistantRequests)
        .where(and(
          query.status ? eq(boardAssistantRequests.status, query.status) : undefined,
          ne(boardAssistantRequests.intentKind, "system_notification"),
        ))
        .orderBy(desc(boardAssistantRequests.createdAt))
        .limit(limit);
      return Promise.all(requests.map((request) => requestRuntime.reconcileRequestFromTargets(request.id).then((row) => row ?? request)));
    },

    getRequestById: async (requestId: string) => {
      await requestRuntime.reconcileRequestFromTargets(requestId);
      const request = await db
        .select()
        .from(boardAssistantRequests)
        .where(eq(boardAssistantRequests.id, requestId))
        .then((rows) => rows[0] ?? null);
      if (!request) return null;
      const targets = await db
        .select()
        .from(boardAssistantRequestTargets)
        .where(eq(boardAssistantRequestTargets.requestId, requestId))
        .orderBy(asc(boardAssistantRequestTargets.createdAt));
      const preview = request.proposedAction === "delete_company" && request.proposedPayload?.companyId
        ? await createDeleteCompanyPreview(db, String(request.proposedPayload.companyId)).catch(() => null)
        : null;
      return { request, targets, destructivePreview: preview };
    },

    confirmRequest: async (requestId: string, body: ConfirmBoardAssistantRequest, actorUserId: string) => {
      const existing = await db
        .select()
        .from(boardAssistantRequests)
        .where(eq(boardAssistantRequests.id, requestId))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Request not found");
      if (TERMINAL_REQUEST_STATUSES.includes(existing.status)) return existing;
      if (existing.status !== "proposed" && existing.status !== "blocked") {
        throw conflict("Only proposed or blocked requests can be confirmed");
      }

      const binding = existing.bindingId
        ? await db
            .select()
            .from(boardAssistantBindings)
            .where(eq(boardAssistantBindings.id, existing.bindingId))
            .then((rows) => rows[0] ?? null)
        : null;

      if (existing.targetKind === "instance" && existing.proposedAction === "create_company") {
        const companyName = String(existing.proposedPayload?.name ?? "New Company").trim();
        const company = await requestRuntime.createCompanyWithBootstrap(companyName, actorUserId);
        await db.insert(boardAssistantRequestTargets).values({
          requestId: existing.id,
          targetKind: "instance",
          targetRef: company.id,
          status: "done",
          instanceAction: "create_company",
          summary: `Created company ${company.name}`,
        });
        await db
          .update(boardAssistantRequests)
          .set({ status: "done", confirmedAt: new Date(), updatedAt: new Date() })
          .where(eq(boardAssistantRequests.id, existing.id));
        await logActivity(db, {
          companyId: company.id,
          actorType: "user",
          actorId: actorUserId,
          action: "board_assistant.company_created",
          entityType: "company",
          entityId: company.id,
          details: { requestId: existing.id, notes: body.notes ?? null },
        });
        if (binding) {
          await enqueueBoardAssistantOutbound(db, {
            requestId: existing.id,
            channel: binding.channel,
            externalUserId: binding.externalUserId,
            externalThreadId: binding.externalThreadId ?? existing.externalThreadId,
            checkpointKind: "request-confirmed",
            payload: { text: `已创建公司 ${company.name}。`, companyId: company.id },
          });
        }
        return { ...existing, status: "done", confirmedAt: new Date() };
      }

      if (existing.targetKind === "instance" && existing.proposedAction === "delete_company") {
        const companyId = String(existing.proposedPayload?.companyId ?? existing.targetRef ?? "");
        if (!companyId) throw badRequest("Delete company request is missing company target");
        const preview = await createDeleteCompanyPreview(db, companyId);
        if (preview.activeRunCount > 0) {
          await db
            .insert(boardAssistantRequestTargets)
            .values({
              requestId: existing.id,
              targetKind: "instance",
              targetRef: companyId,
              status: "blocked",
              blockedReason: "active_runs_present",
              instanceAction: "delete_company",
              summary: preview.impactSummary,
            })
            .onConflictDoUpdate({
              target: [
                boardAssistantRequestTargets.requestId,
                boardAssistantRequestTargets.targetKind,
                boardAssistantRequestTargets.targetRef,
              ],
              set: {
                status: "blocked",
                blockedReason: "active_runs_present",
                summary: preview.impactSummary,
                updatedAt: new Date(),
              },
            });
          await db
            .update(boardAssistantRequests)
            .set({ status: "blocked", blockedReason: "active_runs_present", updatedAt: new Date() })
            .where(eq(boardAssistantRequests.id, existing.id));
          return { ...existing, status: "blocked", blockedReason: "active_runs_present" };
        }
        const targetCompany = await companiesSvc.getById(companyId);
        if (!targetCompany) throw notFound("Company not found");
        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: actorUserId,
          action: "board_assistant.company_delete_requested",
          entityType: "company",
          entityId: companyId,
          details: { requestId: existing.id, notes: body.notes ?? null, preview },
        });
        await companiesSvc.remove(companyId);
        await db.insert(boardAssistantRequestTargets).values({
          requestId: existing.id,
          targetKind: "instance",
          targetRef: companyId,
          status: "done",
          instanceAction: "delete_company",
          summary: `Deleted company ${targetCompany.name}`,
        });
        await db
          .update(boardAssistantRequests)
          .set({ status: "done", confirmedAt: new Date(), updatedAt: new Date() })
          .where(eq(boardAssistantRequests.id, existing.id));
        if (binding) {
          await enqueueBoardAssistantOutbound(db, {
            requestId: existing.id,
            channel: binding.channel,
            externalUserId: binding.externalUserId,
            externalThreadId: binding.externalThreadId ?? existing.externalThreadId,
            checkpointKind: "request-confirmed",
            payload: { text: `已删除公司 ${targetCompany.name}。`, companyId },
          });
        }
        return { ...existing, status: "done", confirmedAt: new Date() };
      }

      if (existing.targetKind === "company" && existing.targetRef) {
        const project = await systemProjects.ensureCanonical(existing.targetRef);
        const ceoAgentId = await companiesSvc.getEffectiveCeoAgentId(existing.targetRef);
        const issue = await issuesSvc.create(existing.targetRef, {
          title: existing.summary || "Board Assistant task",
          description: [
            "来源：Board Assistant",
            "",
            existing.messageText,
            body.notes ? `\nFounder notes:\n${body.notes}` : "",
          ].join("\n"),
          projectId: project.id,
          status: "todo",
          assigneeAgentId: ceoAgentId,
        });
        const targetStatus = ceoAgentId ? "routed" : "blocked";
        const targetBlockedReason = ceoAgentId ? null : "ceo_not_claimed";
        await db.insert(boardAssistantRequestTargets).values({
          requestId: existing.id,
          targetKind: "company",
          targetRef: existing.targetRef,
          status: targetStatus,
          blockedReason: targetBlockedReason,
          issueId: issue.id,
          summary: `Created CEO issue ${issue.identifier}`,
        });
        await db
          .update(boardAssistantRequests)
          .set({
            status: targetStatus,
            blockedReason: targetBlockedReason,
            confirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(boardAssistantRequests.id, existing.id));
        if (ceoAgentId) {
          await queueIssueAssignmentWakeup({
            heartbeat,
            issue,
            reason: "board-assistant-confirmed-request",
            mutation: "board_assistant.issue_created",
            contextSource: "board_assistant",
            requestedByActorType: "user",
            requestedByActorId: actorUserId,
          });
        }
        await appendInternalAuditForCompany(existing.targetRef, `Board Assistant 已创建 CEO issue ${issue.identifier}。`);
        await logActivity(db, {
          companyId: existing.targetRef,
          actorType: "user",
          actorId: actorUserId,
          action: "board_assistant.issue_created",
          entityType: "issue",
          entityId: issue.id,
          details: { requestId: existing.id, identifier: issue.identifier },
        });
        if (binding) {
          await enqueueBoardAssistantOutbound(db, {
            requestId: existing.id,
            channel: binding.channel,
            externalUserId: binding.externalUserId,
            externalThreadId: binding.externalThreadId ?? existing.externalThreadId,
            checkpointKind: "request-confirmed",
            payload: { text: `已创建正式任务 ${issue.identifier}。`, issueId: issue.id, issueIdentifier: issue.identifier },
            targetRef: existing.targetRef,
          });
          const cfg = await settings.getBoardAssistant();
          if (!ceoAgentId && cfg.allowProactiveBriefing) {
            const thread = await getOrCreateExternalBoardAssistantThread(db, {
              channel: binding.channel,
              bindingId: binding.id,
              externalThreadId: binding.externalThreadId ?? existing.externalThreadId,
            });
            await sendBoardAssistantFounderPrompt(db, {
              binding,
              thread,
              text: "该公司当前没有可用 CEO，这条任务已进入阻塞状态，等待后续任命或重唤醒。",
              checkpointKind: "request-blocked-ceo-not-claimed",
              payload: { requestId: existing.id, targetRef: existing.targetRef, reason: "ceo_not_claimed" },
            });
          }
        }
        const reconciled = await requestRuntime.reconcileRequestFromTargets(existing.id);
        return reconciled ?? { ...existing, status: targetStatus, confirmedAt: new Date(), blockedReason: targetBlockedReason };
      }

      throw badRequest("Request is missing an executable target");
    },

    rejectRequest: async (requestId: string, body: RejectBoardAssistantRequest, actorUserId: string) => {
      const current = await db
        .select()
        .from(boardAssistantRequests)
        .where(eq(boardAssistantRequests.id, requestId))
        .then((rows) => rows[0] ?? null);
      if (!current) throw notFound("Request not found");
      const existing = TERMINAL_REQUEST_STATUSES.includes(current.status)
        ? current
        : await db
            .update(boardAssistantRequests)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(boardAssistantRequests.id, requestId))
            .returning()
            .then((rows) => rows[0] ?? current);
      if (!existing) throw notFound("Request not found");
      const binding = existing.bindingId
        ? await db
            .select()
            .from(boardAssistantBindings)
            .where(eq(boardAssistantBindings.id, existing.bindingId))
            .then((rows) => rows[0] ?? null)
        : null;
      if (binding) {
        await enqueueBoardAssistantOutbound(db, {
          requestId: existing.id,
          channel: binding.channel,
          externalUserId: binding.externalUserId,
          externalThreadId: binding.externalThreadId ?? existing.externalThreadId,
          checkpointKind: "request-rejected",
          payload: { text: body.reason ? `已取消：${body.reason}` : "该任务已取消。" },
        });
      }
      if (existing.targetKind === "company" && existing.targetRef) {
        await logActivity(db, {
          companyId: existing.targetRef,
          actorType: "user",
          actorId: actorUserId,
          action: "board_assistant.request_rejected",
          entityType: "board_assistant_request",
          entityId: existing.id,
          details: { reason: body.reason ?? null },
        });
      }
      return existing;
    },

    rewakeRequestTarget: requestRuntime.rewakeRequestTarget,

    cancelRequestTarget: requestRuntime.cancelRequestTarget,

    ...memoryService,
    ...threadService,

    listOutbox: async (channel: BoardAssistantChannelKind) => {
      const cfg = await settings.getBoardAssistant();
      const rows = await db
        .select({
          outbox: boardAssistantOutbox,
        })
        .from(boardAssistantOutbox)
        .innerJoin(boardAssistantRequests, eq(boardAssistantRequests.id, boardAssistantOutbox.requestId))
        .innerJoin(boardAssistantBindings, eq(boardAssistantBindings.id, boardAssistantRequests.bindingId))
        .where(and(
          eq(boardAssistantOutbox.channel, channel),
          inArray(boardAssistantOutbox.status, ["pending", "failed"]),
          sql`${boardAssistantOutbox.attemptCount} < ${cfg.outboxMaxRetries}`,
          or(
            isNull(boardAssistantOutbox.nextAttemptAt),
            sql`${boardAssistantOutbox.nextAttemptAt} <= ${new Date()}`,
          ),
          sql`${boardAssistantRequests.status} not in ('cancelled', 'expired')`,
          eq(boardAssistantBindings.status, "active"),
        ))
        .orderBy(asc(boardAssistantOutbox.createdAt))
        .limit(50);
      return rows.map((row) => row.outbox);
    },

    ackOutbox: async (outboxId: string, body: BoardAssistantOutboxAck) => {
      if (body.sent) {
        return db
          .update(boardAssistantOutbox)
          .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
          .where(eq(boardAssistantOutbox.id, outboxId))
          .returning()
          .then((rows) => {
            const row = rows[0] ?? null;
            if (!row) throw notFound("Outbox item not found");
            return row;
          });
      }
      const cfg = await settings.getBoardAssistant();
      const current = await db
        .select()
        .from(boardAssistantOutbox)
        .where(eq(boardAssistantOutbox.id, outboxId))
        .then((rows) => rows[0] ?? null);
      if (!current) throw notFound("Outbox item not found");
      const nextAttemptCount = current.attemptCount + 1;
      const retryDelays = [2, 4, 8, 16, 32];
      const exhausted = nextAttemptCount >= cfg.outboxMaxRetries;
      const nextAttemptAt = exhausted
        ? null
        : addMinutes(new Date(), retryDelays[Math.min(nextAttemptCount - 1, retryDelays.length - 1)]!);
      return db
        .update(boardAssistantOutbox)
        .set({
          status: "failed",
          attemptCount: nextAttemptCount,
          nextAttemptAt,
          updatedAt: new Date(),
        })
        .where(eq(boardAssistantOutbox.id, outboxId))
        .returning()
        .then((rows) => {
          const row = rows[0] ?? null;
          if (!row) throw notFound("Outbox item not found");
          return row;
        });
    },

    health: async () => {
      const [cfg, activeBinding, requestCounts, outboxCounts] = await Promise.all([
        settings.getBoardAssistant(),
        getActiveBoardAssistantBinding(db),
        db
          .select({
            status: boardAssistantRequests.status,
            count: sql<number>`count(*)::int`,
          })
          .from(boardAssistantRequests)
          .groupBy(boardAssistantRequests.status),
        db
          .select({
            status: boardAssistantOutbox.status,
            count: sql<number>`count(*)::int`,
          })
          .from(boardAssistantOutbox)
          .groupBy(boardAssistantOutbox.status),
      ]);
      return {
        settings: cfg,
        activeBinding,
        requestCounts,
        outboxCounts,
        channelSecretsConfigured: {
          wechat: Boolean(process.env.BOARD_ASSISTANT_CHANNEL_SECRET_WECHAT),
        },
      };
    },
  };
}
