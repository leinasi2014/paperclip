import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

let lineLimitModule: typeof import("../../../scripts/check-file-line-limits.mjs");

const tempRoots: string[] = [];

beforeAll(() => {
  return import("../../../scripts/check-file-line-limits.mjs").then((module) => {
    lineLimitModule = module;
  });
});

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

function createTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-line-limit-"));
  tempRoots.push(root);
  return root;
}

function writeFile(root: string, relPath: string, contents: string) {
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, contents, "utf8");
  return absPath;
}

describe("check-file-line-limits", () => {
  it("reports oversized changed source files", () => {
    const root = createTempRoot();
    const relPath = "server/src/huge-file.ts";
    writeFile(root, relPath, `${"x\n".repeat(1000)}x`);

    const result = lineLimitModule.evaluateLineLimits(root, [relPath]);

    expect(result.checked).toEqual([{ path: relPath, lines: 1001 }]);
    expect(result.violations).toEqual([{ path: relPath, lines: 1001 }]);
  });

  it("skips generated migration metadata and lockfiles", () => {
    expect(lineLimitModule.isEligibleTrackedSourceFile("packages/db/src/migrations/meta/0052_snapshot.json")).toBe(false);
    expect(lineLimitModule.isEligibleTrackedSourceFile("pnpm-lock.yaml")).toBe(false);
  });

  it("accepts changed source files under the limit and eligible script files", () => {
    const root = createTempRoot();
    const srcPath = "ui/src/components/Small.tsx";
    const scriptPath = "scripts/check-small.mjs";
    writeFile(root, srcPath, "export const Small = () => null;\n");
    writeFile(root, scriptPath, "export const run = () => 1;\n");

    const result = lineLimitModule.evaluateLineLimits(root, [srcPath, scriptPath]);

    expect(result.checked).toEqual([
      { path: srcPath, lines: 1 },
      { path: scriptPath, lines: 1 },
    ]);
    expect(result.violations).toEqual([]);
  });
});
