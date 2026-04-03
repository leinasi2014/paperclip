export type CompanySkillCandidateStatus = "candidate";

export type CompanySkillPromotionRequestStatus = "pending" | "approved" | "rejected";

export interface CompanySkillCandidate {
  id: string;
  companyId: string;
  sourcePluginKey: string;
  skillKey: string;
  slug: string;
  name: string;
  description: string | null;
  markdown: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanySkillPromotionRequest {
  id: string;
  companyId: string;
  candidateId: string;
  sourcePluginKey: string;
  status: CompanySkillPromotionRequestStatus;
  note: string | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
