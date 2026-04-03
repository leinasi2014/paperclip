import type {
  SystemIssue,
  SystemIssueSeverity,
  SystemIssueType,
  SystemIssueWorkflowState,
} from "@paperclipai/shared";
import { api } from "./client";

export const systemIssuesApi = {
  list: (
    companyId: string,
    filters?: {
      type?: SystemIssueType;
      severity?: SystemIssueSeverity;
      workflowState?: SystemIssueWorkflowState;
      owningDepartmentId?: string;
      inCeoIntake?: boolean;
      blockRecommended?: boolean;
    },
  ) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.workflowState) params.set("workflowState", filters.workflowState);
    if (filters?.owningDepartmentId) params.set("owningDepartmentId", filters.owningDepartmentId);
    if (filters?.inCeoIntake !== undefined) params.set("inCeoIntake", String(filters.inCeoIntake));
    if (filters?.blockRecommended !== undefined) params.set("blockRecommended", String(filters.blockRecommended));
    const qs = params.toString();
    return api.get<SystemIssue[]>(`/companies/${companyId}/system-issues${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => api.get<SystemIssue>(`/system-issues/${id}`),
};
