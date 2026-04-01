# Windows Compatibility Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate current Windows-specific startup, script, filesystem, and adapter failures in the Paperclip repo.

**Architecture:** Audit Windows failures from two directions in parallel: test/runtime evidence and static script review. Replace shell-only entrypoints with Node/PowerShell-safe alternatives where appropriate, add Windows-safe filesystem fallbacks for symlink-sensitive paths, and lock fixes in with focused regression tests.

**Tech Stack:** pnpm, TypeScript, Vitest, PowerShell, Node filesystem APIs

---

### Task 1: Baseline Windows Failure Inventory

**Files:**
- Create: `doc/plans/2026-04-01-windows-compat-audit-findings.md`
- Modify: `package.json`

- [ ] Run `pnpm test:run` and capture the Windows-specific failure groups.
- [ ] Audit workspace scripts for `bash`, `rm -rf`, shell chaining, and non-portable path assumptions.
- [ ] Write the grouped findings and proposed fix buckets into `doc/plans/2026-04-01-windows-compat-audit-findings.md`.

### Task 2: Windows-Safe Script Surface

**Files:**
- Modify: `package.json`
- Modify: `server/package.json`
- Modify: `cli/package.json`
- Modify: `packages/*/package.json` as required
- Create or modify: `scripts/*.ts`

- [ ] Replace shell-only scripts that block Windows execution with Node or PowerShell-safe wrappers.
- [ ] Preserve existing behavior on non-Windows platforms where practical.
- [ ] Add focused verification for each replaced script path.

### Task 3: Windows Filesystem Compatibility

**Files:**
- Modify: `packages/adapters/codex-local/src/server/codex-home.ts`
- Modify: `server/src/**` and `packages/**` where symlink or path handling fails on Windows
- Create or modify tests near each failure site

- [ ] Add fallbacks for symlink-restricted environments.
- [ ] Normalize path-sensitive assertions that currently assume Unix-only behavior.
- [ ] Keep adapter/session behavior unchanged except for compatibility fixes.

### Task 4: Verification and Residual Gap Closure

**Files:**
- Modify: `doc/plans/2026-04-01-windows-compat-audit-findings.md`

- [ ] Re-run targeted tests for each fixed failure bucket.
- [ ] Re-run `pnpm -r typecheck`, `pnpm build`, and the highest-value Windows regression tests.
- [ ] Update the findings doc with what is resolved and what still depends on machine policy or external tooling.
