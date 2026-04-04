import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  boardAssistantMemories,
  boardAssistantMemoryProposals,
} from "@paperclipai/db";
import type {
  ApproveBoardAssistantMemoryProposal,
  BoardAssistantMemoryKind,
  BoardAssistantMemoryProposalQuery,
  BoardAssistantMemoryQuery,
  BoardAssistantMemoryVisibilityPolicy,
  RejectBoardAssistantMemoryProposal,
  SuppressBoardAssistantMemory,
} from "@paperclipai/shared";
import { notFound } from "../errors.js";

export async function createBoardAssistantMemoryProposalIfMissing(
  db: Db,
  input: {
    memoryKind: BoardAssistantMemoryKind;
    summary: string;
    sourceRefs: string[];
    confidence: number;
    visibilityPolicy: BoardAssistantMemoryVisibilityPolicy;
  },
) {
  const normalizedSummary = input.summary.trim();
  if (!normalizedSummary) return null;
  const existingProposal = await db
    .select({ id: boardAssistantMemoryProposals.id })
    .from(boardAssistantMemoryProposals)
    .where(and(
      eq(boardAssistantMemoryProposals.memoryKind, input.memoryKind),
      eq(boardAssistantMemoryProposals.summary, normalizedSummary),
      eq(boardAssistantMemoryProposals.status, "pending"),
    ))
    .then((rows) => rows[0] ?? null);
  if (existingProposal) return existingProposal;
  const existingMemory = await db
    .select({ id: boardAssistantMemories.id })
    .from(boardAssistantMemories)
    .where(and(
      eq(boardAssistantMemories.memoryKind, input.memoryKind),
      eq(boardAssistantMemories.summary, normalizedSummary),
      eq(boardAssistantMemories.status, "active"),
    ))
    .then((rows) => rows[0] ?? null);
  if (existingMemory) return existingMemory;
  return db
    .insert(boardAssistantMemoryProposals)
    .values({
      memoryKind: input.memoryKind,
      summary: normalizedSummary,
      sourceRefs: input.sourceRefs,
      confidence: input.confidence,
      visibilityPolicy: input.visibilityPolicy,
      status: "pending",
    })
    .returning()
    .then((rows) => rows[0] ?? null);
}

export function createBoardAssistantMemoryService(db: Db) {
  return {
    listMemories: async (query: BoardAssistantMemoryQuery) => {
      const limit = query.limit ?? 50;
      return db
        .select()
        .from(boardAssistantMemories)
        .where(and(
          query.memoryKind ? eq(boardAssistantMemories.memoryKind, query.memoryKind) : undefined,
          query.status ? eq(boardAssistantMemories.status, query.status) : undefined,
        ))
        .orderBy(desc(boardAssistantMemories.updatedAt))
        .limit(limit);
    },

    listMemoryProposals: async (query: BoardAssistantMemoryProposalQuery) => {
      const limit = query.limit ?? 50;
      return db
        .select()
        .from(boardAssistantMemoryProposals)
        .where(and(
          query.memoryKind ? eq(boardAssistantMemoryProposals.memoryKind, query.memoryKind) : undefined,
          query.status ? eq(boardAssistantMemoryProposals.status, query.status) : undefined,
        ))
        .orderBy(desc(boardAssistantMemoryProposals.updatedAt))
        .limit(limit);
    },

    approveMemoryProposal: async (proposalId: string, body: ApproveBoardAssistantMemoryProposal) => {
      const proposal = await db
        .select()
        .from(boardAssistantMemoryProposals)
        .where(eq(boardAssistantMemoryProposals.id, proposalId))
        .then((rows) => rows[0] ?? null);
      if (!proposal) throw notFound("Memory proposal not found");
      if (proposal.status === "approved") return proposal;
      await db.insert(boardAssistantMemories).values({
        memoryKind: proposal.memoryKind,
        summary: body.summaryOverride ?? proposal.summary,
        sourceRefs: proposal.sourceRefs,
        confidence: proposal.confidence,
        visibilityPolicy: proposal.visibilityPolicy,
        status: "active",
      });
      return db
        .update(boardAssistantMemoryProposals)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(boardAssistantMemoryProposals.id, proposalId))
        .returning()
        .then((rows) => rows[0]!);
    },

    rejectMemoryProposal: (proposalId: string, _body: RejectBoardAssistantMemoryProposal) =>
      db
        .update(boardAssistantMemoryProposals)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(boardAssistantMemoryProposals.id, proposalId))
        .returning()
        .then((rows) => {
          const row = rows[0] ?? null;
          if (!row) throw notFound("Memory proposal not found");
          return row;
        }),

    suppressMemory: async (memoryId: string, body: SuppressBoardAssistantMemory) => {
      const nextStatus = body.suppress ? "suppressed" : "active";
      return db
        .update(boardAssistantMemories)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(boardAssistantMemories.id, memoryId))
        .returning()
        .then((rows) => {
          const row = rows[0] ?? null;
          if (!row) throw notFound("Memory not found");
          return row;
        });
    },

    deleteMemory: (memoryId: string) =>
      db
        .update(boardAssistantMemories)
        .set({ status: "deleted", updatedAt: new Date() })
        .where(eq(boardAssistantMemories.id, memoryId))
        .returning()
        .then((rows) => {
          const row = rows[0] ?? null;
          if (!row) throw notFound("Memory not found");
          return row;
        }),
  };
}
