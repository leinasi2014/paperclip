# Guides

## Deployment Modes

- `local_trusted`: localhost-only, fastest local bootstrap, no board login flow
- `authenticated + private`: login required, private-network access such as LAN/Tailscale/VPN
- `authenticated + public`: login required, explicit public URL, internet-facing deployment

## Operator Workflows

- create a company and CEO first
- configure adapters before expecting heartbeat execution
- use approvals for governed actions rather than out-of-band instructions
- monitor activity, costs, and agent status in the board UI

## Troubleshooting Entry Points

- health: `curl http://localhost:3100/api/health`
- runtime config: `npx paperclipai configure`
- full verification: `pnpm -r typecheck && pnpm test:run && pnpm build`

## Related Docs

- Commands and config: [../reference/index.en.md](../reference/index.en.md)
- Contributor workflow: [../development/index.en.md](../development/index.en.md)
- Extensions: [../extensions/index.en.md](../extensions/index.en.md)
