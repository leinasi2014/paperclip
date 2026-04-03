# 快速开始

## 最快启动方式

```bash
npx paperclipai onboard --yes
```

这会初始化本地 Paperclip 实例并准备默认路径。再次执行 `onboard` 时，除非你显式修改配置，否则现有实例数据会被保留。

后续启动：

```bash
npx paperclipai run
```

## 在仓库里做本地开发

```bash
pnpm install
pnpm dev
```

默认行为：

- 地址：`http://localhost:3100`
- 数据库：未设置 `DATABASE_URL` 时使用嵌入式 PGlite/Postgres 兼容本地数据
- 鉴权模式：使用当前配置；新实例按 onboarding 默认值初始化

## 首次验证

```bash
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

## 下一步

1. 创建 company。
2. 创建 CEO agent。
3. 配置 `claude_local`、`codex_local`、`process`、`http` 或 `openclaw_gateway` 等 adapter。
4. 设定目标并创建第一个 issue。
5. 在控制台中观察 heartbeat、审批和 activity log。

更完整的开发与验证流程见 [../development/index.zh-CN.md](../development/index.zh-CN.md)。
