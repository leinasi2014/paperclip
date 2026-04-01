import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCommandResolvable, resolveCommandForLogs } from "@paperclipai/adapter-utils/server-utils";

const itWindows = process.platform === "win32" ? it : it.skip;

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("Windows command resolution", () => {
  itWindows("prefers .cmd shims over bare shell shims when resolving PATH commands", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-win-command-resolution-"));
    tempRoots.push(root);

    const bareShimPath = path.join(root, "codex");
    const cmdShimPath = path.join(root, "codex.cmd");

    await fs.writeFile(bareShimPath, "#!/bin/sh\nexit 0\n", "utf8");
    await fs.writeFile(cmdShimPath, "@echo off\r\nexit /b 0\r\n", "utf8");

    const env = {
      ...process.env,
      PATH: `${root}${path.delimiter}${process.env.PATH ?? ""}`,
    };

    await expect(ensureCommandResolvable("codex", root, env)).resolves.toBeUndefined();
    const resolved = await resolveCommandForLogs("codex", root, env);
    expect(resolved.toLowerCase()).toBe(cmdShimPath.toLowerCase());
  });
});
