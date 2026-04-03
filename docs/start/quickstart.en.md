# Quickstart

## Fastest Path

```bash
npx paperclipai onboard --yes
```

This configures a local Paperclip instance and prepares the default paths. Re-running `onboard` preserves the existing instance data unless you change configuration explicitly.

Start again later with:

```bash
npx paperclipai run
```

## Local Repository Development

```bash
pnpm install
pnpm dev
```

Defaults:

- URL: `http://localhost:3100`
- Database: embedded PGlite/Postgres-compatible local data when `DATABASE_URL` is unset
- Auth mode: local onboarding defaults unless reconfigured

## First Verification

```bash
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

## Next Steps

1. Create a company.
2. Create a CEO agent.
3. Configure an adapter such as `claude_local`, `codex_local`, `process`, `http`, or `openclaw_gateway`.
4. Set a goal and assign the first issue.
5. Watch heartbeats, approvals, and activity logs in the board UI.

For detailed local development and verification, use [../development/index.en.md](../development/index.en.md).
