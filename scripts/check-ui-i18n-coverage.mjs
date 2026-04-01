#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function collectKeyPaths(value, prefix = "") {
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    collectKeyPaths(nestedValue, prefix ? `${prefix}.${key}` : key),
  );
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function listLocaleFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

function compareKeySets(enKeys, zhKeys) {
  const enSet = new Set(enKeys);
  const zhSet = new Set(zhKeys);
  return {
    missingInZh: enKeys.filter((key) => !zhSet.has(key)),
    extraInZh: zhKeys.filter((key) => !enSet.has(key)),
  };
}

export function checkUiI18nCoverage({
  repoRoot,
  log = console.log,
  error = console.error,
}) {
  const localesRoot = path.join(repoRoot, "ui", "src", "i18n", "locales");
  const enDir = path.join(localesRoot, "en");
  const zhDir = path.join(localesRoot, "zh-CN");

  log("Checking UI i18n coverage...");

  if (!existsSync(enDir)) {
    error(`Missing locale directory: ${enDir}`);
    return 1;
  }

  if (!existsSync(zhDir)) {
    error(`Missing locale directory: ${zhDir}`);
    return 1;
  }

  const enFiles = listLocaleFiles(enDir);
  const zhFiles = listLocaleFiles(zhDir);
  const namespaces = [...new Set([...enFiles, ...zhFiles])].sort();
  let failed = false;

  for (const fileName of namespaces) {
    const enFile = path.join(enDir, fileName);
    const zhFile = path.join(zhDir, fileName);

    if (!existsSync(enFile)) {
      error(`Missing en locale file for namespace ${path.basename(fileName, ".json")}: ${enFile}`);
      failed = true;
      continue;
    }

    if (!existsSync(zhFile)) {
      error(`Missing zh-CN locale file for namespace ${path.basename(fileName, ".json")}: ${zhFile}`);
      failed = true;
      continue;
    }

    const enKeys = collectKeyPaths(readJson(enFile)).sort();
    const zhKeys = collectKeyPaths(readJson(zhFile)).sort();
    const { missingInZh, extraInZh } = compareKeySets(enKeys, zhKeys);

    if (missingInZh.length > 0 || extraInZh.length > 0) {
      failed = true;
      error(`Namespace ${path.basename(fileName, ".json")} is out of sync:`);
      if (missingInZh.length > 0) {
        error(`  Missing in zh-CN: ${missingInZh.join(", ")}`);
      }
      if (extraInZh.length > 0) {
        error(`  Extra in zh-CN: ${extraInZh.join(", ")}`);
      }
    }
  }

  if (failed) {
    error("UI i18n coverage check failed.");
    return 1;
  }

  log(`UI i18n coverage OK (${namespaces.length} namespaces).`);
  return 0;
}

function main() {
  const repoRoot = process.cwd();
  process.exitCode = checkUiI18nCoverage({ repoRoot });
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main();
}
