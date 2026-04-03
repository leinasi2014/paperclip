# Architecture

## Role of This Document

This is the current V1 implementation contract for the repository. When source behavior and older narrative docs disagree, this page and the code are the source of truth.

## Runtime Layers

- `ui/`: React operator interface
- `server/`: Express API, auth, orchestration, plugin host, runtime services
- `cli/`: onboarding, configure, run, doctor, worktree and control-plane commands
- `packages/db/`: schema and migrations
- `packages/shared/`: shared types and constants
- `packages/adapters/*`: adapter-specific runtime integrations
- `packages/plugins/*`: plugin SDK, scaffolder, and examples

## Core Runtime Loop

1. A heartbeat is triggered by schedule, assignment, mention, automation, or manual invoke.
2. The server resolves the agent, permissions, budgets, and context.
3. The configured adapter executes the external runtime.
4. The runtime calls back into Paperclip APIs for task, comment, approval, and state operations.
5. The server stores logs, costs, status transitions, and session context for the next run.

## Persistence and Isolation

- Every business entity is company-scoped.
- Authentication distinguishes board users from agents.
- API keys are hashed at rest.
- Activity logging is required for mutating actions.
- Budgets, approvals, and issue checkout are enforced centrally in the server.

## Deployment Contract

- Development defaults to embedded local data when `DATABASE_URL` is unset.
- Supported exposure model is `local_trusted` or `authenticated` with `private/public` exposure.
- The board UI and API share the same base application host.

## Canonical References

- Product model: [../product/index.en.md](../product/index.en.md)
- Commands and config: [../reference/index.en.md](../reference/index.en.md)
- Operator and deployment workflows: [../guides/index.en.md](../guides/index.en.md)
- Contributor workflow: [../development/index.en.md](../development/index.en.md)
