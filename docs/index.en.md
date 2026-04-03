# Paperclip Docs

This `docs/` tree is the canonical project documentation for the current repository and source behavior.

## Sections

- [Start](start/index.en.md): what Paperclip is, quickstart, first-run orientation
- [Product](product/index.en.md): company model, operators, goals, governance
- [Architecture](architecture/index.en.md): V1 contract, runtime model, boundaries
- [Reference](reference/index.en.md): commands, config, URLs, API surface, defaults
- [Guides](guides/index.en.md): deployment modes, operator workflows, troubleshooting
- [Development](development/index.en.md): local development, tests, migrations, contribution workflow
- [Extensions](extensions/index.en.md): adapters, plugins, company packages, package docs

## Documentation Policy

- `docs/` is the only canonical home for project-level documentation.
- Root files such as `README.md`, `CONTRIBUTING.md`, and `AGENTS.md` are entrypoints, not full manuals.
- Package `README.md` files should stay package-scoped and deep-link back here.
- `releases/*.md` and `**/CHANGELOG.md` stay in place as release history.
- Runtime-consumed markdown such as onboarding assets stays near the code that loads it.

## Current-State Reading Order

1. [Start](start/index.en.md)
2. [Product](product/index.en.md)
3. [Architecture](architecture/index.en.md)
4. [Development](development/index.en.md)
5. [Reference](reference/index.en.md)
