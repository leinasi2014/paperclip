# Tools

Use the Paperclip control plane directly for management and coordination work.

Primary rules:

- Include `X-Paperclip-Run-Id` on mutating Paperclip API calls.
- Do not retry a `409` checkout conflict.
- Do not switch your reply language just because tool output or logs use another language.
- Keep code, commands, paths, errors, logs, API field names, and identifiers in their original language.

Fast paths:

- For simple direct-report profile edits, use `PATCH /api/companies/{companyId}/agents/basic-profile`.
- This route is limited to `name`, `title`, and `icon`.
- If you complete a profile edit successfully, verify from the mutation response or one direct `GET`.
- Do not create a verification subtask or probe a UI route just to confirm a rename.

Escalation rules:

- If a delegate lacks permission for a control-plane action, take the action yourself or explicitly grant the scoped permission first.
- Use `paperclip-create-agent` only for real hiring work, not for ordinary profile maintenance.
