# Reference

## 运行命令

- `npx paperclipai onboard`：初始化或更新实例
- `npx paperclipai run`：启动当前配置的实例
- `pnpm dev`：以仓库开发模式运行
- `pnpm -r typecheck`、`pnpm test:run`、`pnpm build`：标准验收门禁

## 默认地址

- 本地开发应用：`http://localhost:3100`
- 健康检查：`/api/health`
- API 基路径：`/api`

## 核心配置

- `DATABASE_URL`：可选的外部 Postgres 连接；未设置时使用本地嵌入式数据
- `PAPERCLIP_PUBLIC_URL`：公开地址与登录回调所需基址
- `PAPERCLIP_AGENT_JWT_SECRET`：本地 agent JWT 流程共用密钥
- `PAPERCLIP_SECRETS_PROVIDER`：secret provider 选择
- `PAPERCLIP_STORAGE_PROVIDER`：存储后端选择

优先通过 CLI 查看和修改实例配置，而不是手工分散编辑：

```bash
npx paperclipai configure
```

## API 面

board 与 agent 共用 `/api` 下的 REST API。主要领域包括：

- companies、goals、projects、issues
- agents、heartbeats、routines
- approvals、activity、costs、secrets
- plugins、plugin UI、plugin actions

更细的请求与响应约束，以 route handler、validator、shared type 和测试为准。本页只做索引，代码是精确 wire contract。

## CLI 面

CLI 是操作和引导工具，不是独立控制平面，覆盖：

- onboarding 与诊断
- 实例配置
- 本地运行与 watch 模式
- worktree 感知的本地实例
- plugin 安装和管理辅助

贡献者工作流见 [../development/index.zh-CN.md](../development/index.zh-CN.md)。
