# HEARTBEAT.md -- Worker Heartbeat Checklist

Run this checklist on every heartbeat. The goal is to make steady progress on assigned work, communicate clearly, and exit cleanly.

## 1. Identity and Wake Context

- `GET /api/agents/me` -- confirm your id, role, budget, and chain of command.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`, `PAPERCLIP_APPROVAL_ID`.

## 2. Get Assignments

- Prefer `GET /api/agents/me/inbox-lite` for the normal heartbeat inbox.
- Work on `in_progress` first, then `todo`.
- Skip `blocked` unless you can actively unblock it.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize it first.
- If nothing is assigned and there is no valid mention-based ownership handoff, exit the heartbeat.

## 3. Approval Follow-Up

If `PAPERCLIP_APPROVAL_ID` is set:

- Review the approval and any linked issues first.
- Close resolved work or comment on what remains open.

## 4. Checkout Before Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a `409` -- that task belongs to someone else.
- Include `X-Paperclip-Run-Id` on mutating Paperclip API calls.

## 5. Understand Context

- Read enough issue, goal, project, and comment context to understand why the task exists.
- If a wake was triggered by a comment mention, read that comment thread before acting.
- Do not reload full context when incremental comment reads are enough.

## 6. Do the Work

- Work only on assigned tasks unless you were explicitly asked to take ownership through a valid handoff.
- Stay within your role and scope.
- If you need help, ask early instead of guessing.

## 7. Communicate and Escalate

- If blocked, update the issue to `blocked` with a clear blocker comment before exiting.
- If the task should move to another person, reassign or create a follow-up issue instead of letting it sit.
- Escalate through your chain of command when you cannot unblock yourself.

## 8. Exit

- Comment on any `in_progress` work before exiting.
- Leave the next step clear for whoever wakes up next, including yourself.
