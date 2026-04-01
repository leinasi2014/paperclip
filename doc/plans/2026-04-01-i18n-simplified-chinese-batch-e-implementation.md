# i18n Simplified Chinese Batch E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining Batch E Simplified Chinese localization work, verify it, and merge `feat/i18n-simplified-chinese` back into the main workspace.

**Architecture:** Reuse the existing branch i18n setup, add missing feature namespaces/resources, convert the remaining hardcoded UI strings to translation-backed copy, then verify and merge. Keep changes in-place and avoid unrelated refactors.

**Tech Stack:** React 19, Vite, Vitest, i18next, react-i18next, TypeScript

---

### Task 1: Lock the missing Batch E coverage with failing tests

**Files:**
- Create: `ui/src/i18n/batchELocales.test.ts`
- Create: `ui/src/i18n/batchEHardcodedEnglish.test.ts`

- [ ] **Step 1: Add locale coverage expectations for the missing Batch E resources**

- [ ] **Step 2: Add a regression test that scans the unfinished Batch E files for the known hardcoded English strings**

- [ ] **Step 3: Run only the new tests and confirm they fail for the current branch state**

Run: `pnpm test:run -- ui/src/i18n/batchELocales.test.ts ui/src/i18n/batchEHardcodedEnglish.test.ts`

Expected: FAIL because the new locale sections do not exist yet and the target files still contain the known hardcoded English copy.

### Task 2: Add the missing locale resources and wire them into i18n

**Files:**
- Create: `ui/src/i18n/locales/en/company.json`
- Create: `ui/src/i18n/locales/zh-CN/company.json`
- Create: `ui/src/i18n/locales/en/workspaces.json`
- Create: `ui/src/i18n/locales/zh-CN/workspaces.json`
- Modify: `ui/src/i18n/locales/en/common.json`
- Modify: `ui/src/i18n/locales/zh-CN/common.json`
- Modify: `ui/src/i18n/resources.ts`
- Modify: `ui/src/i18n/index.ts`

- [ ] **Step 1: Add Batch E translation keys for onboarding and command palette to `common.json`**
- [ ] **Step 2: Add company-scoped page copy to the new `company.json` namespace**
- [ ] **Step 3: Add workspace close dialog copy to the new `workspaces.json` namespace**
- [ ] **Step 4: Register the new namespaces in `resources.ts` and `index.ts`**
- [ ] **Step 5: Re-run the locale coverage tests and confirm resource alignment passes**

### Task 3: Localize the remaining Batch E components and pages

**Files:**
- Modify: `ui/src/components/OnboardingWizard.tsx`
- Modify: `ui/src/components/CommandPalette.tsx`
- Modify: `ui/src/components/ExecutionWorkspaceCloseDialog.tsx`
- Modify: `ui/src/pages/CompanySettings.tsx`
- Modify: `ui/src/pages/CompanyImport.tsx`
- Modify: `ui/src/pages/CompanyExport.tsx`
- Modify: `ui/src/pages/CompanySkills.tsx`
- Modify: supporting files only if required by these pages

- [ ] **Step 1: Localize `OnboardingWizard` and `CommandPalette` using `common`**
- [ ] **Step 2: Localize `ExecutionWorkspaceCloseDialog` using `workspaces`**
- [ ] **Step 3: Localize `CompanySettings`, `CompanyImport`, `CompanyExport`, and `CompanySkills` using `company`**
- [ ] **Step 4: Update any supporting helpers/constants that still emit user-facing English for these pages**
- [ ] **Step 5: Re-run the Batch E regression tests and confirm they pass**

### Task 4: Full verification and worktree cleanup

**Files:**
- Review: worktree git status before merge

- [ ] **Step 1: Run `pnpm check:i18n`**
- [ ] **Step 2: Run `pnpm --filter @paperclipai/ui typecheck`**
- [ ] **Step 3: Run `pnpm test:run`**
- [ ] **Step 4: Run `pnpm build`**
- [ ] **Step 5: Inspect unrelated dirty worktree changes and remove them from the merge path**

### Task 5: Merge completion branch back to the main workspace

**Files:**
- Merge branch state from `D:\\Source\\workspace\\paperclip\\.worktrees\\i18n-simplified-chinese` back into `D:\\Source\\workspace\\paperclip`

- [ ] **Step 1: Confirm the worktree is clean except for intended i18n completion changes**
- [ ] **Step 2: Merge `feat/i18n-simplified-chinese` into the main workspace**
- [ ] **Step 3: Resolve any merge conflicts without dropping current workspace changes**
- [ ] **Step 4: Re-run a targeted post-merge smoke check**
- [ ] **Step 5: Report final status only after fresh verification evidence**
