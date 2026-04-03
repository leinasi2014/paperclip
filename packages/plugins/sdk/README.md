# `@paperclipai/plugin-sdk`

Official TypeScript SDK for building Paperclip plugins.

## Package Surface

- `@paperclipai/plugin-sdk`: worker runtime helpers and types
- `@paperclipai/plugin-sdk/ui`: React hooks and slot props
- `@paperclipai/plugin-sdk/testing`: in-memory test harness
- `@paperclipai/plugin-sdk/bundlers`: esbuild and rollup presets
- `@paperclipai/plugin-sdk/dev-server`: local UI preview helpers

## Install

```bash
pnpm add @paperclipai/plugin-sdk
```

## Typical Flow

1. Define a plugin manifest and worker entrypoint.
2. Add UI slots only if you need dashboard, page, settings, or detail surfaces.
3. Build and install the plugin into a Paperclip instance.
4. Use the testing helpers for worker and UI contract checks.

## Canonical Docs

- Project-level extension overview: [../../../docs/extensions/index.en.md](../../../docs/extensions/index.en.md)
- Plugin scaffolding: [../create-paperclip-plugin/README.md](../create-paperclip-plugin/README.md)

For package-specific details, inspect the exported types and the example plugins in `packages/plugins/examples/`.
