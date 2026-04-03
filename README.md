# Paperclip

<p align="center">
  <img src="docs/assets/header.png" alt="Paperclip — runs your business" width="720" />
</p>

Paperclip 是一个面向 AI agent 公司的控制平面。它把公司、组织结构、任务、预算、审批、插件和运行时接到同一套系统里，让你管理的是“公司”，不是一堆零散终端。

Paperclip is the control plane for AI-agent companies. It gives you one place to run companies, agents, goals, budgets, approvals, and plugins without hand-building the operating layer yourself.

## Quickstart

```bash
npx paperclipai onboard --yes
```

开发仓库本体时：

```bash
pnpm install
pnpm dev
```

默认启动地址是 `http://localhost:3100`，开发环境使用嵌入式 PGlite/Postgres 兼容模式，不需要先准备外部数据库。

## Canonical Docs

- 中文入口: [docs/index.zh-CN.md](docs/index.zh-CN.md)
- English entry: [docs/index.en.md](docs/index.en.md)
- 快速开始 / Quickstart: [docs/start/quickstart.zh-CN.md](docs/start/quickstart.zh-CN.md), [docs/start/quickstart.en.md](docs/start/quickstart.en.md)
- 产品与概念 / Product: [docs/product/index.zh-CN.md](docs/product/index.zh-CN.md), [docs/product/index.en.md](docs/product/index.en.md)
- 架构与实现契约 / Architecture: [docs/architecture/index.zh-CN.md](docs/architecture/index.zh-CN.md), [docs/architecture/index.en.md](docs/architecture/index.en.md)
- 运行参考 / Reference: [docs/reference/index.zh-CN.md](docs/reference/index.zh-CN.md), [docs/reference/index.en.md](docs/reference/index.en.md)
- 运维与操作 / Guides: [docs/guides/index.zh-CN.md](docs/guides/index.zh-CN.md), [docs/guides/index.en.md](docs/guides/index.en.md)
- 开发与贡献 / Development: [docs/development/index.zh-CN.md](docs/development/index.zh-CN.md), [docs/development/index.en.md](docs/development/index.en.md)
- 扩展体系 / Extensions: [docs/extensions/index.zh-CN.md](docs/extensions/index.zh-CN.md), [docs/extensions/index.en.md](docs/extensions/index.en.md)

## Repo Map

- `server/`: Express API, orchestration services, auth, runtime
- `ui/`: React board UI
- `cli/`: onboarding, configure, run, diagnose, worktree commands
- `packages/db/`: schema, migrations, DB helpers
- `packages/shared/`: shared types, validators, constants
- `packages/adapters/`: adapter packages
- `packages/plugins/`: plugin SDK, scaffolder, examples
- `docs/`: canonical project documentation
- `releases/`: release notes

## Development

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```

更完整的开发、数据库、验证和文档规范见：

- [docs/development/index.zh-CN.md](docs/development/index.zh-CN.md)
- [docs/development/index.en.md](docs/development/index.en.md)

## Community

- [Discord](https://discord.gg/m4HZY7xNG3)
- [GitHub Issues](https://github.com/paperclipai/paperclip/issues)
- [GitHub Discussions](https://github.com/paperclipai/paperclip/discussions)

## License

MIT
