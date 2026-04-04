import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  boardAssistantThreadMessages,
  boardAssistantThreads,
} from "@paperclipai/db";
import type {
  BoardAssistantThreadMessageQuery,
  BoardAssistantThreadQuery,
  BoardAssistantThreadMode,
  CreateBoardAssistantThreadMessage,
  UpdateBoardAssistantThreadMode,
} from "@paperclipai/shared";
import { conflict, notFound } from "../errors.js";
import {
  insertBoardAssistantThreadMessage,
  listInternalBoardAssistantThreads,
} from "./board-assistant-runtime.js";

function modeChangedSummary(mode: BoardAssistantThreadMode) {
  if (mode === "joint_speaking") {
    return "线程已切换到联合发言模式，助理后续会保留 Founder 语境一起跟进。";
  }
  if (mode === "takeover") {
    return "线程已切换到接管模式，助理后续默认代表 Founder 继续推进。";
  }
  return "线程已切换到旁观模式，助理后续只保留审计与观察。";
}

function assistantFollowupSummary(mode: BoardAssistantThreadMode) {
  if (mode === "joint_speaking") {
    return "已记录 Founder 的补充，我会按联合发言模式继续推进这条内部线程。";
  }
  if (mode === "takeover") {
    return "已记录 Founder 的补充，我会按接管模式继续代表 Founder 跟进。";
  }
  return null;
}

export async function getOrCreateInternalAgentThread(
  db: Db,
  input: {
    agentId: string;
    fallbackSummary?: string | null;
  },
) {
  const existing = await db
    .select()
    .from(boardAssistantThreads)
    .where(and(
      eq(boardAssistantThreads.threadKind, "internal"),
      eq(boardAssistantThreads.subjectType, "agent"),
      eq(boardAssistantThreads.subjectId, input.agentId),
    ))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;
  const agent = await db
    .select({ id: agents.id, name: agents.name, title: agents.title, companyId: agents.companyId })
    .from(agents)
    .where(eq(agents.id, input.agentId))
    .then((rows) => rows[0] ?? null);
  const summary = input.fallbackSummary
    ?? (agent ? `${agent.title ?? "Agent"} ${agent.name}` : `Agent ${input.agentId}`);
  return db
    .insert(boardAssistantThreads)
    .values({
      threadKind: "internal",
      subjectType: "agent",
      subjectId: input.agentId,
      mode: "observe",
      activeContextSummary: summary,
    })
    .returning()
    .then((rows) => rows[0]!);
}

export function createBoardAssistantThreadService(db: Db) {
  return {
    listThreads: async (query: BoardAssistantThreadQuery) => {
      const limit = query.limit ?? 50;
      if (!query.threadKind || query.threadKind === "internal") {
        return listInternalBoardAssistantThreads(db, limit);
      }
      return db
        .select()
        .from(boardAssistantThreads)
        .where(eq(boardAssistantThreads.threadKind, query.threadKind))
        .orderBy(desc(boardAssistantThreads.updatedAt))
        .limit(limit);
    },

    listThreadMessages: async (threadId: string, query: BoardAssistantThreadMessageQuery) => {
      const limit = query.limit ?? 200;
      return db
        .select()
        .from(boardAssistantThreadMessages)
        .where(eq(boardAssistantThreadMessages.threadId, threadId))
        .orderBy(desc(boardAssistantThreadMessages.createdAt))
        .limit(limit);
    },

    postThreadMessage: async (threadId: string, body: CreateBoardAssistantThreadMessage, actorUserId: string) => {
      const thread = await db
        .select()
        .from(boardAssistantThreads)
        .where(eq(boardAssistantThreads.id, threadId))
        .then((rows) => rows[0] ?? null);
      if (!thread) throw notFound("Thread not found");
      if (thread.threadKind !== "internal") {
        throw conflict("Only internal threads accept manual founder messages in v1");
      }
      const founderMessage = await insertBoardAssistantThreadMessage(db, {
        threadId,
        authorKind: "founder",
        authorRef: actorUserId,
        direction: "internal",
        content: body.content,
        metadata: {
          ...body.metadata,
          threadMode: thread.mode,
        },
      });
      const assistantSummary = assistantFollowupSummary(thread.mode);
      if (assistantSummary) {
        await insertBoardAssistantThreadMessage(db, {
          threadId,
          authorKind: "assistant",
          direction: "internal",
          content: assistantSummary,
          metadata: {
            generatedBy: "board-assistant-thread-mode",
            threadMode: thread.mode,
            sourceMessageId: founderMessage.id,
          },
        });
      }
      await db
        .update(boardAssistantThreads)
        .set({ lastOutboundAt: new Date(), updatedAt: new Date() })
        .where(eq(boardAssistantThreads.id, threadId));
      return founderMessage;
    },

    updateThreadMode: async (threadId: string, body: UpdateBoardAssistantThreadMode, actorUserId: string) => {
      const existing = await db
        .select()
        .from(boardAssistantThreads)
        .where(eq(boardAssistantThreads.id, threadId))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Thread not found");
      if (existing.threadKind !== "internal") {
        throw conflict("Only internal threads can change mode in v1");
      }
      const row = await db
        .update(boardAssistantThreads)
        .set({
          mode: body.mode as BoardAssistantThreadMode,
          setBy: actorUserId,
          setAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(boardAssistantThreads.id, threadId))
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Thread not found");
      if (row.threadKind === "internal") {
        await insertBoardAssistantThreadMessage(db, {
          threadId: row.id,
          authorKind: "system",
          direction: "internal",
          content: modeChangedSummary(row.mode),
          metadata: {
            generatedBy: "board-assistant-thread-mode",
            threadMode: row.mode,
            setBy: actorUserId,
          },
        });
      }
      return row;
    },
  };
}
