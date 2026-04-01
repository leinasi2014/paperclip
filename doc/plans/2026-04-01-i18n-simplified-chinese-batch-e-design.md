# i18n Simplified Chinese Batch E Design

## Goal

Complete the remaining Simplified Chinese UI localization work on `feat/i18n-simplified-chinese` so the branch is merge-ready and the unfinished Batch E surfaces no longer render hardcoded English in normal use.

## Scope

This completion pass covers the remaining user-facing Batch E surfaces that still contain hardcoded English:

- `ui/src/components/OnboardingWizard.tsx`
- `ui/src/components/CommandPalette.tsx`
- `ui/src/components/ExecutionWorkspaceCloseDialog.tsx`
- `ui/src/pages/CompanySettings.tsx`
- `ui/src/pages/CompanyImport.tsx`
- `ui/src/pages/CompanyExport.tsx`
- `ui/src/pages/CompanySkills.tsx`

It also includes any directly supporting i18n resource files and tests needed to keep `en` and `zh-CN` in sync.

## Non-Goals

- Rebuilding the existing i18n architecture
- Translating backend responses or database content
- Changing business semantics, workflows, or pricing/currency behavior
- Unrelated cleanup outside the i18n completion path

## Approach

1. Keep the existing `i18next` + `react-i18next` setup already introduced on this branch.
2. Add the missing translation resources for the remaining Batch E pages instead of leaving strings inline.
3. Localize each unfinished screen in place, following the file’s current structure rather than performing broad refactors.
4. Add regression tests for the remaining work:
   - locale resource coverage for the new namespaces/sections
   - source-level checks that catch the known hardcoded English literals that blocked this branch from being considered complete
5. Run the branch through repo-level verification before merge.

## Resource Layout

- Keep onboarding and shared command palette copy in `common.json`
- Add a `company.json` namespace for company-scoped settings/import/export/skills UI
- Add a `workspaces.json` namespace for execution workspace close dialog copy

This keeps the remaining long-tail strings grouped by feature instead of overloading the existing `settings.json`.

## Risk Management

- Large pages like `CompanyImport`, `CompanyExport`, and `CompanySkills` contain dense UI copy. The completion pass will favor targeted localization over structural changes.
- Some helper components render copy from constants. Where needed, those constants will be converted to translation-backed helpers or passed translated labels from the caller.
- The branch currently has unrelated local DB changes. They will be reviewed and removed from the merge path before integrating back into the main workspace.

## Verification

The branch is only considered complete when all of the following are fresh and green:

- `pnpm check:i18n`
- `pnpm --filter @paperclipai/ui typecheck`
- `pnpm test:run`
- `pnpm build`

After that, the finished branch will be merged back into the main workspace and smoke-checked there.
