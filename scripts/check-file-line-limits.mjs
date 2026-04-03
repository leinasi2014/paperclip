import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const MAX_ALLOWED_LINES = 1000;

const SOURCE_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

const MIGRATION_PREFIX = "packages/db/src/migrations/";
const MIGRATION_META_PREFIX = `${MIGRATION_PREFIX}meta/`;

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function isScriptFile(normalizedPath) {
  if (!normalizedPath.startsWith("scripts/")) return false;
  return SOURCE_FILE_EXTENSIONS.has(path.extname(normalizedPath));
}

export function isGeneratedOrExcludedFile(filePath) {
  const normalized = normalizePath(filePath);
  const ext = path.extname(normalized).toLowerCase();

  if (normalized === "pnpm-lock.yaml") return true;
  if (normalized.startsWith(MIGRATION_META_PREFIX)) return true;
  if (normalized.startsWith(MIGRATION_PREFIX)) return true;
  if (normalized.includes("/dist/") || normalized.startsWith("dist/")) return true;
  if (normalized.includes("/coverage/") || normalized.startsWith("coverage/")) return true;
  if (normalized.includes("/node_modules/") || normalized.startsWith("node_modules/")) return true;
  if (normalized.includes("/.git/") || normalized.startsWith(".git/")) return true;
  if (normalized.includes("/.pnpm-store/") || normalized.startsWith(".pnpm-store/")) return true;
  if (normalized.endsWith(".log")) return true;
  if (
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".woff", ".woff2", ".ttf"].includes(ext)
  ) {
    return true;
  }

  return false;
}

export function isEligibleTrackedSourceFile(filePath) {
  const normalized = normalizePath(filePath);
  const ext = path.extname(normalized).toLowerCase();
  if (!SOURCE_FILE_EXTENSIONS.has(ext)) return false;
  if (isGeneratedOrExcludedFile(normalized)) return false;

  if (normalized.startsWith("server/src/")) return true;
  if (normalized.startsWith("ui/src/")) return true;
  if (normalized.startsWith("cli/src/")) return true;
  if (/^packages\/[^/]+\/src\//.test(normalized)) return true;
  if (isScriptFile(normalized)) return true;

  return false;
}

export function countLinesFromText(text) {
  if (text.length === 0) return 0;
  const newlineCount = text.match(/\r\n|\n|\r/g)?.length ?? 0;
  return /(?:\r\n|\n|\r)$/.test(text) ? newlineCount : newlineCount + 1;
}

export function countFileLines(absPath) {
  return countLinesFromText(fs.readFileSync(absPath, "utf8"));
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parseGitPathList(output) {
  return output
    .split(/\r?\n/)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean);
}

export function listChangedFilesAgainstRange(cwd, base, head) {
  const output = git(["diff", "--name-only", "--diff-filter=ACMR", base, head], cwd);
  return parseGitPathList(output);
}

export function listWorkingTreeChangedFiles(cwd) {
  const changed = new Set();

  for (const file of parseGitPathList(git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"], cwd))) {
    changed.add(file);
  }

  for (const file of parseGitPathList(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], cwd))) {
    changed.add(file);
  }

  for (const file of parseGitPathList(git(["ls-files", "--others", "--exclude-standard"], cwd))) {
    changed.add(file);
  }

  return [...changed];
}

function parseArgs(argv) {
  const options = {
    cwd: process.cwd(),
    changed: false,
    base: null,
    head: null,
    files: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--changed") {
      options.changed = true;
      continue;
    }
    if (arg === "--base") {
      options.base = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--head") {
      options.head = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--files") {
      for (let j = i + 1; j < argv.length; j += 1) {
        options.files.push(argv[j]);
      }
      break;
    }
  }

  return options;
}

export function collectCandidateFiles({ cwd, changed, base, head, files }) {
  const explicitFiles = files.map((file) => normalizePath(file)).filter(Boolean);
  if (explicitFiles.length > 0) return explicitFiles;
  if (base && head) return listChangedFilesAgainstRange(cwd, base, head);
  if (changed || (!base && !head && explicitFiles.length === 0)) return listWorkingTreeChangedFiles(cwd);
  return [];
}

export function evaluateLineLimits(cwd, filePaths) {
  const violations = [];
  const checked = [];

  for (const filePath of filePaths) {
    const normalized = normalizePath(filePath);
    if (!isEligibleTrackedSourceFile(normalized)) continue;

    const absPath = path.resolve(cwd, normalized);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) continue;

    const lines = countFileLines(absPath);
    checked.push({ path: normalized, lines });
    if (lines > MAX_ALLOWED_LINES) {
      violations.push({ path: normalized, lines });
    }
  }

  return { checked, violations };
}

export function runFileLineLimitCheck(rawOptions) {
  const options = {
    cwd: rawOptions.cwd ?? process.cwd(),
    changed: Boolean(rawOptions.changed),
    base: rawOptions.base ?? null,
    head: rawOptions.head ?? null,
    files: rawOptions.files ?? [],
  };

  const candidateFiles = collectCandidateFiles(options);
  const { checked, violations } = evaluateLineLimits(options.cwd, candidateFiles);

  if (violations.length === 0) {
    const mode = options.base && options.head
      ? `git diff ${options.base}..${options.head}`
      : options.files.length > 0
        ? "explicit file list"
        : "working tree changes";
    console.log(
      checked.length > 0
        ? `PASS: checked ${checked.length} changed source/test file(s) against the ${MAX_ALLOWED_LINES}-line limit (${mode}).`
        : `PASS: no changed source/test files matched the ${MAX_ALLOWED_LINES}-line limit policy (${mode}).`,
    );
    return 0;
  }

  console.error(`ERROR: ${violations.length} changed source/test file(s) exceed the ${MAX_ALLOWED_LINES}-line limit:`);
  for (const violation of violations) {
    console.error(`  ${violation.path} (${violation.lines} lines)`);
  }
  console.error("\nSplit oversized files before merging this change.");
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = runFileLineLimitCheck(parseArgs(process.argv.slice(2)));
  process.exitCode = exitCode;
}
