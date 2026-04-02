import path from "node:path";
import type { ExecutionWorkspace, ExecutionWorkspaceConfig } from "@paperclipai/shared";
import { parseObject } from "../../adapters/utils.js";
import { resolveExecutionWorkspaceMode } from "../execution-workspace-policy.js";
import type { ExecutionWorkspaceInput, RealizedExecutionWorkspace } from "../workspace-runtime.js";
import { readNonEmptyString } from "./shared.js";

export function applyPersistedExecutionWorkspaceConfig(input: {
  config: Record<string, unknown>;
  workspaceConfig: ExecutionWorkspaceConfig | null;
  mode: ReturnType<typeof resolveExecutionWorkspaceMode>;
}) {
  const nextConfig = { ...input.config };

  if (input.mode !== "agent_default") {
    if (input.workspaceConfig?.workspaceRuntime === null) {
      delete nextConfig.workspaceRuntime;
    } else if (input.workspaceConfig?.workspaceRuntime) {
      nextConfig.workspaceRuntime = { ...input.workspaceConfig.workspaceRuntime };
    }
  }

  if (input.workspaceConfig && input.mode === "isolated_workspace") {
    const nextStrategy = parseObject(nextConfig.workspaceStrategy);
    if (input.workspaceConfig.provisionCommand === null) delete nextStrategy.provisionCommand;
    else nextStrategy.provisionCommand = input.workspaceConfig.provisionCommand;
    if (input.workspaceConfig.teardownCommand === null) delete nextStrategy.teardownCommand;
    else nextStrategy.teardownCommand = input.workspaceConfig.teardownCommand;
    nextConfig.workspaceStrategy = nextStrategy;
  }

  return nextConfig;
}

export function stripWorkspaceRuntimeFromExecutionRunConfig(config: Record<string, unknown>) {
  const nextConfig = { ...config };
  delete nextConfig.workspaceRuntime;
  return nextConfig;
}

export function buildRealizedExecutionWorkspaceFromPersisted(input: {
  base: ExecutionWorkspaceInput;
  workspace: ExecutionWorkspace;
}): RealizedExecutionWorkspace | null {
  const cwd = readNonEmptyString(input.workspace.cwd) ?? readNonEmptyString(input.workspace.providerRef);
  if (!cwd) {
    return null;
  }

  const strategy = input.workspace.strategyType === "git_worktree" ? "git_worktree" : "project_primary";
  return {
    baseCwd: input.base.baseCwd,
    source: input.workspace.mode === "shared_workspace" ? "project_primary" : "task_session",
    projectId: input.workspace.projectId ?? input.base.projectId,
    workspaceId: input.workspace.projectWorkspaceId ?? input.base.workspaceId,
    repoUrl: input.workspace.repoUrl ?? input.base.repoUrl,
    repoRef: input.workspace.baseRef ?? input.base.repoRef,
    strategy,
    cwd,
    branchName: input.workspace.branchName ?? null,
    worktreePath: strategy === "git_worktree" ? (readNonEmptyString(input.workspace.providerRef) ?? cwd) : null,
    warnings: [],
    created: false,
  };
}

export type ResolvedWorkspaceForRun = {
  cwd: string;
  source: "project_primary" | "task_session" | "agent_home";
  projectId: string | null;
  workspaceId: string | null;
  repoUrl: string | null;
  repoRef: string | null;
  workspaceHints: Array<{
    workspaceId: string;
    cwd: string | null;
    repoUrl: string | null;
    repoRef: string | null;
  }>;
  warnings: string[];
};

type ProjectWorkspaceCandidate = {
  id: string;
};

export function prioritizeProjectWorkspaceCandidatesForRun<T extends ProjectWorkspaceCandidate>(
  rows: T[],
  preferredWorkspaceId: string | null | undefined,
): T[] {
  if (!preferredWorkspaceId) return rows;
  const preferredIndex = rows.findIndex((row) => row.id === preferredWorkspaceId);
  if (preferredIndex <= 0) return rows;
  return [rows[preferredIndex]!, ...rows.slice(0, preferredIndex), ...rows.slice(preferredIndex + 1)];
}

export function formatRuntimeWorkspaceWarningLog(warning: string) {
  return {
    stream: "stdout" as const,
    chunk: `[paperclip] ${warning}\n`,
  };
}
