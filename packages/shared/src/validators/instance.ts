import { z } from "zod";
import {
  BOARD_ASSISTANT_AUTO_EXECUTION_MODES,
  BOARD_ASSISTANT_CHANNEL_KINDS,
} from "../constants.js";

export const instanceGeneralSettingsSchema = z.object({
  censorUsernameInLogs: z.boolean().default(false),
}).strict();

export const patchInstanceGeneralSettingsSchema = instanceGeneralSettingsSchema.partial();

export const instanceExperimentalSettingsSchema = z.object({
  enableIsolatedWorkspaces: z.boolean().default(false),
  autoRestartDevServerWhenIdle: z.boolean().default(false),
}).strict();

export const patchInstanceExperimentalSettingsSchema = instanceExperimentalSettingsSchema.partial();

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

export type InstanceGeneralSettings = z.infer<typeof instanceGeneralSettingsSchema>;
export type PatchInstanceGeneralSettings = z.infer<typeof patchInstanceGeneralSettingsSchema>;
export type InstanceExperimentalSettings = z.infer<typeof instanceExperimentalSettingsSchema>;
export type PatchInstanceExperimentalSettings = z.infer<typeof patchInstanceExperimentalSettingsSchema>;
export type BoardAssistantSettings = z.infer<typeof boardAssistantSettingsSchema>;
export type PatchBoardAssistantSettings = z.infer<typeof patchBoardAssistantSettingsSchema>;
