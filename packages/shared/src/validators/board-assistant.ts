import { z } from "zod";
import {
  BOARD_ASSISTANT_AUTO_EXECUTION_MODES,
  BOARD_ASSISTANT_BUNDLE_KINDS,
  BOARD_ASSISTANT_CHANNEL_KINDS,
  BOARD_ASSISTANT_MEMORY_KINDS,
  BOARD_ASSISTANT_MEMORY_PROPOSAL_STATUSES,
  BOARD_ASSISTANT_MEMORY_STATUSES,
  BOARD_ASSISTANT_MEMORY_VISIBILITY_POLICIES,
  BOARD_ASSISTANT_REQUEST_STATUSES,
  BOARD_ASSISTANT_THREAD_KINDS,
  BOARD_ASSISTANT_THREAD_MODES,
} from "../constants.js";

export const boardAssistantSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  activeChannels: z.array(z.enum(BOARD_ASSISTANT_CHANNEL_KINDS)).default([]),
  staticCompanyGroups: z.array(z.object({
    groupKey: z.string().min(1),
    displayName: z.string().min(1),
    companyIds: z.array(z.string().uuid()).default([]),
    enabled: z.boolean().default(true),
  }).strict()).default([]),
  autoExecutionMode: z.enum(BOARD_ASSISTANT_AUTO_EXECUTION_MODES).default("manual_confirm"),
  allowProactiveBriefing: z.boolean().default(true),
  allowAllActiveCompaniesQueryGroup: z.boolean().default(false),
  bindingTokenTtlMinutes: z.number().int().positive().default(10),
  proposedTtlHours: z.number().int().positive().default(24),
  clarifyingTtlHours: z.number().int().positive().default(24),
  highSensitivityConfirmTtlHours: z.number().int().positive().default(24),
  ingressReplayWindowMinutes: z.number().int().positive().default(5),
  previousSecretGraceWindowMinutes: z.number().int().positive().default(60),
  outboxMaxRetries: z.number().int().positive().default(5),
  nudgeIntervalHours: z.number().int().positive().default(4),
  maxNudgesPerItem: z.number().int().positive().default(3),
}).strict();

export const patchBoardAssistantSettingsSchema = boardAssistantSettingsSchema.partial();

export const createBoardAssistantBindingSessionSchema = z.object({
  channel: z.enum(BOARD_ASSISTANT_CHANNEL_KINDS),
}).strict();

export const confirmBoardAssistantBindingSessionSchema = z.object({
  bindingSessionId: z.string().uuid().optional(),
}).strict().optional();

export const revokeBoardAssistantBindingSchema = z.object({
  bindingId: z.string().uuid(),
}).strict();

export const boardAssistantIngressSchema = z.object({
  channel: z.enum(BOARD_ASSISTANT_CHANNEL_KINDS),
  externalUserId: z.string().min(1),
  externalThreadId: z.string().min(1),
  externalMessageId: z.string().min(1),
  timestamp: z.string().min(1),
  messageText: z.string().default(""),
  normalizedPayload: z.record(z.string(), z.unknown()).default({}),
  ingressSignature: z.string().min(1),
  bindingToken: z.string().optional(),
  externalDisplayName: z.string().optional(),
}).strict();

export const boardAssistantRequestQuerySchema = z.object({
  status: z.enum(BOARD_ASSISTANT_REQUEST_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const confirmBoardAssistantRequestSchema = z.object({
  notes: z.string().optional(),
}).strict();

export const rejectBoardAssistantRequestSchema = z.object({
  reason: z.string().optional(),
}).strict();

export const boardAssistantMemoryQuerySchema = z.object({
  memoryKind: z.enum(BOARD_ASSISTANT_MEMORY_KINDS).optional(),
  status: z.enum(BOARD_ASSISTANT_MEMORY_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict();

export const boardAssistantMemoryProposalQuerySchema = z.object({
  memoryKind: z.enum(BOARD_ASSISTANT_MEMORY_KINDS).optional(),
  status: z.enum(BOARD_ASSISTANT_MEMORY_PROPOSAL_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict();

export const suppressBoardAssistantMemorySchema = z.object({
  suppress: z.boolean().default(true),
}).strict();

export const approveBoardAssistantMemoryProposalSchema = z.object({
  summaryOverride: z.string().min(1).optional(),
}).strict();

export const rejectBoardAssistantMemoryProposalSchema = z.object({
  reason: z.string().min(1).optional(),
}).strict();

export const boardAssistantThreadQuerySchema = z.object({
  threadKind: z.enum(BOARD_ASSISTANT_THREAD_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict();

export const boardAssistantThreadMessageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
}).strict();

export const updateBoardAssistantThreadModeSchema = z.object({
  mode: z.enum(BOARD_ASSISTANT_THREAD_MODES),
}).strict();

export const createBoardAssistantThreadMessageSchema = z.object({
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const boardAssistantOutboxAckSchema = z.object({
  sent: z.boolean().default(true),
}).strict();

export const boardAssistantBundleRevisionSchema = z.object({
  bundleKind: z.enum(BOARD_ASSISTANT_BUNDLE_KINDS),
  revisionLabel: z.string().min(1),
  content: z.string().min(1),
  isActive: z.boolean(),
  updatedBy: z.string().min(1),
  changeReason: z.string().nullable().optional(),
}).strict();

export const boardAssistantMemorySchema = z.object({
  memoryKind: z.enum(BOARD_ASSISTANT_MEMORY_KINDS),
  summary: z.string().min(1),
  sourceRefs: z.array(z.string()).default([]),
  confidence: z.number().int().min(0).max(100),
  visibilityPolicy: z.enum(BOARD_ASSISTANT_MEMORY_VISIBILITY_POLICIES),
  status: z.enum(BOARD_ASSISTANT_MEMORY_STATUSES),
}).strict();

export const boardAssistantMemoryProposalSchema = z.object({
  memoryKind: z.enum(BOARD_ASSISTANT_MEMORY_KINDS),
  summary: z.string().min(1),
  sourceRefs: z.array(z.string()).default([]),
  confidence: z.number().int().min(0).max(100),
  visibilityPolicy: z.enum(BOARD_ASSISTANT_MEMORY_VISIBILITY_POLICIES),
  status: z.enum(BOARD_ASSISTANT_MEMORY_PROPOSAL_STATUSES),
}).strict();

export type BoardAssistantSettingsInput = z.infer<typeof boardAssistantSettingsSchema>;
export type PatchBoardAssistantSettings = z.infer<typeof patchBoardAssistantSettingsSchema>;
export type CreateBoardAssistantBindingSession = z.infer<typeof createBoardAssistantBindingSessionSchema>;
export type ConfirmBoardAssistantBindingSession = z.infer<typeof confirmBoardAssistantBindingSessionSchema>;
export type RevokeBoardAssistantBinding = z.infer<typeof revokeBoardAssistantBindingSchema>;
export type BoardAssistantIngress = z.infer<typeof boardAssistantIngressSchema>;
export type BoardAssistantRequestQuery = z.infer<typeof boardAssistantRequestQuerySchema>;
export type ConfirmBoardAssistantRequest = z.infer<typeof confirmBoardAssistantRequestSchema>;
export type RejectBoardAssistantRequest = z.infer<typeof rejectBoardAssistantRequestSchema>;
export type BoardAssistantMemoryQuery = z.infer<typeof boardAssistantMemoryQuerySchema>;
export type BoardAssistantMemoryProposalQuery = z.infer<typeof boardAssistantMemoryProposalQuerySchema>;
export type SuppressBoardAssistantMemory = z.infer<typeof suppressBoardAssistantMemorySchema>;
export type ApproveBoardAssistantMemoryProposal = z.infer<typeof approveBoardAssistantMemoryProposalSchema>;
export type RejectBoardAssistantMemoryProposal = z.infer<typeof rejectBoardAssistantMemoryProposalSchema>;
export type BoardAssistantThreadQuery = z.infer<typeof boardAssistantThreadQuerySchema>;
export type BoardAssistantThreadMessageQuery = z.infer<typeof boardAssistantThreadMessageQuerySchema>;
export type UpdateBoardAssistantThreadMode = z.infer<typeof updateBoardAssistantThreadModeSchema>;
export type CreateBoardAssistantThreadMessage = z.infer<typeof createBoardAssistantThreadMessageSchema>;
export type BoardAssistantOutboxAck = z.infer<typeof boardAssistantOutboxAckSchema>;
