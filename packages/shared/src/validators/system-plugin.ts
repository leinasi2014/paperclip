import { z } from "zod";

export const reconcileRequiredSystemPluginsSchema = z.object({}).strict();

export type ReconcileRequiredSystemPlugins = z.infer<typeof reconcileRequiredSystemPluginsSchema>;
