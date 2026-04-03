import type {
  BuildSystemPluginRollbackCommand,
  CreateSystemPluginRollout,
  ExecuteSystemPluginRestartPath,
  ListSystemPluginRolloutsQuery,
  RecordSystemPluginRolloutApproval,
  SystemPluginRollout,
} from "@paperclipai/shared";
import { api } from "./client";

function buildQuery(query?: ListSystemPluginRolloutsQuery) {
  const params = new URLSearchParams();
  if (query?.pluginId) params.set("pluginId", query.pluginId);
  if (query?.pluginKey) params.set("pluginKey", query.pluginKey);
  if (query?.status) params.set("status", query.status);
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.offset) params.set("offset", String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const systemPluginRolloutsApi = {
  list: (query?: ListSystemPluginRolloutsQuery) =>
    api.get<SystemPluginRollout[]>(`/system-plugin-rollouts${buildQuery(query)}`),

  get: (id: string) => api.get<SystemPluginRollout>(`/system-plugin-rollouts/${id}`),

  create: (body: CreateSystemPluginRollout) =>
    api.post<SystemPluginRollout>("/system-plugin-rollouts", body),

  recordApproval: (id: string, body: RecordSystemPluginRolloutApproval) =>
    api.post<SystemPluginRollout>(`/system-plugin-rollouts/${id}/approvals`, body),

  executeRestartPath: (id: string, body: ExecuteSystemPluginRestartPath = {}) =>
    api.post<SystemPluginRollout>(`/system-plugin-rollouts/${id}/restart-path`, body),

  buildRollbackCommand: (id: string, body: BuildSystemPluginRollbackCommand = {}) =>
    api.post<SystemPluginRollout>(`/system-plugin-rollouts/${id}/rollback-command`, body),
};
