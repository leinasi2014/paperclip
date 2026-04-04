import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  BoardAssistantBindingSessionStatus,
  BoardAssistantBlockedReason,
  BoardAssistantBundleKind,
  BoardAssistantChannelKind,
  BoardAssistantInstanceAction,
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
} from "@paperclipai/shared";
import { issues } from "./issues.js";

export const boardAssistantBindings = pgTable(
  "board_assistant_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").$type<BoardAssistantChannelKind>().notNull(),
    externalUserId: text("external_user_id").notNull(),
    externalThreadId: text("external_thread_id"),
    externalDisplayName: text("external_display_name"),
    status: text("status").notNull().default("active"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeBindingUq: uniqueIndex("board_assistant_bindings_active_uq")
      .on(table.status)
      .where(sql`${table.status} = 'active'`),
    channelUserIdx: index("board_assistant_bindings_channel_user_idx").on(table.channel, table.externalUserId),
  }),
);

export const boardAssistantBindingSessions = pgTable(
  "board_assistant_binding_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").$type<BoardAssistantChannelKind>().notNull(),
    status: text("status").$type<BoardAssistantBindingSessionStatus>().notNull(),
    bindingCode: text("binding_code").notNull(),
    bindingTokenHash: text("binding_token_hash").notNull(),
    initiatedBy: text("initiated_by").notNull(),
    externalUserId: text("external_user_id"),
    externalThreadId: text("external_thread_id"),
    externalDisplayName: text("external_display_name"),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUq: uniqueIndex("board_assistant_binding_sessions_token_hash_uq").on(table.bindingTokenHash),
    statusIdx: index("board_assistant_binding_sessions_status_idx").on(table.status, table.expiresAt),
  }),
);

export const boardAssistantOnboardingSessions = pgTable(
  "board_assistant_onboarding_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bindingSessionId: uuid("binding_session_id").references(() => boardAssistantBindingSessions.id, {
      onDelete: "set null",
    }),
    externalThreadId: text("external_thread_id"),
    currentStep: integer("current_step").notNull().default(1),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<BoardAssistantOnboardingSessionStatus>().notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    bindingSessionActiveIdx: uniqueIndex("board_assistant_onboarding_sessions_binding_active_uq")
      .on(table.bindingSessionId)
      .where(sql`${table.status} = 'active' and ${table.bindingSessionId} is not null`),
    statusExpiresIdx: index("board_assistant_onboarding_sessions_status_expires_idx").on(
      table.status,
      table.expiresAt,
    ),
  }),
);

export const boardAssistantThreads = pgTable(
  "board_assistant_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadKind: text("thread_kind").$type<BoardAssistantThreadKind>().notNull(),
    channel: text("channel").$type<BoardAssistantChannelKind>(),
    bindingId: uuid("binding_id").references(() => boardAssistantBindings.id, { onDelete: "set null" }),
    externalThreadId: text("external_thread_id"),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    mode: text("mode").$type<BoardAssistantThreadMode>().notNull().default("observe"),
    activeContextSummary: text("active_context_summary"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
    setBy: text("set_by"),
    setAt: timestamp("set_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    kindUpdatedIdx: index("board_assistant_threads_kind_updated_idx").on(table.threadKind, table.updatedAt),
    externalThreadIdx: index("board_assistant_threads_external_idx").on(table.channel, table.externalThreadId),
    subjectIdx: index("board_assistant_threads_subject_idx").on(table.subjectType, table.subjectId),
  }),
);

export const boardAssistantThreadMessages = pgTable(
  "board_assistant_thread_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").notNull().references(() => boardAssistantThreads.id, { onDelete: "cascade" }),
    authorKind: text("author_kind").$type<BoardAssistantThreadMessageAuthorKind>().notNull(),
    authorRef: text("author_ref"),
    direction: text("direction").$type<BoardAssistantThreadMessageDirection>().notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    supersedesMessageId: uuid("supersedes_message_id"),
    supersededByMessageId: uuid("superseded_by_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    threadCreatedIdx: index("board_assistant_thread_messages_thread_created_idx").on(
      table.threadId,
      table.createdAt,
      table.id,
    ),
  }),
);

export const boardAssistantRequests = pgTable(
  "board_assistant_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").$type<BoardAssistantChannelKind>().notNull(),
    bindingId: uuid("binding_id").references(() => boardAssistantBindings.id, { onDelete: "set null" }),
    threadId: uuid("thread_id").references(() => boardAssistantThreads.id, { onDelete: "set null" }),
    externalUserId: text("external_user_id").notNull(),
    externalThreadId: text("external_thread_id").notNull(),
    externalMessageId: text("external_message_id").notNull(),
    status: text("status").$type<BoardAssistantRequestStatus>().notNull(),
    messageText: text("message_text").notNull().default(""),
    normalizedPayload: jsonb("normalized_payload").$type<Record<string, unknown>>().notNull().default({}),
    intentKind: text("intent_kind"),
    summary: text("summary"),
    cardPayload: jsonb("card_payload").$type<Record<string, unknown>>(),
    blockedReason: text("blocked_reason").$type<BoardAssistantBlockedReason>(),
    targetKind: text("target_kind").$type<BoardAssistantTargetKind>(),
    targetRef: text("target_ref"),
    proposedAction: text("proposed_action").$type<BoardAssistantInstanceAction>(),
    proposedPayload: jsonb("proposed_payload").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ingressUniqueIdx: uniqueIndex("board_assistant_requests_ingress_uq").on(
      table.channel,
      table.externalUserId,
      table.externalThreadId,
      table.externalMessageId,
    ),
    statusUpdatedIdx: index("board_assistant_requests_status_updated_idx").on(table.status, table.updatedAt),
    threadCreatedIdx: index("board_assistant_requests_thread_created_idx").on(table.threadId, table.createdAt),
  }),
);

export const boardAssistantRequestTargets = pgTable(
  "board_assistant_request_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => boardAssistantRequests.id, { onDelete: "cascade" }),
    targetKind: text("target_kind").$type<BoardAssistantTargetKind>().notNull(),
    targetRef: text("target_ref").notNull(),
    status: text("status").$type<BoardAssistantTargetStatus>().notNull(),
    blockedReason: text("blocked_reason").$type<BoardAssistantBlockedReason>(),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    instanceAction: text("instance_action").$type<BoardAssistantInstanceAction>(),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    requestTargetUq: uniqueIndex("board_assistant_request_targets_request_target_uq").on(
      table.requestId,
      table.targetKind,
      table.targetRef,
    ),
    requestStatusIdx: index("board_assistant_request_targets_request_status_idx").on(table.requestId, table.status),
  }),
);

export const boardAssistantOutbox = pgTable(
  "board_assistant_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => boardAssistantRequests.id, { onDelete: "cascade" }),
    channel: text("channel").$type<BoardAssistantChannelKind>().notNull(),
    externalUserId: text("external_user_id").notNull(),
    externalThreadId: text("external_thread_id").notNull(),
    status: text("status").$type<BoardAssistantOutboxStatus>().notNull(),
    checkpointKind: text("checkpoint_kind").notNull(),
    targetRef: text("target_ref"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    requestCheckpointUq: uniqueIndex("board_assistant_outbox_request_checkpoint_uq").on(
      table.requestId,
      table.checkpointKind,
      table.targetRef,
    ),
    statusAttemptIdx: index("board_assistant_outbox_status_attempt_idx").on(table.status, table.nextAttemptAt),
  }),
);

export const boardAssistantBundleRevisions = pgTable(
  "board_assistant_bundle_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleKind: text("bundle_kind").$type<BoardAssistantBundleKind>().notNull(),
    revisionLabel: text("revision_label").notNull(),
    content: text("content").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    updatedBy: text("updated_by").notNull(),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeBundleUq: uniqueIndex("board_assistant_bundle_revisions_active_uq")
      .on(table.bundleKind)
      .where(sql`${table.isActive} = true`),
    kindCreatedIdx: index("board_assistant_bundle_revisions_kind_created_idx").on(table.bundleKind, table.createdAt),
  }),
);

export const boardAssistantMemories = pgTable(
  "board_assistant_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memoryKind: text("memory_kind").$type<BoardAssistantMemoryKind>().notNull(),
    summary: text("summary").notNull(),
    sourceRefs: jsonb("source_refs").$type<string[]>().notNull().default([]),
    confidence: integer("confidence").notNull().default(100),
    visibilityPolicy: text("visibility_policy").$type<BoardAssistantMemoryVisibilityPolicy>().notNull(),
    status: text("status").$type<BoardAssistantMemoryStatus>().notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    kindStatusIdx: index("board_assistant_memories_kind_status_idx").on(table.memoryKind, table.status),
  }),
);

export const boardAssistantMemoryProposals = pgTable(
  "board_assistant_memory_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memoryKind: text("memory_kind").$type<BoardAssistantMemoryKind>().notNull(),
    summary: text("summary").notNull(),
    sourceRefs: jsonb("source_refs").$type<string[]>().notNull().default([]),
    confidence: integer("confidence").notNull().default(100),
    visibilityPolicy: text("visibility_policy").$type<BoardAssistantMemoryVisibilityPolicy>().notNull(),
    status: text("status").$type<BoardAssistantMemoryProposalStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCreatedIdx: index("board_assistant_memory_proposals_status_created_idx").on(table.status, table.createdAt),
  }),
);
