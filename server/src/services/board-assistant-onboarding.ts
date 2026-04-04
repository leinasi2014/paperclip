import type { Db } from "@paperclipai/db";
import { and, eq } from "drizzle-orm";
import {
  boardAssistantBindings,
  boardAssistantBundleRevisions,
  boardAssistantOnboardingSessions,
} from "@paperclipai/db";
import {
  buildSoulRevision,
  ensureDefaultAssistantBundles,
  parseAutoExecutionMode,
  parseTruthyText,
  replaceActiveAssistantBundle,
} from "./board-assistant-helpers.js";
import {
  getOrCreateExternalBoardAssistantThread,
  sendBoardAssistantFounderPrompt,
} from "./board-assistant-runtime.js";
import { createOnboardingMemoryProposals } from "./board-assistant-memory-proposals.js";

type SettingsLike = {
  updateBoardAssistant: (patch: {
    autoExecutionMode: "manual_confirm" | "low_risk_auto" | "enhanced_auto";
    allowProactiveBriefing: boolean;
  }) => Promise<unknown>;
};

export async function completeBoardAssistantOnboarding(input: {
  db: Db;
  settings: SettingsLike;
  onboarding: typeof boardAssistantOnboardingSessions.$inferSelect;
  binding: typeof boardAssistantBindings.$inferSelect;
}) {
  await ensureDefaultAssistantBundles(input.db);
  const baseSoul = await input.db
    .select({ content: boardAssistantBundleRevisions.content })
    .from(boardAssistantBundleRevisions)
    .where(and(
      eq(boardAssistantBundleRevisions.bundleKind, "soul"),
      eq(boardAssistantBundleRevisions.isActive, true),
    ))
    .then((rows) => rows[0]?.content ?? "");
  await replaceActiveAssistantBundle(input.db, {
    bundleKind: "soul",
    content: buildSoulRevision(baseSoul, input.onboarding.answers),
    updatedBy: "founder_onboarding",
    changeReason: "complete founder onboarding",
    revisionLabel: `onboarding-${new Date().toISOString()}`,
  });
  await input.settings.updateBoardAssistant({
    autoExecutionMode: parseAutoExecutionMode(String(input.onboarding.answers.auto_execution ?? "")),
    allowProactiveBriefing: parseTruthyText(String(input.onboarding.answers.proactive_briefing ?? "")),
  });
  await createOnboardingMemoryProposals(input.db, {
    onboardingId: input.onboarding.id,
    answers: input.onboarding.answers,
  });
  const thread = await getOrCreateExternalBoardAssistantThread(input.db, {
    channel: input.binding.channel,
    bindingId: input.binding.id,
    externalThreadId: input.binding.externalThreadId ?? "",
  });
  await sendBoardAssistantFounderPrompt(input.db, {
    binding: input.binding,
    thread,
    text: "初始化已完成，后续你可以直接像助理一样和我交流。",
    checkpointKind: "onboarding-completed",
    payload: { kind: "onboarding-completed" },
  });
}
