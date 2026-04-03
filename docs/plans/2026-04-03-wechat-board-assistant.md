# 微信 Board Assistant 总控方案

## 摘要

- 新增一个实例级的 Board Assistant，位于所有 company 之上，作为微信总控入口；它是系统服务人格，不是新的跨公司 `agent` 记录。
- 微信只对接这个 Board Assistant。查询类请求可自动判断公司范围；任何创建、修改、调度、催办类动作都必须显式指定 company 或 company group。
- 涉及改动的微信指令，先写入一层全局请求账本，再为每个目标 company 生成一个公司内 CEO issue，由各 company 的 CEO 继续拆分和执行。
- 微信侧只接收聚合后的阶段汇报，不直接暴露各公司内部的细粒度 run 或 log 事件流。

## 关键改动

### 身份与权限模型

- 以 `board` / `instance_admin` 权限实现 Board Assistant，不修改现有 `agents.companyId` 的单公司约束，也不引入跨公司 agent JWT。
- Board Assistant 作为实例级控制面能力存在，代表 board 调度各 company，而不是替代 company 内的 CEO。
- 增加实例级配置：
  - 微信通道开关
  - 允许的微信用户白名单
  - 默认 company groups
  - 发送节流策略

### 全局请求账本

- 新增实例级数据模型：
  - `board_assistant_threads`
  - `board_assistant_requests`
  - `board_assistant_request_targets`
  - `board_assistant_outbox`
- `threads` 负责微信会话映射。
- `requests` 记录一次总控指令。
- `request_targets` 记录每个目标 company 的派发结果。
- `outbox` 记录待回发给微信的汇总消息。
- 每条请求保存：
  - 来源渠道 `wechat`
  - 外部用户或线程 ID
  - 原始文本
  - 解析后的意图
  - 目标 company 列表
  - 最终状态
  - 已发送检查点
  - 关联 CEO issue ID / run ID

### 公司内落单与执行

- 任何改动类请求，都按目标 company 各自创建一个 CEO issue，保持所有业务实体仍然 company-scoped。
- 这些 CEO issue 默认落在各 company 的 canonical `System Governance` project 下，便于审计和统一查看。
- 创建后直接指派给该 company 的 CEO，并在没有活跃 run 接管时主动唤醒 CEO。
- 不使用跨 company 的 issue 父子关系；全局请求账本才是跨 company 的父层。

### 微信桥接

- `weixin-ilink` 运行在独立 bridge worker 中，不塞进 heartbeat 或 company agent runtime。
- bridge 负责：
  - 扫码登录
  - bot token 持久化
  - cursor 持久化
  - 重连
  - 消息去重
  - 调用 Paperclip 的 board-assistant ingress API
- bridge 使用 board API key 访问 Paperclip。
- v1 仅允许你本人这个微信用户进入系统；其他用户收到固定拒绝消息，且不产生任何副作用。

### 路由与交互规则

- 查询类：可自动解析一个或多个 company，并返回聚合结果。
- 改动类：必须显式指定 company 或预定义 company group；若缺失或歧义，则只返回澄清，不执行任何落单或调度。
- 支持“所有已配置公司”作为内置 company group，但仍按 company 逐个派发、逐个跟踪。
- 每个全局请求都要能反查到：
  - 微信消息
  - 目标 company
  - 对应 CEO issue
  - 活跃 run
  - 最终回执

### 进度汇报

- 进度按 company target 聚合为阶段：
  - `queued`
  - `routed`
  - `executing`
  - `blocked`
  - `done`
  - `failed`
- 汇总来源是各 company CEO issue 状态和活跃 heartbeat runs，不直接推原始日志。
- 仅在关键阶段变化、数量变化、出现 blocker、或全部完成时生成微信播报。
- 最终回包固定包含：
  - 总体摘要
  - 各 company 状态行
  - 需要你介入的 blocker
  - 可追踪标识符

## Public API / Interface 变化

- 新增 board-only 接口用于：
  - 接收外部渠道消息 ingress
  - 查询全局请求列表与详情
  - 读取线程 outbox
  - 预览 company 解析结果
- 新增紧凑的请求状态返回结构：
  - 请求元数据
  - 目标 company
  - 关联 CEO issue
  - 活跃 run
  - 聚合阶段计数
  - 下一批待发微信消息
- 扩展 activity log，在所有 Board Assistant 触发的变更中写入：
  - `requestId`
  - `channel`
  - 外部用户 ID
  - 目标 companies

## 测试方案

- 权限与隔离：Board Assistant 仅在 board / instance-admin 身份下拥有跨 company 能力；现有 agent 仍然禁止跨 company。
- 路由规则：查询可自动解析 company；改动类在未显式指定 company/group 时返回澄清，且不创建任何 CEO issue。
- 派发正确性：一次针对多个 company 的改动请求，会生成 1 条全局请求和多条落在正确 company `System Governance` project 中的 CEO issue。
- 聚合汇报：当不同 company 处于 `done` / `blocked` / `running` 混合状态时，微信收到的汇总消息符合预期且不会重复刷屏。
- 通道安全：非白名单微信用户无法触发任何系统动作。
- bridge 韧性：长轮询超时、断线重连、cursor 恢复、token 过期、重复消息去重都不会造成重复落单。
- 审计闭环：每次改动都能从微信消息追溯到全局请求、company target、CEO issue 和 activity log。

## 假设与默认值

- “系统 agent”在实现上是实例级 Board Assistant 服务或人格，不是新增跨 company `agents` 记录。
- v1 只服务你本人，一个全局微信 bot，一个白名单微信用户。
- 查询类自动路由；任何创建、修改、调度、催办、取消动作都必须显式指定 company 或 company group。
- 微信汇报采用聚合阶段播报，不推送细粒度 run / log 流。
- 查询只进入全局请求账本；改动类必须形成正式的 company-scoped CEO 工作单。
