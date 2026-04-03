import { createHash } from "node:crypto";
import { definePlugin, runWorker, type PluginEvent } from "@paperclipai/plugin-sdk";
import { SYSTEM_ISSUE_SEVERITIES, SYSTEM_ISSUE_TYPES, type SystemIssue } from "@paperclipai/shared";

type Severity = (typeof SYSTEM_ISSUE_SEVERITIES)[number];
type IssueType = (typeof SYSTEM_ISSUE_TYPES)[number];

type IncidentEntry = {
  count: number;
  lastSeenAt: string;
  lastEventType: string;
  lastSummary: string;
  lastSeverity: Severity;
  lastType: IssueType;
  systemIssueId: string | null;
  skillSupportRequestedAt: string | null;
};

type CompanyRollup = {
  totalEvents: number;
  lastEventAt: string | null;
  incidents: Record<string, IncidentEntry>;
};

type ExecutionState = {
  version: 1;
  companies: Record<string, CompanyRollup>;
};

const STATE_NAMESPACE = "governance";
const STATE_KEY = "execution-improvement-rollup";
const SKILL_REQUEST_EVENT = "skill-support-requested";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPayloadText(payload: Record<string, unknown>): string {
  return [
    asString(payload.title),
    asString(payload.description),
    asString(payload.message),
    asString(payload.notes),
    asString(payload.summary),
    asString(payload.reason),
    asString(payload.identifier),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function fingerprintFor(event: PluginEvent, payload: Record<string, unknown>): string {
  const hash = createHash("sha256");
  hash.update(String(event.eventType));
  hash.update("|");
  hash.update(String(event.entityType ?? ""));
  hash.update("|");
  hash.update(String(event.entityId ?? ""));
  hash.update("|");
  hash.update(getPayloadText(payload));
  return hash.digest("hex").slice(0, 24);
}

function classifyIssueType(event: PluginEvent, payload: Record<string, unknown>): IssueType {
  if (event.eventType.startsWith("department.")) return "governance";
  if (event.eventType.startsWith("system_issue.")) return "governance";

  const text = getPayloadText(payload);
  if (text.includes("skill") || text.includes("knowledge") || text.includes("template") || text.includes("prompt")) {
    return "skill";
  }
  if (text.includes("permission") || text.includes("budget") || text.includes("policy") || text.includes("governance")) {
    return "governance";
  }
  return "execution";
}

function classifySeverity(event: PluginEvent, payload: Record<string, unknown>): Severity {
  const text = getPayloadText(payload);
  const explicit = asString(payload.systemIssueSeverity);
  if (explicit && SYSTEM_ISSUE_SEVERITIES.includes(explicit as Severity)) return explicit as Severity;

  if (
    event.eventType === "department.frozen" ||
    payload.blockRecommended === true ||
    payload.priority === "critical" ||
    text.includes("fatal") ||
    text.includes("critical")
  ) {
    return "critical";
  }

  if (
    payload.priority === "high" ||
    text.includes("blocked") ||
    text.includes("error") ||
    text.includes("failure") ||
    text.includes("crash") ||
    text.includes("timeout") ||
    text.includes("permission")
  ) {
    return "high";
  }

  if (text.includes("note") || text.includes("warning")) {
    return "low";
  }

  return "medium";
}

function buildSummary(event: PluginEvent, payload: Record<string, unknown>): { title: string; description: string } {
  const title = asString(payload.title) ?? asString(payload.message) ?? `${event.eventType} incident`;
  const description = [
    `Event: ${event.eventType}`,
    event.entityType ? `Entity: ${event.entityType}` : null,
    event.entityId ? `Entity ID: ${event.entityId}` : null,
    asString(payload.description) ? `Description: ${asString(payload.description)}` : null,
    asString(payload.reason) ? `Reason: ${asString(payload.reason)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return { title, description };
}

function skillRequestPayload(input: {
  companyId: string;
  fingerprint: string;
  event: PluginEvent;
  issueId: string;
  issueTitle: string;
  issueType: IssueType;
  severity: Severity;
  summary: string;
}) {
  return {
    companyId: input.companyId,
    fingerprint: input.fingerprint,
    sourceEventType: input.event.eventType,
    sourceEntityId: input.event.entityId ?? null,
    sourceEntityType: input.event.entityType ?? null,
    sourceSeverity: input.severity,
    sourceIssueId: input.issueId,
    sourceIssueTitle: input.issueTitle,
    sourceIssueType: input.issueType,
    summary: input.summary,
    suggestedSkillKey: `skill-${input.fingerprint.slice(0, 12)}`,
    markdown: [
      `# Skill support request`,
      "",
      `- companyId: ${input.companyId}`,
      `- fingerprint: ${input.fingerprint}`,
      `- eventType: ${input.event.eventType}`,
      `- severity: ${input.severity}`,
      `- issueId: ${input.issueId}`,
      `- issueTitle: ${input.issueTitle}`,
      `- issueType: ${input.issueType}`,
      "",
      input.summary,
    ].join("\n"),
    name: input.issueTitle,
    description: input.summary,
  };
}

export type ExecutionImprovementSkillRequest = ReturnType<typeof skillRequestPayload>;

const plugin = definePlugin({
  async setup(ctx) {
    const recordEvent = async (event: PluginEvent) => {
      if (!event.companyId) return;
      if (typeof event.eventType === "string" && event.eventType.startsWith("plugin.paperclip.execution-improvement.")) {
        return;
      }

      const payload = isRecord(event.payload) ? event.payload : {};
      const state = (await ctx.state.get({
        scopeKind: "company",
        scopeId: event.companyId,
        namespace: STATE_NAMESPACE,
        stateKey: STATE_KEY,
      })) as ExecutionState | null;

      const rollup: ExecutionState = state && typeof state === "object"
        ? state
        : { version: 1, companies: {} };
      const companyRollup = rollup.companies[event.companyId] ?? {
        totalEvents: 0,
        lastEventAt: null,
        incidents: {},
      };

      const fingerprint = fingerprintFor(event, payload);
      const incident = companyRollup.incidents[fingerprint] ?? {
        count: 0,
        lastSeenAt: event.occurredAt,
        lastEventType: event.eventType,
        lastSummary: "",
        lastSeverity: "medium",
        lastType: "execution",
        systemIssueId: null,
        skillSupportRequestedAt: null,
      };

      incident.count += 1;
      incident.lastSeenAt = event.occurredAt;
      incident.lastEventType = event.eventType;
      incident.lastType = classifyIssueType(event, payload);
      incident.lastSeverity = classifySeverity(event, payload);

      const summary = buildSummary(event, payload);
      incident.lastSummary = summary.description;

      const shouldOpenSystemIssue =
        incident.lastSeverity === "critical" ||
        (incident.lastSeverity === "high" && incident.count >= 2) ||
        incident.lastType === "governance" ||
        (incident.lastType === "skill" && incident.count >= 1);

      if (!incident.systemIssueId && shouldOpenSystemIssue) {
        const created = await ctx.systemIssues.create({
          companyId: event.companyId,
          title: summary.title,
          description: summary.description,
          priority: incident.lastSeverity === "critical" ? "high" : "medium",
          systemIssueType: incident.lastType,
          systemIssueSeverity: incident.lastSeverity,
          blockRecommended: incident.lastSeverity === "critical" || incident.lastType === "governance",
        });
        incident.systemIssueId = created.id;
        ctx.logger.info("Created execution system issue", {
          companyId: event.companyId,
          fingerprint,
          systemIssueId: created.id,
          severity: incident.lastSeverity,
          type: incident.lastType,
        });
      } else if (incident.systemIssueId && incident.lastSeverity === "critical") {
        const existing = await ctx.systemIssues.get(incident.systemIssueId, event.companyId);
        if (existing && !existing.blockRecommended) {
          await ctx.systemIssues.setBlockRecommendation(incident.systemIssueId, event.companyId, true);
        }
      }

      if (incident.lastType === "skill" && !incident.skillSupportRequestedAt && incident.systemIssueId) {
        await ctx.events.emit(SKILL_REQUEST_EVENT, event.companyId, skillRequestPayload({
          companyId: event.companyId,
          fingerprint,
          event,
          issueId: incident.systemIssueId,
          issueTitle: summary.title,
          issueType: incident.lastType,
          severity: incident.lastSeverity,
          summary: summary.description,
        }));
        incident.skillSupportRequestedAt = event.occurredAt;
      }

      companyRollup.totalEvents += 1;
      companyRollup.lastEventAt = event.occurredAt;
      companyRollup.incidents[fingerprint] = incident;
      rollup.companies[event.companyId] = companyRollup;

      await ctx.state.set({
        scopeKind: "company",
        scopeId: event.companyId,
        namespace: STATE_NAMESPACE,
        stateKey: STATE_KEY,
      }, rollup);
    };

    ctx.events.on("issue.created", recordEvent);
    ctx.events.on("issue.updated", recordEvent);
    ctx.events.on("issue.comment.created", recordEvent);
    ctx.events.on("system_issue.created", recordEvent);
    ctx.events.on("system_issue.updated", recordEvent);
    ctx.events.on("department.created", recordEvent);
    ctx.events.on("department.updated", recordEvent);
    ctx.events.on("department.frozen", recordEvent);
    ctx.events.on("department.unfrozen", recordEvent);
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Execution improvement worker is running",
    };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
