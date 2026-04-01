import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareManagedCodexHome } from "./codex-home.js";

describe("prepareManagedCodexHome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to copying auth.json when symlink creation is not permitted", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-codex-home-"));
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const paperclipHome = path.join(root, "paperclip-home");
    const managedCodexHome = path.join(
      paperclipHome,
      "instances",
      "default",
      "companies",
      "company-1",
      "codex-home",
    );
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(path.join(sharedCodexHome, "auth.json"), '{"token":"shared"}\n', "utf8");

    const logs: string[] = [];
    const originalSymlink = fs.symlink.bind(fs);
    const symlinkSpy = vi
      .spyOn(fs, "symlink")
      .mockImplementation(async (target, pathLike, type) => {
        const targetPath = String(pathLike);
        if (targetPath.endsWith(`${path.sep}auth.json`)) {
          const error = Object.assign(new Error("operation not permitted"), { code: "EPERM" });
          throw error;
        }
        return await originalSymlink(target, pathLike, type);
      });

    try {
      const targetHome = await prepareManagedCodexHome(
        {
          CODEX_HOME: sharedCodexHome,
          PAPERCLIP_HOME: paperclipHome,
        },
        async (_stream, chunk) => {
          logs.push(chunk);
        },
        "company-1",
      );

      expect(targetHome).toBe(managedCodexHome);
      const managedAuth = path.join(managedCodexHome, "auth.json");
      expect((await fs.lstat(managedAuth)).isFile()).toBe(true);
      expect(await fs.readFile(managedAuth, "utf8")).toBe('{"token":"shared"}\n');
      expect(symlinkSpy).toHaveBeenCalled();
      expect(logs.join("")).toContain("Fell back to copying shared Codex file");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
