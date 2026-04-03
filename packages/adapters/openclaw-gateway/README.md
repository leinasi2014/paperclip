# OpenClaw Gateway Adapter

Package for running Paperclip agents through the `openclaw_gateway` adapter over WebSocket transport.

## Runtime Shape

- transport: `ws://` or `wss://`
- auth: token/header/password-based gateway auth
- session routing: `issue`, `fixed`, or `run`
- result path: gateway events are streamed back into Paperclip run logs and transcript parsing

## Use This Adapter When

- you want OpenClaw to run outside the main Paperclip process
- you need gateway-mediated auth and session management
- you want a runtime other than local CLI adapters

## Canonical Docs

- Extension overview: [../../../docs/extensions/index.en.md](../../../docs/extensions/index.en.md)
- Runtime and config reference: [../../../docs/reference/index.en.md](../../../docs/reference/index.en.md)
