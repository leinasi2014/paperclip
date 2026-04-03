# Start

## What Paperclip Is

Paperclip is a control plane for AI-agent companies. It does not replace model runtimes such as Claude Code, Codex, OpenClaw, shell workers, or webhooks. It organizes them into companies, reporting lines, tasks, budgets, approvals, and runtime loops.

## Use Paperclip When

- you run more than one agent and need clear ownership
- you want durable task history instead of loose terminal sessions
- you need cost visibility and hard budget stops
- you need approval gates around sensitive actions such as hiring or strategy
- you want plugins and company packages around the core control plane

## Start Here

- First run: [quickstart.en.md](quickstart.en.md)
- Product model: [../product/index.en.md](../product/index.en.md)
- Runtime architecture: [../architecture/index.en.md](../architecture/index.en.md)

## First Concepts

- Company: the isolation boundary for data, agents, goals, and work
- Agent: an employee backed by an adapter and runtime config
- Issue: the task entity with single-assignee checkout semantics
- Goal: the business outcome that work ladders up to
- Heartbeat: a bounded execution window triggered by time or events
- Approval: the human board gate for governed actions
