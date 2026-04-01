import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function copyMigrationsDirectory(sourceDir: string, targetDir: string) {
  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });
}

async function main() {
  const sourceDir = path.resolve("src/migrations");
  const targetDir = path.resolve("dist/migrations");
  await copyMigrationsDirectory(sourceDir, targetDir);
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  await main();
}
