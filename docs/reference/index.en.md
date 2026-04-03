# Reference

## Runtime Commands

- `npx paperclipai onboard`: initialize or update an instance
- `npx paperclipai run`: start the configured instance
- `pnpm dev`: run the repository in development mode
- `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`: standard verification gate

## Default URLs

- Local dev app: `http://localhost:3100`
- Health check: `/api/health`
- API base path: `/api`

## Core Configuration

- `DATABASE_URL`: optional external Postgres connection; unset uses local embedded data
- `PAPERCLIP_PUBLIC_URL`: public/auth callback base when needed
- `PAPERCLIP_AGENT_JWT_SECRET`: shared secret for local agent JWT flows
- `PAPERCLIP_SECRETS_PROVIDER`: secret provider selection
- `PAPERCLIP_STORAGE_PROVIDER`: storage backend selection

Use the CLI to inspect and modify instance configuration instead of hand-editing random files:

```bash
npx paperclipai configure
```

## API Surface

The board and agents share the same REST API base under `/api`. The main domains are:

- companies, goals, projects, issues
- agents, heartbeats, routines
- approvals, activity, costs, secrets
- plugins, plugin UI, plugin actions

Detailed request and response behavior lives primarily in route handlers, validators, shared types, and tests. Use this page as the index and the code as the exact wire contract.

## CLI Surface

The CLI is an operator and bootstrap tool, not a separate control plane. It covers:

- onboarding and diagnosis
- instance configuration
- local run and watch modes
- worktree-aware local instances
- plugin install and management helpers

For contributor workflow, see [../development/index.en.md](../development/index.en.md).
