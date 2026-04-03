# Development

## Prerequisites

- Node.js 20+
- pnpm 9+
- No external database is required for local development

## Standard Local Workflow

```bash
pnpm install
pnpm dev
```

Useful variants:

- `pnpm dev:server`
- `pnpm dev:once`
- `pnpm paperclipai run`

## Verification Gate

Run this before claiming a change is done:

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```

## Database Workflow

1. Edit `packages/db/src/schema/*`.
2. Export new schema pieces from `packages/db/src/schema/index.ts`.
3. Run `pnpm db:generate`.
4. Re-run the verification gate.

## Documentation Workflow

- Project-level docs belong in `docs/`.
- Use paired canonical files: `*.en.md` and `*.zh-CN.md`.
- New active plans belong in `docs/plans/` and should use `YYYY-MM-DD-slug.md`.
- Delete stale plans instead of keeping large archives.

## Contributor Entry Points

- Root repo rules: [`../../AGENTS.md`](../../AGENTS.md)
- Contribution process: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)
- Release notes: [`../../releases/`](../../releases/)
