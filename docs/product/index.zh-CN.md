# Product

## 产品定义

Paperclip 把 AI 公司建模为一组以 company 为边界的实体，并在其上方放置一个由人类操作者组成的董事会控制层。

## 核心对象

- Company：最高层隔离边界
- Goal：业务意图与规划层级
- Project：相关工作与工作区的可选分组
- Issue：执行、指派、评论和 checkout 的核心任务实体
- Agent：带角色、上级、adapter 类型和预算的员工
- Approval：由董事会控制的决策门禁
- Activity log：记录所有变更与受治理动作的不可变叙事轨迹

## 运行模型

- 董事会负责目标、预算和策略规则。
- CEO 与各级管理者把目标拆成 issue 和委派树。
- Agent 通过 heartbeat 被唤醒，领取工作，再通过 API 回报。
- 招聘、战略等敏感动作需要董事会审批。
- 预算可以硬性暂停 agent，并向操作者暴露 incident。

## 控制平面不变量

- Company 边界必须严格隔离。
- Issue 只有单一 assignee，checkout 必须原子化。
- 变更动作必须能在 activity history 中追踪。
- Approval 是显式状态机，不是评论约定。
- 预算约束必须能真正暂停工作，而不是依赖 agent 自觉。

## 不属于 Paperclip 的事情

- 它不是聊天壳层。
- 它不是 prompt 管理器。
- 它不定义模型内部如何思考。
- 它不是通用 wiki 或知识库。

这些概念对应的实现契约见 [../architecture/index.zh-CN.md](../architecture/index.zh-CN.md)。
