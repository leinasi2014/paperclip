# Extensions

## Adapters

Adapter 用来把 Paperclip 连接到具体执行运行时。内置覆盖本地 CLI adapter、通用 process/http adapter，以及 OpenClaw gateway 路径。

包级配置说明以各自 README 为准：

- [`../../packages/adapters/openclaw-gateway/README.md`](../../packages/adapters/openclaw-gateway/README.md)

## Plugin System

Plugin 通过 worker、UI slot、action、data endpoint、job、stream 和安装元数据扩展控制平面。项目级 plugin 概览以本页为准，包 README 只保留包内使用细节。

主要包文档：

- [`../../packages/plugins/sdk/README.md`](../../packages/plugins/sdk/README.md)
- [`../../packages/plugins/create-paperclip-plugin/README.md`](../../packages/plugins/create-paperclip-plugin/README.md)

## Company Package

Paperclip 支持 markdown-first 的 company package，用于导入导出和可复用组织模板。当前仓库把它视为扩展能力，而不是核心运行时契约。

## 扩展文档规则

- 项目级扩展文档放在 `docs/extensions/`。
- 包 README 只保留包级安装与使用说明。
- 被运行时直接读取的 Markdown 继续和代码放在一起。
