import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyMigrationsDirectory } from "./copy-migrations.js";

const tempDirs: string[] = [];

async function makeTempDir(prefix: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("copyMigrationsDirectory", () => {
  it("copies migrations recursively into the build output", async () => {
    const root = await makeTempDir("paperclip-db-copy-");
    const sourceDir = path.join(root, "src", "migrations");
    const targetDir = path.join(root, "dist", "migrations");

    await mkdir(path.join(sourceDir, "meta"), { recursive: true });
    await writeFile(path.join(sourceDir, "0001_test.sql"), "-- migration");
    await writeFile(path.join(sourceDir, "meta", "_journal.json"), '{"entries":[]}');

    await copyMigrationsDirectory(sourceDir, targetDir);

    await expect(readFile(path.join(targetDir, "0001_test.sql"), "utf8")).resolves.toBe("-- migration");
    await expect(readFile(path.join(targetDir, "meta", "_journal.json"), "utf8")).resolves.toBe('{"entries":[]}');
  });
});
