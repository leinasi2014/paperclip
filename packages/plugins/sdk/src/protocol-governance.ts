import type {
  CompanySkillCandidate,
  CompanySkillListItem,
  CompanySkillPromotionRequest,
  CreateCompanySkillPromotionRequest,
  ListSystemIssuesQuery,
  SystemIssue,
  UpsertCompanySkillCandidate,
} from "@paperclipai/shared";

declare module "./protocol.js" {
  interface WorkerToHostMethods {
    "systemIssues.list": [
      { companyId: string; filters?: ListSystemIssuesQuery },
      SystemIssue[],
    ];
    "systemIssues.get": [
      { systemIssueId: string; companyId: string },
      SystemIssue | null,
    ];
    "systemIssues.create": [
      {
        companyId: string;
        title: string;
        description?: string | null;
        priority?: SystemIssue["priority"];
        systemIssueType: SystemIssue["systemIssueType"];
        systemIssueSeverity: SystemIssue["systemIssueSeverity"];
        blockRecommended?: boolean;
      },
      SystemIssue,
    ];
    "systemIssues.setBlockRecommendation": [
      { systemIssueId: string; companyId: string; blockRecommended: boolean },
      SystemIssue,
    ];
    "companySkills.listApproved": [
      { companyId: string },
      CompanySkillListItem[],
    ];
    "companySkills.listCandidates": [
      { companyId: string },
      CompanySkillCandidate[],
    ];
    "companySkills.createOrUpdateCandidate": [
      { companyId: string; input: UpsertCompanySkillCandidate },
      CompanySkillCandidate,
    ];
    "companySkills.createPromotionRequest": [
      { companyId: string; input: CreateCompanySkillPromotionRequest },
      CompanySkillPromotionRequest,
    ];
    "companySkills.listPromotionRequests": [
      { companyId: string },
      CompanySkillPromotionRequest[],
    ];
  }
}

export {};
