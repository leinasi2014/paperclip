# Development

## 前置条件

- Node.js 20+
- pnpm 9+
- 本地开发默认不需要外部数据库

## 标准本地流程

```bash
pnpm install
pnpm dev
```

常用变体：

- `pnpm dev:server`
- `pnpm dev:once`
- `pnpm paperclipai run`

## 验收门禁

在宣称完成前执行：

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```

## 数据库流程

1. 修改 `packages/db/src/schema/*`。
2. 从 `packages/db/src/schema/index.ts` 导出新 schema。
3. 执行 `pnpm db:generate`。
4. 重新跑完整验收门禁。

## 文档流程

- 项目级文档统一放在 `docs/`。
- 使用成对的正式文件：`*.en.md` 与 `*.zh-CN.md`。
- 新的进行中计划文档放在 `docs/plans/`，文件名使用 `YYYY-MM-DD-slug.md`。
- 过期计划直接删除，不保留大规模历史档案。

## 贡献入口

- 仓库规则：[`../../AGENTS.md`](../../AGENTS.md)
- 贡献流程：[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)
- 发布记录：[`../../releases/`](../../releases/)
