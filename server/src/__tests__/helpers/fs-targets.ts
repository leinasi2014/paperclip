import fs from "node:fs/promises";
import syncFs from "node:fs";
import { expect } from "vitest";

function isPermissionError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code === "EPERM" || code === "EACCES";
}

export async function createManagedTestLink(source: string, target: string): Promise<void> {
  try {
    await fs.symlink(source, target);
  } catch (err) {
    if (process.platform !== "win32" || !isPermissionError(err)) {
      throw err;
    }

    const stats = await fs.stat(source);
    if (!stats.isDirectory()) {
      throw err;
    }

    await fs.symlink(source, target, "junction");
  }
}

export function createManagedTestLinkSync(source: string, target: string): void {
  try {
    syncFs.symlinkSync(source, target);
  } catch (err) {
    if (process.platform !== "win32" || !isPermissionError(err)) {
      throw err;
    }

    const stats = syncFs.statSync(source);
    if (!stats.isDirectory()) {
      throw err;
    }

    syncFs.symlinkSync(source, target, "junction");
  }
}

export async function expectLinkedDirectory(target: string, source: string): Promise<void> {
  const stats = await fs.lstat(target);
  expect(stats.isDirectory() || stats.isSymbolicLink()).toBe(true);
  expect(await fs.realpath(target)).toBe(await fs.realpath(source));
}

export async function expectLinkedFileOrCopy(target: string, source: string): Promise<void> {
  const stats = await fs.lstat(target);
  expect(stats.isFile() || stats.isSymbolicLink()).toBe(true);
  expect(await fs.readFile(target, "utf8")).toBe(await fs.readFile(source, "utf8"));
}
