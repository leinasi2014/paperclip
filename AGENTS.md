# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Purpose

Paperclip is a control plane for AI-agent companies.
The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`.

## 2. Read This First

Before making changes, read in this order:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` is long-horizon product context.
`doc/SPEC-implementation.md` is the concrete V1 build contract.

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `packages/adapters/`: agent adapter implementations (Claude, Codex, Cursor, etc.)
- `packages/adapter-utils/`: shared adapter utilities
- `packages/plugins/`: plugin system packages
- `doc/`: operational and product docs

## 4. Dev Setup (Auto DB)

Use embedded PGlite in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

## 5. Core Engineering Rules

1. Keep changes company-scoped.
Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.

2. Keep contracts synchronized.
If you change schema/API behavior, update all impacted layers:
- `packages/db` schema and exports
- `packages/shared` types/constants/validators
- `server` routes/services
- `ui` API clients and pages

3. Preserve control-plane invariants.
- Single-assignee task model
- Atomic issue checkout semantics
- Approval gates for governed actions
- Budget hard-stop auto-pause behavior
- Activity logging for mutating actions

4. Do not replace strategic docs wholesale unless asked.
Prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. Keep plan docs dated and centralized.
New plan documents belong in `doc/plans/` and should use `YYYY-MM-DD-slug.md` filenames.

6. Enforce file size discipline.
For repo-tracked source and test files, new files and modified files must stay at or below `1000` lines.

This rule applies to:
- `server/src/**`
- `ui/src/**`
- `packages/*/src/**`
- `cli/src/**`
- repo-tracked scripts such as `scripts/*.ts`, `scripts/*.js`, `scripts/*.mjs`, and `scripts/*.cjs`

This rule does not apply to generated or non-source artifacts such as:
- lockfiles
- `packages/db/src/migrations/**`
- migration meta snapshots
- build output
- images or other binary assets
- log files

Existing oversized source files are technical debt. They are not blocked retroactively until touched, but once a source/test file over `1000` lines is modified, that change must also split it back under the limit in the same PR.

## 6. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

## 7. Verification Before Hand-off

Run this full check before claiming done:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, explicitly report what was not run and why.

## 8. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- apply company access checks
- enforce actor permissions (board vs agent)
- write activity log entries for mutations
- return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 9. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors

## 10. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change
5. Any newly added or modified source/test file still complies with the `1000`-line limit rule above

## 11. Upstream Sync Workflow

Use this workflow when syncing changes from `upstream/master` into this fork. The goals are:

- absorb upstream updates safely
- preserve shipped local features and fixes
- perform incremental i18n follow-up on newly imported UI changes

### Remote roles

- `origin` is the publishing remote for this fork
- `upstream` is the source of truth for upstream updates
- do not push directly to `upstream` from routine maintenance work

### Default sync method

1. `git fetch upstream`
2. inspect divergence between local `master` and `upstream/master`
3. create a dedicated sync branch such as `sync/upstream-YYYY-MM-DD`
4. merge `upstream/master` into that sync branch
5. resolve conflicts by preserving validated local behavior first, then re-applying compatible upstream changes
6. run verification
7. merge the sync branch back into local `master`
8. push to `origin`

Default to `merge`, not `rebase`.

Do not use `cherry-pick` as the routine sync mechanism. Only use it for isolated upstream fixes when a full upstream merge is intentionally deferred, and record that decision clearly.

### Conflict resolution policy

- Do not discard or silently overwrite local features that have already been implemented and validated in this fork.
- When upstream and local work touch the same area, preserve the local shipped behavior first, then manually integrate upstream structure, fixes, and compatibility improvements.
- Treat these as high-protection local areas unless explicitly replaced by a deliberate new plan:
  - i18n coverage and locale behavior
  - project and company deletion flows
  - agent instruction bundle defaults
  - language-following rules in default agent prompts
- Do not resolve high-risk conflicts with blanket file replacement, `accept theirs`, `accept ours`, `git reset --hard`, or any equivalent destructive shortcut.

### Incremental i18n after sync

After importing upstream UI changes, perform an incremental i18n review. Do not assume newly merged upstream UI is already aligned with this fork's language behavior.

Review at least:

- newly added pages
- newly added dialogs, popovers, sheets, and dropdown content
- new buttons, empty states, placeholders, toast copy, and error messages
- onboarding, agent, company, project, goal, issue, and settings surfaces touched by the upstream merge

Rules:

- fix only the incremental gaps introduced by the upstream merge
- prefer the existing namespace and translation structure
- avoid turning sync follow-up into a broad unrelated refactor
- if upstream changes touch default agent prompts or onboarding assets, re-check that language rules still inherit correctly

### Verification and hand-off

After a sync merge:

- run targeted tests for the affected areas first
- then run the standard verification set when feasible:
  - `pnpm -r typecheck`
  - `pnpm test:run`
  - `pnpm build`
- if full verification is not feasible, explicitly report what was run and what was not

When reporting or committing a sync:

- summarize which upstream changes were absorbed
- summarize which local behaviors were intentionally preserved
- summarize any incremental i18n fixes applied as part of the sync
