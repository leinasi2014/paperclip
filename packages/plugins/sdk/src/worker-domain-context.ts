import type { AgentSessionEvent, PluginContext } from "./types.js";
import type { WorkerToHostMethodName, WorkerToHostMethods } from "./protocol.js";
import "./protocol-governance.js";
import "./types-governance.js";

type CallHost = <M extends WorkerToHostMethodName>(
  method: M,
  params: WorkerToHostMethods[M][0],
  timeoutMs?: number,
) => Promise<WorkerToHostMethods[M][1]>;

type BuildDomainContextClientsOptions = {
  callHost: CallHost;
  sessionEventCallbacks: Map<string, (event: AgentSessionEvent) => void>;
};

export function buildDomainContextClients(
  options: BuildDomainContextClientsOptions,
): Pick<
  PluginContext,
  "projects" | "companies" | "issues" | "agents" | "goals" | "systemIssues" | "companySkills"
> {
  const { callHost, sessionEventCallbacks } = options;

  return {
    projects: {
      async list(input) {
        return callHost("projects.list", {
          companyId: input.companyId,
          limit: input.limit,
          offset: input.offset,
        });
      },
      async get(projectId: string, companyId: string) {
        return callHost("projects.get", { projectId, companyId });
      },
      async listWorkspaces(projectId: string, companyId: string) {
        return callHost("projects.listWorkspaces", { projectId, companyId });
      },
      async getPrimaryWorkspace(projectId: string, companyId: string) {
        return callHost("projects.getPrimaryWorkspace", { projectId, companyId });
      },
      async getWorkspaceForIssue(issueId: string, companyId: string) {
        return callHost("projects.getWorkspaceForIssue", { issueId, companyId });
      },
    },

    companies: {
      async list(input) {
        return callHost("companies.list", {
          limit: input?.limit,
          offset: input?.offset,
        });
      },
      async get(companyId: string) {
        return callHost("companies.get", { companyId });
      },
    },

    issues: {
      async list(input) {
        return callHost("issues.list", {
          companyId: input.companyId,
          projectId: input.projectId,
          assigneeAgentId: input.assigneeAgentId,
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        });
      },
      async get(issueId: string, companyId: string) {
        return callHost("issues.get", { issueId, companyId });
      },
      async create(input) {
        return callHost("issues.create", {
          companyId: input.companyId,
          projectId: input.projectId,
          goalId: input.goalId,
          parentId: input.parentId,
          inheritExecutionWorkspaceFromIssueId: input.inheritExecutionWorkspaceFromIssueId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assigneeAgentId: input.assigneeAgentId,
        });
      },
      async update(issueId: string, patch, companyId: string) {
        return callHost("issues.update", {
          issueId,
          patch: patch as Record<string, unknown>,
          companyId,
        });
      },
      async listComments(issueId: string, companyId: string) {
        return callHost("issues.listComments", { issueId, companyId });
      },
      async createComment(issueId: string, body: string, companyId: string) {
        return callHost("issues.createComment", { issueId, body, companyId });
      },
      documents: {
        async list(issueId: string, companyId: string) {
          return callHost("issues.documents.list", { issueId, companyId });
        },
        async get(issueId: string, key: string, companyId: string) {
          return callHost("issues.documents.get", { issueId, key, companyId });
        },
        async upsert(input) {
          return callHost("issues.documents.upsert", {
            issueId: input.issueId,
            key: input.key,
            body: input.body,
            companyId: input.companyId,
            title: input.title,
            format: input.format,
            changeSummary: input.changeSummary,
          });
        },
        async delete(issueId: string, key: string, companyId: string) {
          return callHost("issues.documents.delete", { issueId, key, companyId });
        },
      },
    },

    agents: {
      async list(input) {
        return callHost("agents.list", {
          companyId: input.companyId,
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        });
      },
      async get(agentId: string, companyId: string) {
        return callHost("agents.get", { agentId, companyId });
      },
      async pause(agentId: string, companyId: string) {
        return callHost("agents.pause", { agentId, companyId });
      },
      async resume(agentId: string, companyId: string) {
        return callHost("agents.resume", { agentId, companyId });
      },
      async invoke(agentId: string, companyId: string, opts: { prompt: string; reason?: string }) {
        return callHost("agents.invoke", {
          agentId,
          companyId,
          prompt: opts.prompt,
          reason: opts.reason,
        });
      },
      sessions: {
        async create(agentId: string, companyId: string, opts?: { taskKey?: string; reason?: string }) {
          return callHost("agents.sessions.create", {
            agentId,
            companyId,
            taskKey: opts?.taskKey,
            reason: opts?.reason,
          });
        },
        async list(agentId: string, companyId: string) {
          return callHost("agents.sessions.list", { agentId, companyId });
        },
        async sendMessage(
          sessionId: string,
          companyId: string,
          opts: { prompt: string; reason?: string; onEvent?: (event: AgentSessionEvent) => void },
        ) {
          if (opts.onEvent) {
            sessionEventCallbacks.set(sessionId, opts.onEvent);
          }
          try {
            return await callHost("agents.sessions.sendMessage", {
              sessionId,
              companyId,
              prompt: opts.prompt,
              reason: opts.reason,
            });
          } catch (error) {
            sessionEventCallbacks.delete(sessionId);
            throw error;
          }
        },
        async close(sessionId: string, companyId: string) {
          sessionEventCallbacks.delete(sessionId);
          await callHost("agents.sessions.close", { sessionId, companyId });
        },
      },
    },

    goals: {
      async list(input) {
        return callHost("goals.list", {
          companyId: input.companyId,
          level: input.level,
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        });
      },
      async get(goalId: string, companyId: string) {
        return callHost("goals.get", { goalId, companyId });
      },
      async create(input) {
        return callHost("goals.create", {
          companyId: input.companyId,
          title: input.title,
          description: input.description,
          level: input.level,
          status: input.status,
          parentId: input.parentId,
          ownerAgentId: input.ownerAgentId,
        });
      },
      async update(goalId: string, patch, companyId: string) {
        return callHost("goals.update", {
          goalId,
          patch: patch as Record<string, unknown>,
          companyId,
        });
      },
    },

    systemIssues: {
      async list(input) {
        return callHost("systemIssues.list", {
          companyId: input.companyId,
          filters: input.filters,
        });
      },
      async get(systemIssueId: string, companyId: string) {
        return callHost("systemIssues.get", { systemIssueId, companyId });
      },
      async create(input) {
        return callHost("systemIssues.create", input);
      },
      async setBlockRecommendation(systemIssueId: string, companyId: string, blockRecommended: boolean) {
        return callHost("systemIssues.setBlockRecommendation", {
          systemIssueId,
          companyId,
          blockRecommended,
        });
      },
    },

    companySkills: {
      async listApproved(companyId: string) {
        return callHost("companySkills.listApproved", { companyId });
      },
      async listCandidates(companyId: string) {
        return callHost("companySkills.listCandidates", { companyId });
      },
      async createOrUpdateCandidate(companyId: string, input) {
        return callHost("companySkills.createOrUpdateCandidate", { companyId, input });
      },
      async createPromotionRequest(companyId: string, input) {
        return callHost("companySkills.createPromotionRequest", { companyId, input });
      },
      async listPromotionRequests(companyId: string) {
        return callHost("companySkills.listPromotionRequests", { companyId });
      },
    },
  };
}
