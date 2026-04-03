# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Purpose

Paperclip is a control plane for AI-agent companies.
The current implementation target is V1 and is defined in `docs/architecture/index.en.md`.

## 2. Read This First

Before making changes, read in this order:

1. `docs/start/index.en.md`
2. `docs/product/index.en.md`
3. `docs/architecture/index.en.md`
4. `docs/development/index.en.md`
5. `docs/reference/index.en.md`

`docs/index.en.md` is the canonical documentation entrypoint.
`docs/architecture/index.en.md` is the concrete V1 build contract.

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `packages/adapters/`: agent adapter implementations (Claude, Codex, Cursor, etc.)
- `packages/adapter-utils/`: shared adapter utilities
- `packages/plugins/`: plugin system packages
- `docs/`: canonical project docs

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
Prefer additive updates. Keep `docs/product/index.en.md` and `docs/architecture/index.en.md` aligned with the code.

5. Keep plan docs dated and centralized.
New plan documents belong in `docs/plans/` and should use `YYYY-MM-DD-slug.md` filenames.

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

1. Behavior matches `docs/architecture/index.en.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change
5. Any newly added or modified source/test file still complies with the `1000`-line limit rule above

## 11. Fork Strategy

This fork no longer follows `upstream/master` as a routine source of truth.

Rules:

- `origin` is the only publishing remote used for normal development.
- Do not run routine `git fetch upstream`, `git merge upstream/master`, or broad upstream sync workflows.
- Treat this repository as an intentionally diverged product line with its own control-plane behavior, i18n choices, prompts, and UI structure.
- When external code needs to be referenced, import only the specific commit, patch, or idea that is needed, and adapt it manually to local conventions.
- Any one-off upstream-derived import should be handled as a scoped change on its own branch, with explicit review of behavioral differences before merge.

Conflict policy:

- Preserve validated local behavior over upstream structure by default.
- Do not replace local shipped flows with bulk upstream file syncs.
- High-protection local areas include i18n behavior, deletion flows, agent instruction bundles, language-following rules, and control-plane UX.

Verification:

- After any selective external import, run targeted tests for the touched areas first.
- Then run `pnpm -r typecheck`, `pnpm test:run`, and `pnpm build` when feasible.
- If full verification is not feasible, explicitly report what was run and what was not.
