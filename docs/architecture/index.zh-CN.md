# Architecture

## 文档角色

这里是当前仓库的 V1 实现契约。若源码行为与旧叙述型文档冲突，以此页和代码为准。

## 运行层次

- `ui/`：React 操作台界面
- `server/`：Express API、鉴权、编排、plugin host、运行时服务
- `cli/`：onboarding、configure、run、doctor、worktree 和控制平面命令
- `packages/db/`：schema 与 migration
- `packages/shared/`：共享类型与常量
- `packages/adapters/*`：各 adapter 的运行时集成
- `packages/plugins/*`：plugin SDK、脚手架和示例

## 核心运行循环

1. heartbeat 由定时、指派、提及、自动化或手动调用触发。
2. server 解析 agent、权限、预算与上下文。
3. 配置好的 adapter 执行外部运行时。
4. 外部运行时再回调 Paperclip API 处理任务、评论、审批和状态。
5. server 持久化日志、成本、状态迁移和下一次运行所需的会话上下文。

## 持久化与隔离

- 所有业务实体都必须按 company 隔离。
- 鉴权明确区分 board user 与 agent。
- API key 以哈希形式存储。
- 所有变更动作都要求 activity logging。
- 预算、审批和 issue checkout 由 server 统一强制执行。

## 部署契约

- 未设置 `DATABASE_URL` 时，开发环境默认使用本地嵌入式数据。
- 支持的暴露模型是 `local_trusted`，或带 `private/public` 暴露策略的 `authenticated`。
- board UI 与 API 共用同一应用宿主。

## 正式参考

- 产品模型: [../product/index.zh-CN.md](../product/index.zh-CN.md)
- 命令与配置: [../reference/index.zh-CN.md](../reference/index.zh-CN.md)
- 操作与部署: [../guides/index.zh-CN.md](../guides/index.zh-CN.md)
- 开发者流程: [../development/index.zh-CN.md](../development/index.zh-CN.md)
