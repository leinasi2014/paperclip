import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  boardAssistantBindings,
  boardAssistantOutbox,
  boardAssistantRequests,
  boardAssistantThreadMessages,
  boardAssistantThreads,
} from "@paperclipai/db";
import type { BoardAssistantChannelKind } from "@paperclipai/shared";

export async function getActiveBoardAssistantBinding(db: Db) {
  return db
    .select()
    .from(boardAssistantBindings)
    .where(eq(boardAssistantBindings.status, "active"))
    .then((rows) => rows[0] ?? null);
}

export async function getOrCreateExternalBoardAssistantThread(
  db: Db,
  input: {
    channel: BoardAssistantChannelKind;
    bindingId: string | null;
    externalThreadId: string;
  },
) {
  const existing = await db
    .select()
    .from(boardAssistantThreads)
    .where(and(
      eq(boardAssistantThreads.threadKind, "external"),
      eq(boardAssistantThreads.channel, input.channel),
      eq(boardAssistantThreads.externalThreadId, input.externalThreadId),
    ))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;
  return db
    .insert(boardAssistantThreads)
    .values({
      threadKind: "external",
      channel: input.channel,
      bindingId: input.bindingId,
      externalThreadId: input.externalThreadId,
    })
    .returning()
    .then((rows) => rows[0]!);
}

export async function insertBoardAssistantThreadMessage(
  db: Db,
  input: {
    threadId: string;
    authorKind: "assistant" | "founder" | "system";
    authorRef?: string | null;
    direction: "inbound" | "outbound" | "internal";
    content: string;
    metadata?: Record<string, unknown>;
  },
) {
  return db
    .insert(boardAssistantThreadMessages)
    .values({
      threadId: input.threadId,
      authorKind: input.authorKind,
      authorRef: input.authorRef ?? null,
      direction: input.direction,
      content: input.content,
      metadata: input.metadata ?? {},
    })
    .returning()
    .then((rows) => rows[0]!);
}

export async function createBoardAssistantSystemNotificationRequest(
  db: Db,
  input: {
    channel: BoardAssistantChannelKind;
    bindingId: string;
    threadId: string;
    externalUserId: string;
    externalThreadId: string;
    summary: string;
    payload: Record<string, unknown>;
  },
) {
  return db
    .insert(boardAssistantRequests)
    .values({
      channel: input.channel,
      bindingId: input.bindingId,
      threadId: input.threadId,
      externalUserId: input.externalUserId,
      externalThreadId: input.externalThreadId,
        externalMessageId: `system-${randomUUID()}`,
      status: "done",
      messageText: "",
      normalizedPayload: {},
      intentKind: "system_notification",
      summary: input.summary,
      cardPayload: input.payload,
    })
    .returning()
    .then((rows) => rows[0]!);
}

export async function enqueueBoardAssistantOutbound(
  db: Db,
  input: {
    requestId: string;
    channel: BoardAssistantChannelKind;
    externalUserId: string;
    externalThreadId: string;
    checkpointKind: string;
    payload: Record<string, unknown>;
    targetRef?: string | null;
  },
) {
  const existing = await db
    .select()
    .from(boardAssistantOutbox)
    .where(and(
      eq(boardAssistantOutbox.requestId, input.requestId),
      eq(boardAssistantOutbox.checkpointKind, input.checkpointKind),
      input.targetRef == null
        ? isNull(boardAssistantOutbox.targetRef)
        : eq(boardAssistantOutbox.targetRef, input.targetRef),
    ))
    .orderBy(desc(boardAssistantOutbox.createdAt))
    .then((rows) => rows[0] ?? null);

  if (existing) {
    return db
      .update(boardAssistantOutbox)
      .set({
        status: "pending",
        payload: input.payload,
        nextAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(boardAssistantOutbox.id, existing.id))
      .returning()
      .then((rows) => rows[0]!);
  }

  return db
    .insert(boardAssistantOutbox)
    .values({
      requestId: input.requestId,
      channel: input.channel,
      externalUserId: input.externalUserId,
      externalThreadId: input.externalThreadId,
      status: "pending",
      checkpointKind: input.checkpointKind,
      targetRef: input.targetRef ?? null,
      payload: input.payload,
      nextAttemptAt: new Date(),
    })
    .returning()
    .then((rows) => rows[0]!);
}

export async function sendBoardAssistantFounderPrompt(
  db: Db,
  input: {
    binding: typeof boardAssistantBindings.$inferSelect;
    thread: typeof boardAssistantThreads.$inferSelect;
    text: string;
    checkpointKind: string;
    payload?: Record<string, unknown>;
  },
) {
  const request = await createBoardAssistantSystemNotificationRequest(db, {
    channel: input.binding.channel,
    bindingId: input.binding.id,
    threadId: input.thread.id,
    externalUserId: input.binding.externalUserId,
    externalThreadId: input.binding.externalThreadId ?? input.thread.externalThreadId ?? "",
    summary: input.text,
    payload: { text: input.text, ...(input.payload ?? {}) },
  });
  await enqueueBoardAssistantOutbound(db, {
    requestId: request.id,
    channel: input.binding.channel,
    externalUserId: input.binding.externalUserId,
    externalThreadId: input.binding.externalThreadId ?? input.thread.externalThreadId ?? "",
    checkpointKind: input.checkpointKind,
    payload: { text: input.text, ...(input.payload ?? {}) },
  });
  return request;
}

export async function listInternalBoardAssistantThreads(db: Db, limit: number) {
  return db
    .select()
    .from(boardAssistantThreads)
    .where(eq(boardAssistantThreads.threadKind, "internal"))
    .orderBy(desc(boardAssistantThreads.updatedAt))
    .limit(limit);
}
