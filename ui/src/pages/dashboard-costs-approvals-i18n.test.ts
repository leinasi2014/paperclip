import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));

function localePath(language: "en" | "zh-CN", namespace: "dashboard" | "costs" | "approvals") {
  return path.resolve(here, `../i18n/locales/${language}/${namespace}.json`);
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function collectKeys(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    return [prefix];
  }

  return Object.entries(value)
    .flatMap(([key, nestedValue]) => collectKeys(nestedValue, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe("dashboard/costs/approvals locale files", () => {
  it("creates the expected namespace files", () => {
    const namespaces = ["dashboard", "costs", "approvals"] as const;
    const languages = ["en", "zh-CN"] as const;

    for (const language of languages) {
      for (const namespace of namespaces) {
        expect(existsSync(localePath(language, namespace))).toBe(true);
      }
    }
  });

  it("keeps english and simplified chinese keys aligned", () => {
    const namespaces = ["dashboard", "costs", "approvals"] as const;

    for (const namespace of namespaces) {
      const enFile = localePath("en", namespace);
      const zhFile = localePath("zh-CN", namespace);

      expect(existsSync(enFile)).toBe(true);
      expect(existsSync(zhFile)).toBe(true);

      expect(collectKeys(readJsonFile(zhFile))).toEqual(collectKeys(readJsonFile(enFile)));
    }
  });
});
