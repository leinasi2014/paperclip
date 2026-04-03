import type {
  CompanySkillCandidate,
  CompanySkillListItem,
  CompanySkillPromotionRequest,
  CreateCompanySkillPromotionRequest,
  ListSystemIssuesQuery,
  SystemIssue,
  UpsertCompanySkillCandidate,
} from "@paperclipai/shared";

export interface PluginSystemIssuesClient {
  list(input: { companyId: string; filters?: ListSystemIssuesQuery }): Promise<SystemIssue[]>;
  get(systemIssueId: string, companyId: string): Promise<SystemIssue | null>;
  create(input: {
    companyId: string;
    title: string;
    description?: string | null;
    priority?: SystemIssue["priority"];
    systemIssueType: SystemIssue["systemIssueType"];
    systemIssueSeverity: SystemIssue["systemIssueSeverity"];
    blockRecommended?: boolean;
  }): Promise<SystemIssue>;
  setBlockRecommendation(systemIssueId: string, companyId: string, blockRecommended: boolean): Promise<SystemIssue>;
}

export interface PluginCompanySkillsClient {
  listApproved(companyId: string): Promise<CompanySkillListItem[]>;
  listCandidates(companyId: string): Promise<CompanySkillCandidate[]>;
  createOrUpdateCandidate(
    companyId: string,
    input: UpsertCompanySkillCandidate,
  ): Promise<CompanySkillCandidate>;
  createPromotionRequest(
    companyId: string,
    input: CreateCompanySkillPromotionRequest,
  ): Promise<CompanySkillPromotionRequest>;
  listPromotionRequests(companyId: string): Promise<CompanySkillPromotionRequest[]>;
}

declare module "./types.js" {
  interface PluginContext {
    systemIssues: PluginSystemIssuesClient;
    companySkills: PluginCompanySkillsClient;
  }
}
