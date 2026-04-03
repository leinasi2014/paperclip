# Extensions

## Adapters

Adapters connect Paperclip to execution runtimes. Built-in coverage includes local CLI adapters, generic process and HTTP adapters, and the OpenClaw gateway path.

Use package docs for package-specific setup:

- [`../../packages/adapters/openclaw-gateway/README.md`](../../packages/adapters/openclaw-gateway/README.md)

## Plugin System

Plugins extend the control plane with worker code, UI slots, actions, data endpoints, jobs, streams, and install-time metadata. The canonical project-level plugin overview lives here; package READMEs should stay package-scoped.

Primary package docs:

- [`../../packages/plugins/sdk/README.md`](../../packages/plugins/sdk/README.md)
- [`../../packages/plugins/create-paperclip-plugin/README.md`](../../packages/plugins/create-paperclip-plugin/README.md)

## Company Packages

Paperclip supports markdown-first company packages for import/export and reusable org templates. The current repository treats them as an extension surface rather than the core runtime contract.

## Extension Rules

- Project-level extension docs live in `docs/extensions/`.
- Package READMEs keep package-specific install and usage details.
- Runtime-consumed markdown stays beside the code that loads it.
