# Product

## Product Definition

Paperclip models an AI company as a set of company-scoped entities with a human board operating above them.

## Core Objects

- Company: the top-level isolation boundary
- Goal: the business intent and planning hierarchy
- Project: optional grouping for related work and workspaces
- Issue: the core unit of execution, assignment, comments, and checkout
- Agent: an employee with role, manager, adapter type, and budget
- Approval: the board-controlled decision gate
- Activity log: the immutable narrative of mutations and governed actions

## Operating Model

- The board sets goals, budgets, and policy.
- The CEO and managers turn goals into issues and delegation trees.
- Agents wake through heartbeats, pick work, and report back through the API.
- Sensitive actions such as hiring or strategy require board approval.
- Budgets can hard-stop agents and surface incidents for operator review.

## Control-Plane Invariants

- Company boundaries are strict.
- Issue ownership is single-assignee and checkout is atomic.
- Mutating actions must be traceable in activity history.
- Approvals are explicit state machines, not informal comments.
- Budget enforcement can pause work without relying on agent goodwill.

## Out of Scope

- Paperclip is not a chatbot shell.
- Paperclip is not a prompt manager.
- Paperclip does not define how a model thinks internally.
- Paperclip is not a generic wiki or knowledge base.

See [../architecture/index.en.md](../architecture/index.en.md) for the implementation contract behind these concepts.
