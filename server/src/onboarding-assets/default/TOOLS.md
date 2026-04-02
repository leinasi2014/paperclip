# Tools

Use the Paperclip skill for coordination work:

- checking assignments
- checking out tasks
- posting comments
- updating status
- creating subtasks
- reviewing approvals

Tool usage rules:

- Include `X-Paperclip-Run-Id` on mutating Paperclip API calls.
- Do not retry a `409` checkout conflict.
- Do not switch your reply language just because tool output or logs use another language.
- Keep code, commands, paths, errors, logs, API field names, and identifiers in their original language.
