import type { RequiredSystemPluginKey } from "../constants.js";

export type RequiredSystemPluginRuntimeStatus =
  | "ready"
  | "degraded"
  | "missing"
  | "installed";

export interface RequiredSystemPluginStatus {
  pluginKey: RequiredSystemPluginKey;
  packageName: string;
  displayName: string;
  required: true;
  pluginId: string | null;
  installed: boolean;
  runtimeStatus: RequiredSystemPluginRuntimeStatus;
  pluginStatus: string | null;
  companyEnabled: boolean | null;
  lastError: string | null;
  bootstrapError: string | null;
  updatedAt: Date | null;
}
