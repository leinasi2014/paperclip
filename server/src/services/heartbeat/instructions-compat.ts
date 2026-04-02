import fs from "node:fs/promises";
import path from "node:path";
import { agents } from "@paperclipai/db";
import { resolvePaperclipInstanceRoot } from "../../home-paths.js";
import {
  loadDefaultAgentInstructionsBundle,
  resolveDefaultAgentInstructionsBundleRole,
} from "../default-agent-instructions.js";
import { readNonEmptyString } from "./shared.js";

const LEGACY_INSTRUCTIONS_FILE_NAMES = ["HEARTBEAT.md", "SOUL.md", "TOOLS.md"] as const;
const GENERATED_INSTRUCTIONS_COMPAT_MARKER = "<!-- paperclip-generated-legacy-instructions-compat -->";

function isManagedInstructionsRootForAgent(agent: typeof agents.$inferSelect, rootPath: string) {
  const expectedRoot = path.resolve(
    resolvePaperclipInstanceRoot(),
    "companies",
    agent.companyId,
    "agents",
    agent.id,
    "instructions",
  );
  return path.resolve(rootPath) === expectedRoot;
}

function instructionsUseLegacyAgentHomeReferences(content: string) {
  return LEGACY_INSTRUCTIONS_FILE_NAMES.some((fileName) => content.includes(`$AGENT_HOME/${fileName}`));
}

function extractRoleSpecificInstructions(content: string) {
  const marker = "## Role-Specific Instructions";
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) return null;
  const extracted = content.slice(markerIndex + marker.length).trim();
  return extracted.length > 0 ? extracted : null;
}

function mergeRoleSpecificInstructions(baseAgentsInstructions: string, roleSpecificInstructions: string | null) {
  if (!roleSpecificInstructions) return baseAgentsInstructions;
  return [
    baseAgentsInstructions.trimEnd(),
    "## Role-Specific Instructions",
    "",
    roleSpecificInstructions,
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");
}

export type InstructionsCompatibilityAction =
  | {
      kind: "bundle_refreshed";
      warning: string;
      payload: Record<string, unknown>;
    }
  | {
      kind: "legacy_shims_created";
      warning: string;
      payload: Record<string, unknown>;
    };

export async function refreshLegacyManagedInstructionsBundleIfNeeded(input: {
  agent: typeof agents.$inferSelect;
  instructionsRootPath: string | null;
  instructionsEntryFile: string | null;
}): Promise<InstructionsCompatibilityAction[]> {
  const instructionsRootPath = readNonEmptyString(input.instructionsRootPath);
  const instructionsEntryFile = readNonEmptyString(input.instructionsEntryFile);
  if (!instructionsRootPath || !instructionsEntryFile) return [];
  if (!isManagedInstructionsRootForAgent(input.agent, instructionsRootPath)) return [];

  const entryPath = path.resolve(instructionsRootPath, instructionsEntryFile);
  const currentAgentsInstructions = await fs.readFile(entryPath, "utf8").catch(() => null);
  if (!currentAgentsInstructions || !instructionsUseLegacyAgentHomeReferences(currentAgentsInstructions)) {
    return [];
  }

  const roleSpecificInstructions = extractRoleSpecificInstructions(currentAgentsInstructions);
  const defaultBundle = await loadDefaultAgentInstructionsBundle(
    resolveDefaultAgentInstructionsBundleRole(input.agent.role),
  );
  defaultBundle["AGENTS.md"] = mergeRoleSpecificInstructions(
    defaultBundle["AGENTS.md"] ?? "",
    roleSpecificInstructions,
  );

  for (const [relativePath, content] of Object.entries(defaultBundle)) {
    const absolutePath = path.resolve(instructionsRootPath, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
  }

  return [{
    kind: "bundle_refreshed",
    warning: "Refreshed a legacy managed instructions bundle to the current Paperclip template.",
    payload: {
      instructionsRootPath,
      instructionsEntryFile,
    },
  }];
}

export async function ensureLegacyInstructionsCompatibilityFiles(input: {
  agentHome: string | null;
  instructionsRootPath: string | null;
  instructionsEntryFile?: string | null;
}): Promise<InstructionsCompatibilityAction[]> {
  const agentHome = readNonEmptyString(input.agentHome);
  const instructionsRootPath = readNonEmptyString(input.instructionsRootPath);
  const instructionsEntryFile = readNonEmptyString(input.instructionsEntryFile) ?? "AGENTS.md";
  if (!agentHome || !instructionsRootPath) return [];

  const entryContent = await fs
    .readFile(path.resolve(instructionsRootPath, instructionsEntryFile), "utf8")
    .catch(() => null);
  if (!entryContent || !instructionsUseLegacyAgentHomeReferences(entryContent)) {
    return [];
  }

  const createdFiles: string[] = [];
  for (const fileName of LEGACY_INSTRUCTIONS_FILE_NAMES) {
    const sourcePath = path.resolve(instructionsRootPath, fileName);
    const content = await fs.readFile(sourcePath, "utf8").catch(() => null);
    if (content === null) continue;

    const targetPath = path.resolve(agentHome, fileName);
    const existingContent = await fs.readFile(targetPath, "utf8").catch(() => null);
    if (
      existingContent !== null &&
      !existingContent.startsWith(`${GENERATED_INSTRUCTIONS_COMPAT_MARKER}\n`)
    ) {
      continue;
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(
      targetPath,
      `${GENERATED_INSTRUCTIONS_COMPAT_MARKER}\n\n${content}`,
      "utf8",
    );
    createdFiles.push(fileName);
  }

  if (createdFiles.length === 0) return [];
  return [{
    kind: "legacy_shims_created",
    warning: "Created compatibility copies of instructions files in AGENT_HOME for a legacy prompt.",
    payload: {
      files: createdFiles,
      agentHome,
      instructionsRootPath,
    },
  }];
}
