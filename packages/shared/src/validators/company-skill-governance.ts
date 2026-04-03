import { z } from "zod";

export const upsertCompanySkillCandidateSchema = z.object({
  skillKey: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  markdown: z.string().min(1),
  metadata: z.record(z.unknown()).nullable().optional(),
}).strict();

export type UpsertCompanySkillCandidate = z.infer<typeof upsertCompanySkillCandidateSchema>;

export const createCompanySkillPromotionRequestSchema = z.object({
  candidateId: z.string().uuid(),
  note: z.string().trim().max(4000).nullable().optional(),
}).strict();

export type CreateCompanySkillPromotionRequest = z.infer<typeof createCompanySkillPromotionRequestSchema>;
