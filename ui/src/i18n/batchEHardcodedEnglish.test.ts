import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

type SourceExpectation = {
  file: string;
  forbiddenLiterals: string[];
};

const expectations: SourceExpectation[] = [
  {
    file: "components/OnboardingWizard.tsx",
    forbiddenLiterals: [
      "Name your company",
      "This is the organization your agents will work for.",
      "Acme Corp",
      "What is this company trying to achieve?",
      "Create your first agent",
      "Choose how this agent will run tasks.",
      "Agent name",
      "More Agent Adapter Types",
      "Search models...",
      "No models discovered.",
      "Adapter environment check",
      "Runs a live probe that asks the adapter CLI to respond with hello.",
      "Testing...",
      "Test now",
      "Retrying...",
      "Unset ANTHROPIC_API_KEY",
      "Manual debug",
      "Prompt:",
      "If login is required, run claude login and retry.",
      "Retried with ANTHROPIC_API_KEY unset in adapter config, but the environment test is still failing.",
      "Failed to unset ANTHROPIC_API_KEY and retry.",
      "Gateway URL",
      "Webhook URL",
      "Give it something to do",
      "Task title",
      "Description (optional)",
      "e.g. Research competitor pricing",
      "Add more detail about what the agent should do...",
      "Mission / goal (optional)",
      "Ready to launch",
      "Create & Open Issue",
    ],
  },
  {
    file: "components/CommandPalette.tsx",
    forbiddenLiterals: [
      "Search issues, agents, projects...",
      "No results found.",
      "Create new issue",
      "Create new agent",
    ],
  },
  {
    file: "components/ExecutionWorkspaceCloseDialog.tsx",
    forbiddenLiterals: [
      "Close workspace",
      "Blocking issues",
      "Cleanup actions",
      "Cancel",
    ],
  },
  {
    file: "pages/CompanySettings.tsx",
    forbiddenLiterals: [
      "Company Settings",
      "Generate OpenClaw Invite Prompt",
      "Archive company",
    ],
  },
  {
    file: "pages/CompanyImport.tsx",
    forbiddenLiterals: [
      "Import source",
      "Preview import",
      "Package files",
      "Import preview",
    ],
  },
  {
    file: "pages/CompanyExport.tsx",
    forbiddenLiterals: [
      "Loading export data...",
      "Package files",
      "Search files...",
      "Building export...",
    ],
  },
  {
    file: "pages/CompanySkills.tsx",
    forbiddenLiterals: [
      "Add a skill source",
      "Browse skills.sh",
      "Filter skills",
      "Paste path, GitHub URL, or skills.sh command",
    ],
  },
];

describe("Batch E source localization regressions", () => {
  it("removes the known hardcoded English literals from the remaining Batch E files", () => {
    for (const expectation of expectations) {
      const filePath = path.resolve(repoRoot, expectation.file);
      const source = readFileSync(filePath, "utf8");

      for (const literal of expectation.forbiddenLiterals) {
        expect(source).not.toContain(literal);
      }
    }
  });
});
