import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const projectCatalog = {
  "packages/db": { configPath: "packages/db/vitest.config.ts", cwd: "packages/db" },
  "packages/adapters/codex-local": { configPath: "packages/adapters/codex-local/vitest.config.ts", cwd: "packages/adapters/codex-local" },
  "packages/adapters/opencode-local": { configPath: "packages/adapters/opencode-local/vitest.config.ts", cwd: "packages/adapters/opencode-local" },
  "packages/plugins/plugin-execution-improvement": { configPath: "packages/plugins/plugin-execution-improvement/vitest.config.ts", cwd: "packages/plugins/plugin-execution-improvement" },
  "packages/plugins/plugin-skills-system": { configPath: "packages/plugins/plugin-skills-system/vitest.config.ts", cwd: "packages/plugins/plugin-skills-system" },
  server: { configPath: "server/vitest.config.ts", cwd: ".", root: "server", testDir: "server/src/__tests__", batchSize: 20 },
  ui: { configPath: "ui/vitest.config.ts", cwd: ".", root: "ui" },
  cli: { configPath: "cli/vitest.config.ts", cwd: ".", root: "cli" },
};

async function loadProjectConfigs() {
  const rootConfigModule = await import(pathToFileURL(path.resolve(repoRoot, "vitest.config.ts")).href);
  const declaredProjects = rootConfigModule.default?.test?.projects;
  if (!Array.isArray(declaredProjects) || declaredProjects.length === 0) {
    throw new Error("Root vitest.config.ts must declare test.projects");
  }

  return declaredProjects.map((projectName) => {
    if (typeof projectName !== "string" || !(projectName in projectCatalog)) {
      throw new Error(`Unsupported Vitest project declaration in root config: ${String(projectName)}`);
    }
    return projectCatalog[projectName];
  });
}

function mergeNodeOptions(existing) {
  const required = "--max-old-space-size=8192";
  if (!existing) return required;
  if (existing.includes("--max-old-space-size")) return existing;
  return `${existing} ${required}`.trim();
}

async function collectTestFiles(testDir) {
  const entries = await fs.readdir(testDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(testDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTestFiles(fullPath));
      continue;
    }
    if (entry.isFile() && (fullPath.endsWith(".test.ts") || fullPath.endsWith(".spec.ts"))) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function chunk(items, batchSize) {
  const batches = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

function runVitestProject(project, files = []) {
  return new Promise((resolve, reject) => {
    const cwd = path.resolve(repoRoot, project.cwd);
    const resolvedConfigPath = path.resolve(repoRoot, project.configPath);
    const args = [
      path.resolve(repoRoot, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      project.root ? resolvedConfigPath : path.relative(cwd, resolvedConfigPath),
    ];
    if (project.root) {
      args.push("--root", project.root);
    }
    if (files.length > 0) {
      args.push(...files);
    }

    const child = spawn(
      process.execPath,
      args,
      {
        cwd,
        stdio: "inherit",
        env: {
          ...process.env,
          NODE_OPTIONS: mergeNodeOptions(process.env.NODE_OPTIONS),
        },
      },
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Vitest project ${project.configPath} exited with signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Vitest project ${project.configPath} failed with exit code ${code}`));
        return;
      }
      resolve();
    });
  });
}

const projectConfigs = await loadProjectConfigs();

for (const project of projectConfigs) {
  console.log(`\n==> Running Vitest project: ${project.configPath}`);
  if (project.testDir && project.batchSize) {
    const files = await collectTestFiles(path.resolve(repoRoot, project.testDir));
    const batches = chunk(files, project.batchSize);
    for (let index = 0; index < batches.length; index += 1) {
      console.log(`   -> Batch ${index + 1}/${batches.length}`);
      await runVitestProject(project, batches[index]);
    }
    continue;
  }
  await runVitestProject(project);
}

console.log("\nAll Vitest projects passed.");
