import type { Db } from "@paperclipai/db";
import type {
  BoardAssistantMemoryKind,
  BoardAssistantMemoryVisibilityPolicy,
} from "@paperclipai/shared";
import { createBoardAssistantMemoryProposalIfMissing } from "./board-assistant-memory.js";

type ProposalSeed = {
  memoryKind: BoardAssistantMemoryKind;
  summary: string;
  sourceRefs: string[];
  confidence: number;
  visibilityPolicy: BoardAssistantMemoryVisibilityPolicy;
};

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max = 160) {
  const normalized = compactWhitespace(value);
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function extractPreferenceSignals(messageText: string, sourceRef: string): ProposalSeed[] {
  const proposals: ProposalSeed[] = [];
  const addressMatch = messageText.match(/(?:叫我|称呼我|你可以叫我)\s*([^\s,，。!！?？]+)/u);
  if (addressMatch?.[1]) {
    proposals.push({
      memoryKind: "preference",
      summary: `Founder prefers to be addressed as ${addressMatch[1]}.`,
      sourceRefs: [sourceRef],
      confidence: 92,
      visibilityPolicy: "private_only",
    });
  }
  const preferencePatterns = [
    /(?:我喜欢|我更喜欢|我偏好)\s*(.+)$/u,
    /(?:请先|先给我|先告诉我)\s*(.+)$/u,
    /(?:我希望)\s*(.+)$/u,
  ];
  for (const pattern of preferencePatterns) {
    const matched = messageText.match(pattern);
    if (!matched?.[1]) continue;
    proposals.push({
      memoryKind: "preference",
      summary: `Founder preference: ${clip(matched[1])}`,
      sourceRefs: [sourceRef],
      confidence: 78,
      visibilityPolicy: "founder_reviewable",
    });
    break;
  }
  return proposals;
}

export function deriveBoardAssistantMemoryProposalSeeds(input: {
  messageText: string;
  sourceRef: string;
  interpretation?: {
    status?: string | null;
    summary?: string | null;
    intentKind?: string | null;
    targetKind?: string | null;
    targetLabel?: string | null;
  };
}) {
  const proposals = extractPreferenceSignals(input.messageText, input.sourceRef);
  if (input.interpretation?.status === "proposed" && input.interpretation.summary) {
    proposals.push({
      memoryKind: "working",
      summary: `Active founder task context: ${clip(input.interpretation.summary)}`,
      sourceRefs: [input.sourceRef],
      confidence: 73,
      visibilityPolicy: "founder_reviewable",
    });
  }
  if (input.interpretation?.targetKind === "company" && input.interpretation.targetLabel) {
    proposals.push({
      memoryKind: "working",
      summary: `Founder is currently coordinating work with ${input.interpretation.targetLabel}.`,
      sourceRefs: [input.sourceRef],
      confidence: 68,
      visibilityPolicy: "founder_reviewable",
    });
  }
  return proposals;
}

export async function persistBoardAssistantMemoryProposalSeeds(db: Db, proposals: ProposalSeed[]) {
  const created = [];
  for (const proposal of proposals) {
    const row = await createBoardAssistantMemoryProposalIfMissing(db, proposal);
    if (row) created.push(row);
  }
  return created;
}

export async function createOnboardingMemoryProposals(
  db: Db,
  input: {
    onboardingId: string;
    answers: Record<string, unknown>;
  },
) {
  const sourceRef = `onboarding:${input.onboardingId}`;
  const proposals: ProposalSeed[] = [];
  const founderName = String(input.answers.founder_name ?? "").trim();
  if (founderName) {
    proposals.push({
      memoryKind: "preference",
      summary: `Founder prefers to be addressed as ${founderName}.`,
      sourceRefs: [sourceRef],
      confidence: 95,
      visibilityPolicy: "private_only",
    });
  }
  const assistantStyle = String(input.answers.assistant_style ?? "").trim();
  if (assistantStyle) {
    proposals.push({
      memoryKind: "persona",
      summary: `Preferred assistant style: ${clip(assistantStyle)}`,
      sourceRefs: [sourceRef],
      confidence: 90,
      visibilityPolicy: "private_only",
    });
  }
  return persistBoardAssistantMemoryProposalSeeds(db, proposals);
}
