import { z } from "zod";
import {
  REQUIRED_SYSTEM_PLUGIN_KEYS,
  SYSTEM_PLUGIN_ROLLOUT_APPROVAL_DECISIONS,
  SYSTEM_PLUGIN_ROLLOUT_STATUSES,
} from "../constants.js";

const pluginReferenceObjectSchema = z
  .object({
    pluginId: z.string().uuid().optional(),
    pluginKey: z.enum(REQUIRED_SYSTEM_PLUGIN_KEYS).optional(),
  });

const pluginReferenceSchema = pluginReferenceObjectSchema.refine(
  (value) => Boolean(value.pluginId) !== Boolean(value.pluginKey),
  {
    message: "Exactly one of pluginId or pluginKey is required",
    path: ["pluginId"],
  },
);

const optionalNoteSchema = z.string().trim().max(4000).nullable().optional();

export const createSystemPluginRolloutSchema = pluginReferenceObjectSchema.extend({
  candidateVersion: z.string().trim().min(1).max(200).nullable().optional(),
  candidateMetadata: z.record(z.unknown()).optional().default({}),
  note: optionalNoteSchema,
}).refine((value) => Boolean(value.pluginId) !== Boolean(value.pluginKey), {
  message: "Exactly one of pluginId or pluginKey is required",
  path: ["pluginId"],
});
export type CreateSystemPluginRollout = z.infer<typeof createSystemPluginRolloutSchema>;

export const listSystemPluginRolloutsQuerySchema = z.object({
  pluginId: z.string().uuid().optional(),
  pluginKey: z.enum(REQUIRED_SYSTEM_PLUGIN_KEYS).optional(),
  status: z.enum(SYSTEM_PLUGIN_ROLLOUT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListSystemPluginRolloutsQuery = z.infer<typeof listSystemPluginRolloutsQuerySchema>;

export const recordSystemPluginRolloutApprovalSchema = z.object({
  decision: z.enum(SYSTEM_PLUGIN_ROLLOUT_APPROVAL_DECISIONS),
  note: optionalNoteSchema,
});
export type RecordSystemPluginRolloutApproval = z.infer<
  typeof recordSystemPluginRolloutApprovalSchema
>;

export const executeSystemPluginRestartPathSchema = z.object({});
export type ExecuteSystemPluginRestartPath = z.infer<
  typeof executeSystemPluginRestartPathSchema
>;

export const buildSystemPluginRollbackCommandSchema = z.object({});
export type BuildSystemPluginRollbackCommand = z.infer<
  typeof buildSystemPluginRollbackCommandSchema
>;
