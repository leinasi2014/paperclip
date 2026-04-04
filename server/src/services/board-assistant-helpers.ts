import fs from "node:fs/promises";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  boardAssistantBundleRevisions,
  boardAssistantThreads,
  companies,
  heartbeatRuns,
  issues,
} from "@paperclipai/db";
import type {
  BoardAssistantBundleKind,
  BoardAssistantAutoExecutionMode,
  BoardAssistantIngress,
  BoardAssistantRequestStatus,
} from "@paperclipai/shared";
import { BOARD_ASSISTANT_BUNDLE_KINDS } from "@paperclipai/shared";
import { forbidden, notFound } from "../errors.js";

export const ACTIVE_BINDING_SESSION_STATUSES = ["pending_channel_handshake", "pending_web_confirm"] as const;
export const ACTIVE_REQUEST_STATUSES: BoardAssistantRequestStatus[] = ["received", "clarifying", "proposed", "blocked"];
export const TERMINAL_REQUEST_STATUSES: BoardAssistantRequestStatus[] = ["cancelled", "expired", "done", "failed"];
export const ONBOARDING_STEP_KEYS = [
  "assistant_name",
  "founder_name",
  "assistant_style",
  "auto_execution",
  "proactive_briefing",
] as const;

type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];
type StaticCompanyGroup = {
  groupKey: string;
  displayName: string;
  companyIds: string[];
  enabled: boolean;
};

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function bodyHashForIngress(input: Pick<BoardAssistantIngress, "messageText" | "normalizedPayload">) {
  return hashValue(JSON.stringify({
    messageText: input.messageText ?? "",
    normalizedPayload: input.normalizedPayload ?? {},
  }));
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

export function buildSigningPayload(input: BoardAssistantIngress) {
  return [
    input.channel,
    input.externalUserId,
    input.externalThreadId,
    input.externalMessageId,
    input.timestamp,
    bodyHashForIngress(input),
  ].join(":");
}

function getChannelSecrets(channel: string, previousSecretGraceWindowMinutes: number, now = new Date()) {
  const active = process.env[`BOARD_ASSISTANT_CHANNEL_SECRET_${channel.toUpperCase()}`];
  const previous = process.env[`BOARD_ASSISTANT_CHANNEL_PREVIOUS_SECRET_${channel.toUpperCase()}`];
  const rotatedAtRaw = process.env[`BOARD_ASSISTANT_CHANNEL_PREVIOUS_SECRET_ROTATED_AT_${channel.toUpperCase()}`];
  const candidates = [active].filter((value): value is string => Boolean(value));
  if (!previous) return candidates;
  if (!rotatedAtRaw) return candidates;
  const rotatedAtMs = Date.parse(rotatedAtRaw);
  if (Number.isNaN(rotatedAtMs)) return candidates;
  if (now.getTime() - rotatedAtMs > previousSecretGraceWindowMinutes * 60 * 1000) return candidates;
  candidates.push(previous);
  return candidates;
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function parseTruthyText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return ["yes", "y", "true", "on", "1", "是", "开", "开启", "允许"].includes(normalized);
}

export function parseAutoExecutionMode(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.includes("增强")) return "enhanced_auto" as const;
  if (normalized.includes("低风险") || normalized.includes("自动")) return "low_risk_auto" as const;
  return "manual_confirm" as const;
}

export function onboardingPrompt(step: number) {
  switch (step) {
    case 1:
      return "先给我一个你希望助理使用的名字。";
    case 2:
      return "你希望助理怎么称呼你？";
    case 3:
      return "你偏好的助理风格是什么？可以直接用一句话描述。";
    case 4:
      return "是否开启自动执行？可回答：关闭、低风险自动、增强自动。";
    case 5:
      return "是否允许主动提醒与关键事件简报？";
    default:
      return "初始化已完成。";
  }
}

export function nextOnboardingStep(currentStep: number) {
  if (currentStep >= ONBOARDING_STEP_KEYS.length) return null;
  return currentStep + 1;
}

export function currentOnboardingKey(currentStep: number): OnboardingStepKey | null {
  return ONBOARDING_STEP_KEYS[currentStep - 1] ?? null;
}

async function readAssistantTemplate(bundleKind: BoardAssistantBundleKind) {
  const fileName = bundleKind === "soul"
    ? "SOUL.md"
    : bundleKind === "agents"
      ? "AGENTS.md"
      : bundleKind === "heartbeat"
        ? "HEARTBEAT.md"
        : "TOOLS.md";
  const fileUrl = new URL(`../onboarding-assets/assistant/${fileName}`, import.meta.url);
  return fs.readFile(fileUrl, "utf8");
}

export function buildSoulRevision(base: string, answers: Record<string, unknown>) {
  const assistantName = String(answers.assistant_name ?? "未命名助理").replace(/\s+/g, " ").trim();
  const founderName = String(answers.founder_name ?? "Founder").replace(/\s+/g, " ").trim();
  const style = String(answers.assistant_style ?? "简洁、短而准、偏幕僚型").replace(/\s+/g, " ").trim();
  const autoExecutionMode = parseAutoExecutionMode(String(answers.auto_execution ?? ""));
  const allowProactiveBriefing = parseTruthyText(String(answers.proactive_briefing ?? ""));
  return [
    base.trim(),
    "",
    "## Founder Preferences",
    `- 助理名称：${assistantName}`,
    `- 对 Founder 的称呼：${founderName}`,
    `- 风格偏好：${style}`,
    `- 自动执行模式：${autoExecutionMode}`,
    `- 主动提醒与简报：${allowProactiveBriefing ? "开启" : "关闭"}`,
    "",
  ].join("\n");
}

export async function ensureDefaultAssistantBundles(db: Db) {
  for (const bundleKind of BOARD_ASSISTANT_BUNDLE_KINDS) {
    const existing = await db
      .select({ id: boardAssistantBundleRevisions.id })
      .from(boardAssistantBundleRevisions)
      .where(and(
        eq(boardAssistantBundleRevisions.bundleKind, bundleKind),
        eq(boardAssistantBundleRevisions.isActive, true),
      ))
      .then((rows) => rows[0] ?? null);
    if (existing) continue;
    await db.insert(boardAssistantBundleRevisions).values({
      bundleKind,
      revisionLabel: "default-v1",
      content: await readAssistantTemplate(bundleKind),
      isActive: true,
      updatedBy: "system",
      changeReason: "bootstrap default assistant bundle",
    });
  }
}

export async function replaceActiveAssistantBundle(
  db: Db,
  input: {
    bundleKind: BoardAssistantBundleKind;
    content: string;
    updatedBy: string;
    changeReason: string;
    revisionLabel: string;
  },
) {
  await db.transaction(async (tx) => {
    await tx
      .update(boardAssistantBundleRevisions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(boardAssistantBundleRevisions.bundleKind, input.bundleKind),
        eq(boardAssistantBundleRevisions.isActive, true),
      ));
    await tx.insert(boardAssistantBundleRevisions).values({
      bundleKind: input.bundleKind,
      revisionLabel: input.revisionLabel,
      content: input.content,
      isActive: true,
      updatedBy: input.updatedBy,
      changeReason: input.changeReason,
    });
  });
}

export async function getOrCreateInternalCompanyThread(db: Db, companyId: string) {
  const existing = await db
    .select()
    .from(boardAssistantThreads)
    .where(and(
      eq(boardAssistantThreads.threadKind, "internal"),
      eq(boardAssistantThreads.subjectType, "company"),
      eq(boardAssistantThreads.subjectId, companyId),
    ))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;
  return db
    .insert(boardAssistantThreads)
    .values({
      threadKind: "internal",
      subjectType: "company",
      subjectId: companyId,
      mode: "observe",
    })
    .returning()
    .then((rows) => rows[0]!);
}

export async function createDeleteCompanyPreview(db: Db, companyId: string) {
  const [company, activeRuns, issueCount] = await Promise.all([
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(heartbeatRuns)
      .where(and(
        eq(heartbeatRuns.companyId, companyId),
        sql`${heartbeatRuns.status} in ('queued', 'running')`,
      ))
      .then((rows) => Number(rows[0]?.count ?? 0)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(eq(issues.companyId, companyId))
      .then((rows) => Number(rows[0]?.count ?? 0)),
  ]);
  if (!company) throw notFound("Company not found");
  return {
    riskLevel: "high" as const,
    impactSummary: `删除公司 ${company.name} 会清理其级联数据。`,
    activeRunCount: activeRuns,
    entityCounts: { issues: issueCount },
  };
}

function buildTaskCard(input: {
  summary: string;
  targetLabel: string;
  suggestedAction: string;
  riskLevel: "low" | "medium" | "high";
  executionMode: "analysis" | "formal_issue" | "instance_action";
  createsFormalObject: boolean;
  rationale: string;
  plannedCalls: string[];
  pendingConfirmation: string[];
  expectedOutput: string[];
}) {
  return {
    task: input.summary,
    target: input.targetLabel,
    suggestedAction: input.suggestedAction,
    riskLevel: input.riskLevel,
    executionMode: input.executionMode,
    createsFormalObject: input.createsFormalObject,
    rationale: input.rationale,
    plannedCalls: input.plannedCalls,
    pendingConfirmation: input.pendingConfirmation,
    expectedOutput: input.expectedOutput,
  };
}

function normalizeGroupKey(value: string) {
  return value.trim().toLowerCase();
}

function findStaticCompanyGroup(messageText: string, groups: StaticCompanyGroup[]) {
  const normalized = normalizeGroupKey(messageText);
  return groups.find((group) => (
    group.enabled
    && (
      normalized.includes(normalizeGroupKey(group.groupKey))
      || normalized.includes(normalizeGroupKey(group.displayName))
    )
  )) ?? null;
}

function buildDraftCard(input: {
  summary: string;
  draftKind: "message" | "issue" | "announcement" | "persona";
  content: string;
}) {
  return buildTaskCard({
    summary: input.summary,
    targetLabel: "仅生成草稿",
    suggestedAction: "先生成草稿，不直接落正式对象",
    riskLevel: "low",
    executionMode: "analysis",
    createsFormalObject: false,
    rationale: "消息明确要求先起草内容，不直接执行正式动作。",
    plannedCalls: ["draft-only generation"],
    pendingConfirmation: ["请确认是否采用这份草稿。"],
    expectedOutput: [`生成${input.draftKind}草稿`],
  });
}

async function findCompanyByHint(db: Db, hint: string | null | undefined) {
  const normalized = (hint ?? "").trim();
  if (!normalized) return null;
  const byId = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, normalized))
    .then((rows) => rows[0] ?? null);
  if (byId) return byId;
  return db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(sql`lower(${companies.name}) = lower(${normalized})`)
    .then((rows) => rows[0] ?? null);
}

async function recommendCompany(db: Db, messageText: string) {
  const rows = await db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(asc(companies.name));
  if (rows.length === 1) return rows[0]!;
  const hit = rows.find((row) => messageText.toLowerCase().includes(row.name.toLowerCase()));
  return hit ?? null;
}

export async function interpretAssistantMessage(db: Db, messageText: string) {
  return interpretAssistantMessageWithSettings(db, messageText, {});
}

export async function interpretAssistantMessageWithSettings(
  db: Db,
  messageText: string,
  options: {
    staticCompanyGroups?: StaticCompanyGroup[];
  },
) {
  const lower = messageText.toLowerCase();
  if (lower.includes("草稿") || lower.includes("draft")) {
    const summary = messageText.trim().slice(0, 160);
    const draftKind = lower.includes("公告")
      ? "announcement"
      : lower.includes("issue")
        ? "issue"
        : lower.includes("人格") || lower.includes("soul")
          ? "persona"
          : "message";
    return {
      status: "proposed" as const,
      intentKind: "draft_generation",
      summary,
      targetKind: "instance" as const,
      targetRef: "draft-only",
      proposedAction: null,
      proposedPayload: {
        draftKind,
        content: `草稿任务：${summary}`,
      },
      cardPayload: {
        ...buildDraftCard({
          summary,
          draftKind,
          content: `草稿任务：${summary}`,
        }),
        draftKind,
        draftContent: `草稿任务：${summary}`,
      },
    };
  }
  if (lower.includes("创建公司") || lower.includes("create company")) {
    const matched = messageText.match(/(?:创建公司|create company)\s*[:：]?\s*(.+)$/i);
    const companyName = matched?.[1]?.trim() || "New Company";
    return {
      status: "proposed" as const,
      intentKind: "create_company",
      summary: `创建公司：${companyName}`,
      targetKind: "instance" as const,
      targetRef: "instance",
      proposedAction: "create_company" as const,
      proposedPayload: { name: companyName },
      cardPayload: buildTaskCard({
        summary: `创建公司 ${companyName}`,
        targetLabel: "实例级动作",
        suggestedAction: "创建新公司并初始化系统治理项目",
        riskLevel: "medium",
        executionMode: "instance_action",
        createsFormalObject: true,
        rationale: "消息中包含明确的创建公司意图。",
        plannedCalls: ["companies.create", "systemProject.ensureCanonical"],
        pendingConfirmation: ["请确认是否立即创建该公司。"],
        expectedOutput: ["创建 company", "创建 System Governance project"],
      }),
    };
  }
  if (lower.includes("删除公司") || lower.includes("delete company")) {
    const matched = messageText.match(/(?:删除公司|delete company)\s*[:：]?\s*(.+)$/i);
    const companyHint = matched?.[1]?.trim() ?? "";
    const company = await findCompanyByHint(db, companyHint);
    return {
      status: "proposed" as const,
      intentKind: "delete_company",
      summary: company ? `删除公司：${company.name}` : "删除公司",
      targetKind: "instance" as const,
      targetRef: company?.id ?? "instance",
      proposedAction: "delete_company" as const,
      proposedPayload: company ? { companyId: company.id, companyName: company.name } : { companyHint },
      cardPayload: buildTaskCard({
        summary: company ? `删除公司 ${company.name}` : "删除指定公司",
        targetLabel: company?.name ?? "待确认公司",
        suggestedAction: "生成 destructive preview，确认后执行硬删除",
        riskLevel: "high",
        executionMode: "instance_action",
        createsFormalObject: false,
        rationale: "消息中包含明确的删除公司意图。",
        plannedCalls: ["companies.remove", "destructive preview"],
        pendingConfirmation: [company ? "请确认是否删除该公司。" : "请先明确要删除哪家公司。"],
        expectedOutput: ["删除 company 及其级联数据"],
      }),
    };
  }

  const staticGroup = findStaticCompanyGroup(messageText, options.staticCompanyGroups ?? []);
  if (staticGroup) {
    const companiesInGroup = await db
      .select({ id: companies.id, name: companies.name, status: companies.status })
      .from(companies)
      .where(inArray(companies.id, staticGroup.companyIds))
      .orderBy(asc(companies.name));
    const looksLikeQuery = /(列出|查看|查询|状态|summary|list|show|status)/i.test(messageText);
    if (looksLikeQuery) {
      return {
        status: "done" as const,
        intentKind: "company_group_query",
        summary: `查询静态公司组：${staticGroup.displayName}`,
        targetKind: null,
        targetRef: null,
        proposedAction: null,
        proposedPayload: null,
        cardPayload: {
          groupKey: staticGroup.groupKey,
          displayName: staticGroup.displayName,
          result: `该分组当前包含 ${companiesInGroup.length} 家公司。`,
          companies: companiesInGroup,
        },
      };
    }
    return {
      status: "done" as const,
      intentKind: "analysis_only",
      summary: messageText.trim().slice(0, 160),
      targetKind: null,
      targetRef: null,
      proposedAction: null,
      proposedPayload: null,
      cardPayload: {
        groupKey: staticGroup.groupKey,
        displayName: staticGroup.displayName,
        result: `静态公司组当前包含 ${companiesInGroup.length} 家公司。`,
      },
    };
  }

  const company = await recommendCompany(db, messageText);
  if (company) {
    return {
      status: "proposed" as const,
      intentKind: "company_task",
      summary: messageText.trim().slice(0, 160),
      targetKind: "company" as const,
      targetRef: company.id,
      proposedAction: null,
      proposedPayload: null,
      cardPayload: buildTaskCard({
        summary: messageText.trim(),
        targetLabel: company.name,
        suggestedAction: "创建 CEO issue 进入正式执行链路",
        riskLevel: "medium",
        executionMode: "formal_issue",
        createsFormalObject: true,
        rationale: "消息中包含任务意图，且已能推定目标公司。",
        plannedCalls: ["systemProject.ensureCanonical", "issues.create"],
        pendingConfirmation: ["请确认是否按该理解创建正式 issue。"],
        expectedOutput: ["创建 CEO issue", "写入 activity 与 thread 摘要"],
      }),
    };
  }

  return {
    status: "done" as const,
    intentKind: "analysis_only",
    summary: messageText.trim().slice(0, 160),
    targetKind: null,
    targetRef: null,
    proposedAction: null,
    proposedPayload: null,
    cardPayload: {
      summary: messageText.trim(),
      result: "当前未识别为可直接执行的正式动作，已按普通对话/分析处理。",
    },
  };
}

export function shouldAutoExecuteBoardAssistantRequest(input: {
  autoExecutionMode: BoardAssistantAutoExecutionMode;
  intentKind: string | null | undefined;
  targetKind: string | null | undefined;
  proposedPayload: Record<string, unknown> | null | undefined;
}) {
  if (input.autoExecutionMode === "manual_confirm") return false;
  if (input.intentKind === "draft_generation") return true;
  if (input.intentKind === "analysis_only" && input.targetKind == null) return true;
  if (input.autoExecutionMode === "enhanced_auto" && input.intentKind === "company_group_query") {
    return true;
  }
  if (input.autoExecutionMode === "low_risk_auto" && input.intentKind === "company_group_query") {
    return true;
  }
  return false;
}

export function isPresentedChannelSecretAccepted(
  channel: string,
  presentedSecret: string | undefined,
  previousSecretGraceWindowMinutes: number,
  now = new Date(),
) {
  if (!presentedSecret) return false;
  return getChannelSecrets(channel, previousSecretGraceWindowMinutes, now).some((candidate) =>
    timingSafeStringEqual(candidate, presentedSecret)
  );
}

export function verifyChannelSecret(input: BoardAssistantIngress, previousSecretGraceWindowMinutes: number) {
  const payload = buildSigningPayload(input);
  const candidates = getChannelSecrets(input.channel, previousSecretGraceWindowMinutes);
  if (candidates.length === 0) {
    throw forbidden(`Channel secret not configured for ${input.channel}`);
  }
  const matched = candidates.some((candidate) => {
    const expected = createHmac("sha256", candidate).update(payload).digest("hex");
    return timingSafeStringEqual(expected, input.ingressSignature);
  });
  if (!matched) throw forbidden("Invalid board assistant channel signature");
}
