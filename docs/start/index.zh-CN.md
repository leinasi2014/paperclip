# Start

## Paperclip 是什么

Paperclip 是一个 AI agent 公司控制平面。它不替代 Claude Code、Codex、OpenClaw、shell worker 或 webhook 这类执行运行时，而是把它们组织进公司、汇报链、任务、预算、审批和运行循环里。

## 适合什么场景

- 你管理的不止一个 agent，需要清晰责任边界
- 你需要稳定的任务历史，而不是零散终端会话
- 你需要成本可见性和预算硬停
- 你需要对招聘、战略等高风险动作加审批门禁
- 你要在核心控制平面之上扩展插件和 company package

## 从这里开始

- 首次运行: [quickstart.zh-CN.md](quickstart.zh-CN.md)
- 产品模型: [../product/index.zh-CN.md](../product/index.zh-CN.md)
- 运行架构: [../architecture/index.zh-CN.md](../architecture/index.zh-CN.md)

## 核心概念

- Company：数据、agent、目标和工作的隔离边界
- Agent：由 adapter 和运行时配置驱动的员工
- Issue：带单一领取语义的任务实体
- Goal：所有工作向上追溯的业务目标
- Heartbeat：由时间或事件触发的有限执行窗口
- Approval：对受治理动作生效的人类董事会门禁
