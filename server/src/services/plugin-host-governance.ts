import type { Db } from "@paperclipai/db";
import type { HostServices } from "@paperclipai/plugin-sdk";
import { companySkillGovernanceService } from "./company-skill-governance.js";
import { systemIssueService } from "./system-issues.js";

type BuildPluginGovernanceHostServicesOptions = {
  db: Db;
  pluginKey: string;
  ensurePluginAvailableForCompany: (companyId: string) => Promise<void>;
};

export function buildPluginGovernanceHostServices(
  options: BuildPluginGovernanceHostServicesOptions,
): Pick<HostServices, "systemIssues" | "companySkills"> {
  const { db, pluginKey, ensurePluginAvailableForCompany } = options;
  const systemIssues = systemIssueService(db);
  const companySkillGovernance = companySkillGovernanceService(db);

  return {
    systemIssues: {
      async list(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        return systemIssues.list(params.companyId, params.filters ?? {});
      },
      async get(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        const issue = await systemIssues.getById(params.systemIssueId);
        if (!issue || issue.companyId !== params.companyId) return null;
        return issue;
      },
      async create(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        return systemIssues.create(params.companyId, params);
      },
      async setBlockRecommendation(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        const issue = await systemIssues.getById(params.systemIssueId);
        if (!issue || issue.companyId !== params.companyId) {
          throw new Error("System issue not found");
        }
        return systemIssues.setBlockRecommendation(params.systemIssueId, params.blockRecommended);
      },
    },

    companySkills: {
      async listApproved(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        return companySkillGovernance.listApproved(params.companyId);
      },
      async listCandidates(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        return companySkillGovernance.listCandidates(params.companyId);
      },
      async createOrUpdateCandidate(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        return companySkillGovernance.createOrUpdateCandidate(
          params.companyId,
          pluginKey,
          params.input,
        );
      },
      async createPromotionRequest(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        return companySkillGovernance.createPromotionRequest(
          params.companyId,
          pluginKey,
          params.input,
        );
      },
      async listPromotionRequests(params) {
        await ensurePluginAvailableForCompany(params.companyId);
        return companySkillGovernance.listPromotionRequests(params.companyId);
      },
    },
  };
}
