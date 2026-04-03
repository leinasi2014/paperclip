# Guides

## 部署模式

- `local_trusted`：仅本机地址，启动最快，无需 board 登录流
- `authenticated + private`：需要登录，适合局域网、Tailscale、VPN 等私有网络
- `authenticated + public`：需要登录，必须配置明确公开地址，适合公网部署

## 操作者工作流

- 先创建 company 和 CEO
- 想让 heartbeat 真正执行前，先把 adapter 配置完整
- 受治理动作走 approval，而不是依赖口头约定
- 在 board UI 里持续观察 activity、cost 和 agent status

## 排障入口

- 健康检查：`curl http://localhost:3100/api/health`
- 运行配置：`npx paperclipai configure`
- 完整验证：`pnpm -r typecheck && pnpm test:run && pnpm build`

## 相关文档

- 命令与配置: [../reference/index.zh-CN.md](../reference/index.zh-CN.md)
- 贡献者流程: [../development/index.zh-CN.md](../development/index.zh-CN.md)
- 扩展体系: [../extensions/index.zh-CN.md](../extensions/index.zh-CN.md)
