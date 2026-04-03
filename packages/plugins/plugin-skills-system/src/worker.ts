import { createHash } from "node:crypto";
import { definePlugin, runWorker, type PluginEvent } from "@paperclipai/plugin-sdk";

type SkillSupportRequestPayload = {
  companyId?: string;
  fingerprint?: string;
  sourceEventType?: string;
  sourceEntityId?: string | null;
  sourceEntityType?: string | null;
  sourceSeverity?: string;
  sourceIssueId?: string;
  sourceIssueTitle?: string;
  sourceIssueType?: string;
  summary?: string;
  suggestedSkillKey?: string;
  markdown?: string;
  name?: string;
  description?: string;
};

type SkillRollup = {
  totalRequests: number;
  lastRequestAt: string | null;
  lastCandidateId: string | null;
  fingerprints: Record<string, { count: number; candidateId: string | null; lastSeenAt: string }>;
};

type SkillState = {
  version: 1;
  companies: Record<string, SkillRollup>;
};

const STATE_NAMESPACE = "governance";
const STATE_KEY = "skills-system-rollup";
const SKILL_REQUEST_EVENT = "plugin.paperclip.execution-improvement.skill-support-requested";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80) || "skill-candidate";
}

function fingerprintFor(payload: SkillSupportRequestPayload, event: PluginEvent): string {
  const hash = createHash("sha256");
  hash.update(String(payload.fingerprint ?? ""));
  hash.update("|");
  hash.update(String(payload.sourceIssueId ?? event.entityId ?? ""));
  hash.update("|");
  hash.update(String(payload.sourceEventType ?? event.eventType));
  hash.update("|");
  hash.update(String(payload.summary ?? ""));
  return hash.digest("hex").slice(0, 24);
}

function buildCandidateMarkdown(payload: SkillSupportRequestPayload, fingerprint: string): string {
  return [
    `# Skill candidate`,
    "",
    `- fingerprint: ${fingerprint}`,
    `- sourceEventType: ${payload.sourceEventType ?? ""}`,
    `- sourceIssueId: ${payload.sourceIssueId ?? ""}`,
    `- sourceIssueType: ${payload.sourceIssueType ?? ""}`,
    `- sourceSeverity: ${payload.sourceSeverity ?? ""}`,
    "",
    payload.summary ?? payload.description ?? payload.markdown ?? "Generated from execution incident telemetry.",
  ].join("\n");
}

function buildCandidateName(payload: SkillSupportRequestPayload): string {
  return payload.name
    ?? payload.sourceIssueTitle
    ?? payload.summary
    ?? "Generated skill candidate";
}

function buildCandidateDescription(payload: SkillSupportRequestPayload): string {
  return payload.description
    ?? payload.summary
    ?? "Generated from execution improvement telemetry";
}

const plugin = definePlugin({
  async setup(ctx) {
    const handleSkillRequest = async (event: PluginEvent) => {
      const payload = isRecord(event.payload) ? (event.payload as SkillSupportRequestPayload) : {};
      const companyId = asString(payload.companyId) ?? asString(event.companyId);
      if (!companyId) return;

      const fingerprint = fingerprintFor(payload, event);
      const skillKey = asString(payload.suggestedSkillKey) ?? `skill-${fingerprint.slice(0, 12)}`;
      const candidate = await ctx.companySkills.createOrUpdateCandidate(companyId, {
        skillKey,
        slug: slugify(skillKey),
        name: buildCandidateName(payload),
        description: buildCandidateDescription(payload),
        markdown: buildCandidateMarkdown(payload, fingerprint),
        metadata: {
          fingerprint,
          sourceEventType: payload.sourceEventType ?? event.eventType,
          sourceEntityId: payload.sourceEntityId ?? event.entityId ?? null,
          sourceEntityType: payload.sourceEntityType ?? event.entityType ?? null,
          sourceSeverity: payload.sourceSeverity ?? null,
          sourceIssueId: payload.sourceIssueId ?? null,
          sourceIssueType: payload.sourceIssueType ?? null,
        },
      });

      const approvedSkills = await ctx.companySkills.listApproved(companyId);
      const alreadyApproved = approvedSkills.some((skill) => skill.key === candidate.skillKey);
      if (!alreadyApproved) {
        await ctx.companySkills.createPromotionRequest(companyId, {
          candidateId: candidate.id,
          note: `Generated from ${payload.sourceEventType ?? event.eventType}`,
        });
      }

      const state = (await ctx.state.get({
        scopeKind: "company",
        scopeId: companyId,
        namespace: STATE_NAMESPACE,
        stateKey: STATE_KEY,
      })) as SkillState | null;

      const rollup: SkillState = state && typeof state === "object"
        ? state
        : { version: 1, companies: {} };
      const companyRollup = rollup.companies[companyId] ?? {
        totalRequests: 0,
        lastRequestAt: null,
        lastCandidateId: null,
        fingerprints: {},
      };
      const current = companyRollup.fingerprints[fingerprint] ?? {
        count: 0,
        candidateId: null,
        lastSeenAt: event.occurredAt,
      };

      current.count += 1;
      current.candidateId = candidate.id;
      current.lastSeenAt = event.occurredAt;
      companyRollup.totalRequests += 1;
      companyRollup.lastRequestAt = event.occurredAt;
      companyRollup.lastCandidateId = candidate.id;
      companyRollup.fingerprints[fingerprint] = current;
      rollup.companies[companyId] = companyRollup;

      await ctx.state.set({
        scopeKind: "company",
        scopeId: companyId,
        namespace: STATE_NAMESPACE,
        stateKey: STATE_KEY,
      }, rollup);

      ctx.logger.info("Registered skill candidate from execution incident", {
        companyId,
        fingerprint,
        candidateId: candidate.id,
        skillKey: candidate.skillKey,
      });
    };

    ctx.events.on(SKILL_REQUEST_EVENT, handleSkillRequest);
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Skills system worker is running",
    };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
