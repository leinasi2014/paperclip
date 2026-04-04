# 多通道 Board Assistant 总控方案

## 摘要

- 新增一个实例级 `Board Assistant`，更准确地说是“你的个人 Executive Assistant”；它位于所有 company 之上，作为外部聊天入口；它是实例级系统服务人格，不是新的跨 company `agent` 记录。
- v1 先接微信，但渠道接入层必须从一开始就设计成多通道插件架构，后续可扩展到飞书等 app，而不重写上层请求、审计、派发和聚合逻辑。
- 外部聊天侧要优先呈现“像普通人一样交流的助理”，不是冷冰冰的控制台接口；它允许自然对话，也允许发起正式动作；但所有正式动作都必须先进入全局请求账本，再按动作类型走“确认 -> 执行”流程。
- company-scoped 动作在确认后创建对应 company 的 CEO issue，由各 company CEO 继续拆分和执行。
- instance-scoped 动作由 Board Assistant 在确认后直接执行；v1 明确包含公司创建和公司删除。
- 查询类请求只支持精确 company、静态 company group 或明确内置 group，不做模糊自动路由；写请求可以自动分析更适合的 company，但必须先向你展示建议并等待确认。
- Board Assistant 的请求编排与实例级执行保留在 core；微信、飞书等 app 对接下沉为 channel adapter plugins。
- v1 要优先把安全和一致性写实：确认机制、幂等、崩溃恢复、删除语义和插件边界必须在 plan 层锁定，不能留到实现时再猜。
- 这个助理在产品体验上要像正式员工一样拥有完整人格包，至少包含：
  - `SOUL.md`
  - `AGENTS.md`
  - `HEARTBEAT.md`
  - `TOOLS.md`
- 助理需要长期记忆，不只是短期 thread 上下文；但长期私人记忆必须和正式系统审计数据分层。

## 目标定义

### 助理定位

- 它是全局唯一、实例级、代表你本人的个人助理。
- 它不是某个 company 下的员工，不隶属于某个 CEO 链条。
- 它在实现上是实例级系统人格 / 服务；在产品体验上要像一个正式员工一样稳定存在。
- 它的第一身份是“助理”，第二身份才是“控制面代理”：
  - 默认像人一样交流
  - 识别出任务意图时，先整理思路，再请示确认是否执行
  - 当你明确下达任务时，再进入正式动作流

### 人格文档包

- 助理必须拥有和正式员工一致的 4 份文档包：
  - `SOUL.md`
  - `AGENTS.md`
  - `HEARTBEAT.md`
  - `TOOLS.md`
- 这 4 份文档用于承载：
  - 人格和语气
  - 与你互动的规则
  - 对任务与确认的处理方式
  - 技能与系统工具使用策略
- 由于它是实例级系统人格，不应直接复用某个 company agent 的默认包；应新增独立 assistant bundle。
- assistant bundle 采用实例级、版本化、数据库落库的真相源，而不是散落在渠道插件或临时文件里。
- 每次 bundle 变更至少保存：
  - `revisionId`
  - `bundleKind`
  - `content`
  - `updatedBy`
  - `updatedAt`
  - `changeReason`
- v1 至少维护一份 `active revision` 和最近若干历史 revision，支持回看、回滚与审计。

## 关键改动

### 身份与权限模型

- Board Assistant 以 `instance_admin` 身份运行，不复用普通 `board` company membership 语义。
- 不修改现有 `agents.companyId` 的单公司约束，也不引入跨公司 agent JWT。
- 渠道插件不直接继承 `instance_admin`；它们只负责协议接入、消息标准化、回执投递和连接状态维护。
- 只有 Board Assistant core 可以执行实例级动作、创建 company-scoped CEO issue、写入全局请求状态机。
- 助理虽然代表你本人，但不等于“所有话都直接变成系统动作”；聊天与正式动作之间始终隔着确认和审计边界。
- 外部用户不能直接等同于 Paperclip 身份；必须先在 Web 控制面完成一次性绑定，建立：
  - 外部渠道 `channel`
  - 外部用户 ID
  - 实例管理员身份
  - 绑定状态与撤销状态
- v1 只允许你本人绑定一个外部聊天身份；其他外部用户统一拒绝，不产生任何系统副作用。
- 绑定流程必须是受控的一次性鉴权流程，而不是口头声明：
  - 你先在 Web 控制面发起某个 channel 的绑定请求
  - 系统生成一次性 `bindingSession`，其中包含 `bindingId`、`bindingToken`、`channel`、`expiresAt`
  - `bindingSession` 绑定到当前已登录的实例管理员会话，并记录 `initiatedBy`
  - Web 端展示一个一次性短码或深链载荷，由你从目标外部账号主动发送给助理
  - 外部渠道侧只有携带该 token 回传时，才允许进入候选绑定态，不能直接完成最终绑定
- v1 的 `bindingToken` 规则固定为：
  - 单次使用
  - 默认有效期 `10 分钟`
  - 成功绑定后立即失效
  - 新建 token 后，旧的未使用 token 自动失效
- 绑定握手必须分两段完成：
  - 第 1 段：
    - 目标外部账号把 `bindingToken` 发送到对应渠道
    - channel plugin 把 `channel`、`externalUserId`、`externalThreadId`、`bindingToken` 送入 core
    - core 只把该身份标记为 `binding_candidate`，不直接激活
  - 第 2 段：
    - Web 控制面回显候选身份摘要，如渠道、外部昵称、外部用户 ID 摘要、最近线程标识
    - 你在同一实例管理员会话里点击最终确认
    - 只有这一步完成后，才把该外部身份切换为 `active binding`
- 完成最终绑定时必须同时校验：
  - token 未过期
  - token 尚未使用
  - `bindingSession` 处于 `pending_web_confirm`
  - 候选 `externalUserId` 与回显到 Web 的候选记录一致
  - 当前实例还没有其他活跃的外部身份绑定
- 若 token 被其他外部账号抢先发送：
  - 该账号只会进入候选态
  - 最终是否激活仍由 Web 侧的实例管理员显式确认
  - 你可以在 Web 侧取消该候选绑定并使 token 失效
- v1 不允许静默覆盖已有活跃绑定：
  - 若已存在活跃外部身份，必须先显式解绑旧身份
  - 解绑完成前，不允许新绑定转正
- 解绑流程必须同步收口旧会话：
  - 立即撤销该外部身份映射
  - 立即失效所有未使用的 binding token
  - 该外部身份关联的旧 thread 不再允许继续推进动作
  - 该外部身份名下处于 `received/clarifying/proposed` 的请求进入 `cancelled`
  - 已进入正式执行的请求保留审计记录，但不再接受旧身份后续确认
- `bindingSession` 状态至少包含：
  - `pending_channel_handshake`
  - `pending_web_confirm`
  - `active`
  - `expired`
  - `cancelled`
  - `revoked`
- 撤销外部绑定时，必须同时：
  - 使该外部身份下的活跃 thread 失效
  - 使未完成的待确认请求失效或转入 `cancelled`
  - 阻止旧渠道会话继续推进任何正式动作
- 增加实例级配置：
  - 通道开关
  - 允许的外部用户绑定
  - 静态 company groups
  - 发送节流策略
  - 高风险动作确认策略
  - 自动执行模式
  - 主动提醒阈值

### 静态 company groups

- `static company group` 不是自由文本别名，而是实例级显式配置。
- 每个 group 至少包含：
  - `groupKey`
  - `displayName`
  - `companyIds`
  - `enabled`
  - `updatedAt`
- group 只允许 board 在 Web 控制面维护，不允许聊天侧动态创建或修改。
- 解析规则固定为：
  - 先匹配精确 company
  - 再匹配精确 `groupKey`
  - 再匹配有限的内置 group
- v1 内置 group 只保留最小集合：
  - `all-active-companies`
- `all-active-companies` 默认关闭，只有实例管理员显式启用后才可在聊天里使用。
- `all-active-companies` 在 v1 只允许用于查询，不允许作为写请求目标组。

### 全局请求账本

- 新增实例级数据模型：
  - `board_assistant_threads`
  - `board_assistant_requests`
  - `board_assistant_request_targets`
  - `board_assistant_outbox`
- `threads` 负责外部会话映射，不绑定某个单一 app 协议。
- `requests` 记录一次外部聊天请求。
- `request_targets` 记录请求派发或执行的目标，可覆盖：
  - `company`
  - `instance`
- `outbox` 记录待回发给外部聊天 app 的聚合消息。
- 每条请求保存：
  - 来源渠道，如 `wechat`、`feishu`
  - 外部用户 ID
  - 外部线程 ID
  - 外部消息 ID / 幂等键
  - 规范化消息载荷
  - 原始文本
  - 解析后的意图
  - 推荐目标 company 或 group
  - 最终确认目标
  - 最终状态
  - 已发送检查点
  - 关联 CEO issue ID / run ID / instance action ID
- 原始聊天消息保留策略在 v1 固定为：
  - 原始入站消息默认保留 `90 天`
  - 超期后仅保留必要审计摘要与标识符

### 助理交互模式

- 助理默认先做意图分析，而不是把每条消息都当命令。
- 当它判断你的表达更像“任务意图”时，应先生成一段结构化理解，再请示你是否执行。这个结构化理解至少包含：
  - 它理解到的目标
  - 可能涉及的 company / 员工 / 系统对象
  - 建议的下一步动作
  - 是否属于正式动作
- 当你的表达只是聊天、思考或探索时，它保持助理对话模式，不强行落单。
- 当你明确下达任务时，它可以直接走 `proposed` 或执行链路，但仍需遵守确认规则。
- 若你开启自动执行模式，助理只可对系统预定义白名单内的低风险动作跳过显式确认，不能跳过正式审计。

### 首次 Onboarding

- 助理第一次在微信中与你建立会话时，应进入轻量 onboarding，而不是直接使用硬编码人格。
- v1 onboarding 采用 5 步轻量流程：
  - 助理名字
  - 助理对你的称呼
  - 助理风格偏好
  - 是否开启自动执行
  - 是否允许主动提醒与简报
- onboarding 的结果分别写入：
  - `SOUL.md`
  - 用户偏好配置
  - 主动提醒与自动执行默认值
- onboarding 不是一次性封死；后续允许通过明确指令继续调整。
- onboarding 必须支持中断恢复，而不是要求一次聊完：
  - 保存当前步骤索引
  - 保存已回答字段
  - 保存 `expiresAt`
- 若在 TTL 内重回对话，应从上次步骤续接。
- 若超过 TTL，则重新开始 onboarding，但要提示你之前已有部分输入且未完成。
- v1 onboarding 续接 TTL 固定为 `24 小时`。

### SOUL 可塑性

- `SOUL.md` 是助理人格的可塑层，允许通过聊天指令修改。
- `SOUL.md` 修改流程必须是：
  - 识别为人格修改意图
  - 生成修改预览
  - 用户确认
  - 再写入 `SOUL.md`
- 允许通过 `SOUL.md` 修改的内容包括：
  - 人格风格
  - 关系称呼
  - 互动语气
- 不允许通过 `SOUL.md` 修改的内容包括：
  - 越权能力
  - 安全边界
  - 审计要求
  - 确认机制
- `SOUL.md` 最终修改权只属于你本人：
  - 助理自己不能直接改
  - 员工不能改
  - 后台记忆整理模型不能直接改
  - 它们最多只能提出修改建议
- `SOUL.md` 的技术写入门禁必须独立于普通聊天通道：
  - 只有 founder 确认后的专用写入入口才允许提交新 revision
  - channel plugin 不能直接写 `SOUL.md`
  - 后台记忆模型不能直接写 `SOUL.md`
  - core 内部服务也不能绕过确认直接改写 active revision
- `SOUL.md` 写入采用原子切换：
  - 先写新 revision
  - 再切换 active revision
  - 切换失败时不得覆盖旧 revision

### 结构化任务卡片

- 当助理识别到任务意图时，应优先生成结构化任务卡片，而不是只返回长段自然语言。
- 自然语言可以作为引导层，但正式进入执行链路时必须落到结构化卡片。
- v1 任务卡片至少固定包含这些字段：
  - `我理解的任务`
  - `目标对象`
  - `建议动作`
  - `风险等级`
  - `执行方式`
  - `是否会创建正式系统对象`
  - `理解依据`
  - `计划调用`
  - `待你确认`
  - `预期产出`
- `理解依据` 只给简短摘要，不展示长篇推理。
- `理解依据` 仅允许 1 到 3 条短摘要，避免把不可审计的长推理暴露成执行依据。
- `计划调用` 至少应说明：
  - 是否调用 skill
  - 是否依赖系统插件
  - 是否创建 CEO issue
  - 是否执行 instance action
  - 是否只是对内沟通
- `计划调用` 以能力级别展示，不暴露底层私有实现细节、内部 prompt 或私有插件状态。

### 任务卡片交互

- 微信里的任务卡片同时支持：
  - 自然语言确认
  - 按钮式快捷确认
- v1 基础按钮集合为：
  - `确认执行`
  - `先生成草稿`
  - `只做分析`
  - `修改理解`
  - `稍后提醒我`
  - `取消`
- `修改理解` 走自然语言修正，而不是复杂表单。
- 助理应通过自然语言继续引导你指出要修正的是：
  - 任务
  - 对象
  - 方式
  - 语气
  - 风险判断
- `稍后提醒我` 的 v1 行为：
  - 助理追问轻量时间选项
  - 支持 `1小时后 / 今晚 / 明天 / 自定义`
  - 并把请求挂入待确认队列、主动提醒计划和简报聚合
- `先生成草稿` 的 v1 产物类型至少包含：
  - `消息草稿`
  - `issue 草稿`
  - `公告草稿`
  - `人格修改草稿`
- `只做分析` 不进入执行链、不创建正式对象，默认输出结构化分析卡片，至少包含：
  - `核心判断`
  - `主要风险`
  - `可选方案`
  - `我的建议`
  - `是否建议转为正式任务`

### Thread 生命周期

- `threads` 不只是映射表，还要保存最小对话状态：
  - 最近一次入站时间
  - 最近一次出站时间
  - 最近一次确认请求 ID
  - 活跃上下文摘要
  - 过期时间
- v1 只保留短期上下文，不把 thread 当长期知识库：
  - 默认仅保留最近一次待确认请求和最近若干条消息摘要
  - 超过 TTL 后自动裁剪上下文
- 若同一 thread 上存在未完成 `proposed` 请求，新写请求默认先要求处理该请求，而不是无限并行堆积。
- `clarifying` 也不能无限挂起：
  - v1 的 `clarifying` TTL 固定为 `24 小时`
  - 超过 TTL 后进入 `expired`
  - 若你在 TTL 内补足信息，则继续进入 `proposed` 或 `done`

### 对内长期线程

- 助理与每个 CEO / 正式员工之间，都应有独立长期线程，而不是每次临时开新对话。
- v1 不做复杂“事项分支线程”：
  - 每人一个长期主线程
  - 具体事项通过正式对象引用挂上下文
- 长期线程支持：
  - 自动归档
  - 自动唤醒
- 长期不活跃时可自动归档；出现新消息或新事项时自动唤醒。
- 归档不会删除 relationship memory，只会收起活跃上下文。
- 这些对内长期线程默认对你完全可见：
  - 可查看历史
  - 可插话
  - 可接管
  - 可改写方向
- 你对这些线程至少有 3 种介入模式：
  - `旁观`
  - `联合发言`
  - `接管`
- 模式切换只能通过显式 founder 动作触发，不能由助理自行猜测：
  - Web 控制面切换
  - 明确聊天指令切换
- 线程级模式状态必须持久化保存，至少包含：
  - `threadMode`
  - `setBy`
  - `setAt`
- 默认模式为 `旁观`：
  - 助理继续代表你运行该线程
  - 你默认只看、不主动插入
- `联合发言` 表示：
  - 你与助理都可在同一线程发言
  - 每条消息都必须保留真实作者标记
  - 助理不能把你的原话自动改写成自己的话，除非你明确要求它代拟或润色
- 若 `联合发言` 中你的新消息与助理此前代言内容冲突：
  - 以你最新的明确消息为准
  - 助理不得静默篡改旧消息
  - 助理后续若继续代言，应显式按你的最新口径更新
- `接管` 表示：
  - 该线程进入 founder 主导模式
  - 助理在该线程默认静默，不再主动代言
  - 助理仍可私下给你草稿建议，但不直接对员工发言
  - 只有你显式释放接管后，助理才恢复代言
- 线程访问控制必须明确：
  - 你拥有完整可见性与导出权
  - 助理拥有执行所需可见性
  - 非相关 CEO / 员工不得查看他人的长期线程
  - 导出默认只对你开放，并记录审计
- 员工侧需要感知线程中的真实说话人，不能把你和助理混成一个匿名身份。

### 助理长期记忆

- 助理需要独立于 thread 的长期记忆层，不能只靠短期会话上下文。
- 长期记忆不做成独立第三方插件真相源；v1 以内建 memory core 为主，并保留后续 provider 扩展位。
- 长期记忆至少拆成 5 类：
  - `persona memory`
  - `preference memory`
  - `relationship memory`
  - `working memory`
  - `skill memory`
- 另外保留一层独立的 `audited action memory`，专门关联 request / issue / approval / activity。
- `assistant private memory` 与 `audited action memory` 必须分层：
  - 私人助理记忆默认不暴露给普通员工、CEO 或渠道插件
  - 正式动作只有在进入 request / issue / activity 后才写入系统审计层
- 助理可以记住你的短期状态，例如：
  - 今天很急
  - 想先听结论
  - 当前更偏好短回复
- v1 不自动固化你的长期心理标签，不做病理化或人格化心理判断。
- 助理和 CEO / 员工的对内沟通，会自动沉淀为摘要，优先写入：
  - `relationship memory`
  - `working memory`
- 对内沟通默认不把完整原文写入私人记忆层，而是提炼为：
  - 沟通风格偏好
  - 响应速度印象
  - 协作可靠性线索
  - 更有效的沟通方式
- 你必须拥有私人记忆的可审阅能力，v1 至少支持：
  - 查看 memory 摘要
  - 查看来源引用
  - 手动清除单条记忆
  - 手动禁止某类记忆继续沉淀
- 长期记忆必须支持压缩与淘汰策略：
  - `working memory` 保留活跃事项
  - 已完成事项先摘要，再降级出活跃层
  - `relationship memory` 保留稳定模式，不无限堆积原始对话
  - 长历史默认保留压缩摘要与来源引用，而不是无限原文
- 当记忆发生冲突时，优先级固定为：
  - 你在当前会话中的明确指令
  - 当前活跃线程上下文
  - 高置信长期记忆
  - 低置信推断记忆
- 助理不得因为旧记忆而覆盖你当前的明确表达。

### 记忆整理与演化

- 助理允许自动整理和演化长期记忆，但采用异步后台模型，不阻塞前台对话。
- 后台记忆整理模型可以使用单独的 LLM 供应商或单独模型，不要求与前台对话模型相同。
- 推荐的后台触发时机：
  - 一段长对话结束后
  - 任务完成 / 取消后
  - 上下文接近长度阈值时
  - 定时低频整理
- 后台模型输出必须是结构化记忆提案，而不是直接自由改写。
- 低风险记忆允许自动写入，例如：
  - 沟通偏好
  - 常用称呼
  - 低风险工作习惯
- 高价值或高敏感记忆先进入待确认队列，例如：
  - 身份信息
  - 长期偏好判断
  - 人际关系判断
  - 重要合作模式归纳
- 自动整理失败时，至少保留摘要或原始归档，不允许静默丢失历史。
- 私人记忆允许内用，不允许默认外传：
  - 助理可以用私人记忆帮助自己理解你
  - 但对外给 CEO / 员工的内容默认只能转成工作表达
  - 只有你明确要求时才允许显式引用私人记忆
- 对外发给 CEO / 员工之前，必须经过 `memory redaction / policy gate`：
  - 检查是否包含私人偏好、情绪、关系判断等默认不外传信息
  - 必要时自动改写成工作表达
  - 命中高敏感规则时要求你再次确认
- `memory redaction / policy gate` 采用两段式：
  - 先走确定性规则检查，如私人称呼、情绪标签、关系判断、未授权个人偏好
  - 再走受控改写步骤，把可发送内容转换成工作表达
- gate 的每次决策都必须记录审计摘要，至少包含：
  - 原始消息是否命中敏感规则
  - 是否发生改写
  - 是否要求你额外确认
  - 最终是否允许发送
- 命中高敏感规则后的额外确认沿用正式请求确认链路，v1 的确认 TTL 固定为 `24 小时`。
- 后台记忆整理若使用外部 LLM，必须遵守最小化出站策略：
  - 默认发送结构化摘要而不是完整敏感原文
  - 仅允许经过白名单的记忆类别出站
  - 最高敏感内容允许强制本地处理，不发第三方模型
- 若后台记忆整理模型不可用：
  - 不影响前台聊天主链
  - 新记忆先进入待整理队列
  - 由后续恢复任务补做整理

### 请求状态机

- 所有正式动作统一进入全局请求状态机：
  - `received`
  - `clarifying`
  - `proposed`
  - `confirmed`
  - `queued`
  - `routed`
  - `executing`
  - `blocked`
  - `cancelled`
  - `expired`
  - `done`
  - `failed`
- 查询类请求通常只走：
  - `received -> done`
  - 或 `received -> clarifying -> done`
- `clarifying` 不是无限等待态：
  - core 必须保存待澄清字段列表
  - 收到足够澄清后进入 `proposed` 或 `done`
  - 超过澄清 TTL 后进入 `expired`
- company-scoped 写请求通常走：
  - `received -> proposed -> confirmed -> routed -> executing -> done|blocked|cancelled|expired|failed`
- instance-scoped 写请求通常走：
  - `received -> proposed -> confirmed -> executing -> done|blocked|cancelled|expired|failed`

### 确认机制

- 所有写请求必须先生成 `proposed` 预览，预览里至少包含：
  - 目标 scope
  - 目标 company / group / instance action
  - 将要调用的正式动作
  - 关键风险提示
  - `requestId`
- 普通确认支持两种入口：
  - 绑定聊天渠道内回复确认
  - Web 控制面确认
- 高风险确认只允许在 Web 控制面完成，不接受纯聊天内确认。
- `proposed` 请求必须设置确认 TTL；TTL 到期后进入 `expired`。
- v1 的 `proposed` 确认 TTL 固定为 `24 小时`。
- 你可以显式拒绝或取消请求；被拒绝或取消的请求进入 `cancelled`。
- 同一个 `requestId` 的确认动作必须幂等，重复确认只返回既有结果。

### 自动执行策略

- 助理是否自动执行正式动作，由用户配置决定，而不是系统全局写死。
- v1 支持 3 档执行模式：
  - `manual_confirm`
  - `low_risk_auto`
  - `enhanced_auto`
- 默认值为：
  - `manual_confirm`
- v1 的风险分级必须由系统预定义白名单驱动，不能让助理自由判断风险级别。
- `low_risk_auto` 仅允许系统白名单内的低风险动作自动执行。
- `enhanced_auto` 可放宽到更大范围，但仍受系统预定义风险边界约束。
- 下列动作在 v1 中始终禁止自动执行：
  - 公司删除
  - 高风险实例级动作
  - 需要高风险确认的动作
  - `SOUL.md` 人格修改
- 即使处于自动执行模式，助理也必须：
  - 写入正式审计
  - 保留 `requestId`
  - 支持事后追溯
  - 支持随时关闭自动执行
- v1 预定义的 `low_risk_auto` 白名单固定为：
  - 已存在正式对象上的 `follow-up` 消息
  - 已存在正式对象上的 `clarification` 消息
  - 你自己请求的提醒时间更新
  - 仅保存为草稿、不触发正式执行的草稿生成
- v1 的 `enhanced_auto` 仅在 `low_risk_auto` 基础上额外允许：
  - 对显式目标 company 生成低风险 `issue draft`
  - 基于显式来源对象发送 `notification` 消息
- 这里的“低风险 `issue draft`”固定指：
  - 仅创建草稿，不直接派发执行
  - 不涉及预算承诺
  - 不涉及人事、删除、停用、权限变更
  - 目标 company 由你显式指定，而不是系统猜测
- 自动执行白名单只能通过代码与受控实例配置维护：
  - 不能通过聊天修改
  - 不能通过 `SOUL.md` 修改
  - 不能通过长期记忆自动漂移
  - 不能由 channel plugin 私自扩权
- 执行模式只能由你通过以下入口修改：
  - onboarding
  - Web 控制面
  - 显式聊天配置指令并再次确认

### 崩溃恢复与状态推进

- core 对请求状态推进采用持久化状态机，不允许只在内存里推进。
- 每个可执行阶段都要记录：
  - `startedAt`
  - `updatedAt`
  - `workerLeaseOwner`
  - `leaseExpiresAt`
- core crash 或 worker 消失后，由恢复任务扫描卡住的请求：
  - 过期 lease 的 `queued/routed/executing` 请求重新评估
  - 可安全重试的回到 `queued`
  - 不可安全自动重试的进入 `blocked`
- 任何外部可见 `done/failed/blocked` 之前，都必须先把最终状态落库再发 outbox，避免“消息已发但状态未写”。
- 若前台意图解析主模型不可用：
  - 请求仍先落 `received`
  - 随后进入 `blocked`
  - `blockedReason` 固定为 `assistant_unavailable`
  - 由 outbox 返回一条降级说明，提示稍后重试

### 幂等策略

- ingress 幂等键作用域固定为：
  - `channel`
  - `externalUserId`
  - `externalThreadId`
  - `externalMessageId`
- channel plugin 和 core 都要做幂等：
  - plugin 负责协议层去重
  - core 负责请求账本去重
- CEO issue 创建、instance action 执行、outbox 投递都必须带独立幂等键：
  - CEO issue target key：`requestId + targetCompanyId`
  - instance action key：`requestId + actionKind + targetRef`
  - outbox key：`requestId + checkpointKind + targetRef`

### company-scoped 动作

- 任何 company-scoped 改动类请求，在确认后按目标 company 各自创建一个 CEO issue，保持所有业务实体仍然 company-scoped。
- 这些 CEO issue 默认落在各 company 的 canonical `System Governance` project 下，便于审计和统一查看。
- 创建后直接指派给该 company 的 CEO，并在没有活跃 run 接管时主动唤醒 CEO。
- 不使用跨 company 的 issue 父子关系；全局请求账本才是跨 company 的父层。
- 多 company 写请求仅允许对显式静态 company group 生效，派发语义是 `best-effort`：
  - 允许部分成功
  - 不回滚已创建 target
  - 每个 target 单独跟踪状态
- CEO 唤醒不是黑盒；规则固定为：
  - 创建 CEO issue 后若没有活跃 run 接管，则写入一次 wake request
  - 若在限定时间内仍没有 run claim，则该 target 进入 `blocked`
  - `blocked` 原因明确标注为 `ceo_not_claimed`
- v1 默认的 CEO claim 等待窗口为 5 分钟；后续可配置，但实现先按固定值落地。
- `ceo_not_claimed` 进入 `blocked` 后的恢复路径固定为：
  - 助理可在 CEO 长期线程里基于该 issue 做一次 `follow-up`
  - 你可以显式触发一次重新唤醒
  - 你也可以取消该 target
  - 不做无限后台自动重试
- `ceo_not_claimed` 不允许绕过正式 issue 直接下发新的正式任务，只允许围绕原 issue 继续催办和澄清。
- 若 CEO issue 创建本身失败：
  - 该 target 直接进入 `failed`
  - 记录失败原因与可重试标记
  - 允许按 target 粒度单独重试，不影响已成功的其他 target

### instance-scoped 动作

- v1 允许通过聊天发起并执行的实例级动作：
  - 创建公司
  - 删除公司
- 这两类动作不创建 company 内 CEO issue，而是由 Board Assistant 在确认后直接执行实例级控制面动作。
- 公司创建：
  - 允许先聊天描述需求
  - Board Assistant 可整理出建议参数
  - 你确认后执行正式创建
  - 执行链路对齐现有 `POST /api/companies` 语义，并继续完成 system project、membership、required settings bootstrap
  - 若公司已创建但后续 bootstrap 未完成，请求进入 `blocked`，同时返回已创建的 `companyId` 和待补救步骤；v1 不做自动回滚
- 公司删除：
  - 必须精确指定目标 company
  - 必须走高风险确认
  - 执行语义对齐现有 `DELETE /api/companies/:companyId`，属于硬删除与级联清理，不是软归档
  - 在进入 `confirmed` 前，必须先返回 destructive preview，至少包含：
    - company 名称与 ID
    - agents / issues / projects / departments / runs 数量摘要
    - 是否存在活跃 heartbeat runs
  - 这里的“活跃 heartbeat runs”固定指：
    - 当前处于 `running`
    - 或已被 claim 但尚未完成释放 lease
  - 若存在活跃 heartbeat runs，请求不能直接执行删除，进入 `blocked`
  - 执行后写入实例级请求账本和正式 activity 轨迹
- v1 不把所有实例级动作都开放到聊天；只有明确列入白名单的动作才允许直达执行。
- 公司删除因活跃 runs 进入 `blocked` 后：
  - 不做静默自动重试
  - 由你在 runs 清空后重新确认执行，或显式取消
  - 保留上一次 destructive preview 供你复核
- v1 的实例级动作采用封闭白名单：
  - 允许：`create_company`
  - 允许：`delete_company`
  - 其他实例级动作默认关闭，必须通过后续新计划单独引入

### Core 与 Channel Adapter Plugins

- Board Assistant 采用两层结构：
  - `board-assistant-core`
  - `channel adapter plugins`
- `board-assistant-core` 负责：
  - 全局请求账本
  - 助理人格与长期记忆编排
  - 意图解析与 target 推荐
  - `proposed -> confirmed` 状态推进
  - company-scoped CEO issue 创建
  - instance-scoped 动作执行
  - 审计、聚合回执、节流与高风险确认
- channel adapter plugins 负责：
  - inbound message normalization
  - outbound message delivery
  - login / auth state
  - cursor / checkpoint persistence
  - reconnect / retry
  - message dedupe
  - external user / thread mapping
- channel adapter plugins 不负责任何正式业务决策：
  - 不直接创建 company
  - 不直接删除 company
  - 不直接创建 CEO issue
  - 不直接改写请求最终状态
- channel adapter plugins 通过受限 ingress / outbox / ack 接口与 core 交互，不直接拿通用 `board_api_key`。
- 这层建议用 Paperclip 插件系统承载，使每个渠道都能独立安装、升级、停用和审计。
- v1 先实现：
  - `wechat` channel plugin
- 预留后续插件：
  - `feishu`
  - 其他企业 IM

### 插件边界与能力模型

- 渠道插件适合复用现有 Paperclip 插件 worker 模型：
  - 独立进程
  - 自有配置
  - 自有状态存储
  - 可声明 webhook / job / settings UI
- 但 Board Assistant core 不应作为普通第三方插件下放：
  - 它持有实例级编排权
  - 它需要执行高风险实例动作
  - 它需要统一审计与确认策略
- 因此推荐的实现形态是：
  - core 作为内建服务或受控 system plugin
  - 各渠道作为独立 adapter plugin
- 后续如果要开放第三方渠道插件，还需要增加更细的渠道 capability，而不只依赖泛化的 `http.outbound` / `webhooks.receive`。
- v1 先定义统一的规范化消息信封，至少覆盖：
  - `messageKind`: `text | image | file | voice | card | unsupported`
  - `plainText`
  - `attachments`
  - `rawMetadata`
- core 的意图解析只依赖 `plainText + messageKind + minimal metadata`，不依赖某个渠道私有格式。
- 若渠道消息无法稳定转换成可执行语义，core 返回 `clarifying` 或 `unsupported`，而不是让 plugin 私自决策。
- v1 core 与 channel plugin 的主协议固定为：
  - 签名 HTTP ingress
  - 受控 outbox 拉取或投递
  - 明确 ack / checkpoint
- `ingressSignature` 采用 HMAC-SHA256，签名输入至少覆盖：
  - `channel`
  - `externalUserId`
  - `externalThreadId`
  - `externalMessageId`
  - `timestamp`
  - `bodyHash`
- core 必须校验：
  - 签名正确性
  - 时间窗口
  - 消息是否已被处理
- v1 的 ingress replay 时间窗口固定为 `5 分钟`。
- 必须支持重放防护：
  - 超出时间窗口的请求拒绝
  - 相同消息幂等键重复到达时只返回既有结果
- secret 轮换策略采用：
  - 当前 active secret
  - 上一把 previous secret 的短暂宽限窗口
  - 宽限期后旧 secret 全量失效
- v1 的 previous secret 宽限窗口固定为 `1 小时`。

### Skill 与系统插件协作

- 助理必须是 `skills-first` 的，不应只依赖裸 prompt。
- 它应默认具备“先判断是否有可复用 skill，再决定如何执行”的工作方式。
- 助理不仅要能熟练使用通用 skill，还要显式理解并协作当前两个系统级插件：
  - `plugin-execution-improvement`
  - `plugin-skills-system`
- 与系统插件的协作原则：
  - 助理不绕过这两个系统插件
  - 助理把它们当成能力增强层和进化层
  - 助理知道失败、阻塞、重复模式会被改进链路吸收
  - 助理知道高频有效做法可以沉淀为 skill candidate / promotion request
- `skill memory` 要记录：
  - 常用 skill
  - 适用场景
  - 你对 skill 的偏好
  - 与系统插件协作后形成的稳定套路

### 主动提醒与简报

- 助理允许主动找你，但只做高价值主动提醒，不做高频轰炸。
- 适合主动触发的场景包括：
  - 待确认的高风险动作
  - 重要 blocker
  - 关键执行进展
  - 员工或 CEO 长时间无响应
  - 值得沉淀成 skill / 改进链的问题模式
- 助理允许主动形成“观察性观点”，例如：
  - 哪个 CEO 最近执行不佳
  - 哪个部门反复卡住
  - 哪类问题正在重复发生
- v1 不让它自动上升到强组织裁决，只给：
  - 风险提示
  - 证据摘要
  - 建议动作
- 助理应具备简报能力，v1 先支持：
  - 按需简报
  - 关键事件触发简报
- v1 先不做完整的复杂日报 / 周报排程系统。

### 对内主动沟通

- 助理允许主动去找 CEO 或正式员工发起沟通，但仅限：
  - `follow-up`
  - `clarification`
  - `notification`
- 主动对内沟通必须有来源，至少来自：
  - 你的明确要求
  - 已存在的正式任务
  - blocker / 超时 / 待确认 / 待回复
  - 被授权的跟进职责
- 主动发起沟通时，必须显式说明联系来源，至少说明：
  - 为什么联系你
  - 来源对象
  - 期望对方做什么
  - 是否有回复时限
- 助理主动联系员工时，应优先挂靠已有正式对象上下文；只有在没有正式对象且只是澄清/催办时，才发送纯聊天消息。
- v1 中，助理不能绕过你主动发起新的正式任务要求：
  - 可以跟进
  - 可以澄清
  - 可以通知
  - 可以催办
  - 但新的正式任务必须先回到你这里确认
- 对内主动沟通必须有催办节制机制：
  - 最短催办间隔
  - 同一事项最大提醒次数
  - 已响应后停止催办
  - 多次无响应后升级给你
- v1 默认值为：
  - 最短催办间隔 `4 小时`
  - 同一事项最大主动提醒次数 `3 次`
- 升级给你时，必须输出结构化升级简报，至少包含：
  - 谁没响应
  - 对应事项
  - 已跟进次数
  - 最后联系时间
  - 建议处理方式

### 代言与语气策略

- 对你：
  - 更自然
  - 更贴身
  - 更简洁
- 对正式员工：
  - 更职业
  - 更明确
  - 更带组织身份
- 对 CEO：
  - 更正式
  - 更结果导向
  - 更接近 `Executive Assistant / Office of the Founder`
- 助理代表你发言时，允许润色和组织措辞，但必须忠实于你的真实意图，不得擅自改变：
  - 立场
  - 承诺
  - 态度强度
  - 权限边界
- 助理在对内线程里发话时，必须明确标记发言来源，至少区分：
  - `代表 Founder / Executive Assistant`
  - `代表系统流程 / 自动跟进`
- 助理应根据对象自动切换表达风格；这属于 relationship memory 的作用范围，而不是固定模板。

### 渠道密钥与轮换

- `board assistant ingress secret` 采用每个 channel plugin 独立一把，不使用全局共享 secret。
- 每把 secret 必须支持：
  - 单独启用 / 禁用
  - 轮换
  - 失效后拒绝旧签名
- 某个 channel plugin secret 泄露时，只影响对应渠道，不影响其他渠道或 core 内部状态机。

### 微信 adapter

- 当前收录的候选 SDK：
  - npm: `https://www.npmjs.com/package/weixin-ilink`
  - package: `weixin-ilink`
  - latest: `0.1.0`
  - license: `MIT`
  - description: `Lightweight TypeScript SDK for WeChat iLink Bot protocol — 5 HTTP endpoints, QR login, zero dependencies.`
  - repo: `https://github.com/crazynomad/weixin-ilink`
- v1 默认优先评估并接入 `weixin-ilink`，除非后续验证发现协议覆盖、稳定性或登录持久化能力不足。
- 微信 adapter 作为 `wechat` channel plugin 负责：
  - 扫码登录
  - token / cursor 持久化
  - 重连
  - 外部消息去重
  - 调用 Board Assistant core 的受限 ingress API
- 如果 `weixin-ilink` 无法满足稳定性或登录持久化要求，保留 channel plugin 契约不变，仅替换微信插件内部 SDK 实现，不重写 core。

### 路由与交互规则

- 查询类请求：
  - 只允许精确 company、静态 company group 或明确内置 group
  - 不做模糊 company 推断
  - 默认只返回摘要、状态、计数、ID，不回传细粒度 run / log / 原始评论
- 写请求：
  - 可以自然描述目标
  - Board Assistant 可以自动分析更适合的 company
  - 但分析结果只进入 `proposed`
  - 必须等待你确认，才允许执行正式动作
- 若写请求缺失 company，且又不是明确的 instance-scoped 动作：
  - 先返回推荐 target 或澄清问题
  - 不创建任何 CEO issue
  - 不执行任何系统变更
- 每个全局请求都要能反查到：
  - 外部消息
  - 目标 scope
  - 目标 company 或 instance action
  - 对应 CEO issue
  - 活跃 run
  - 最终回执
- 非文本消息默认不直接触发正式动作：
  - 若能抽取稳定文本，则进入正常解析
  - 若不能抽取稳定文本，则进入 `clarifying`

### 进度汇报

- 进度按 target 聚合为阶段：
  - `queued`
  - `routed`
  - `executing`
  - `blocked`
  - `done`
  - `failed`
- 汇总来源：
  - company-scoped 请求：各 company CEO issue 状态和活跃 heartbeat runs
  - instance-scoped 请求：Board Assistant 直接执行状态
- 仅在关键阶段变化、数量变化、出现 blocker、或全部完成时生成外部播报。
- 最终回包固定包含：
  - 总体摘要
  - 各 target 状态行
  - 需要你介入的 blocker
  - 可追踪标识符

## Public API / Interface 变化

- 新增 Board Assistant core board-only 接口用于：
  - 接收外部渠道消息 ingress
  - 查询全局请求列表与详情
  - 确认或拒绝 `proposed` 请求
  - 读取线程 outbox
  - 预览 company 解析结果
- ingress 请求至少包含：
  - `channel`
  - `externalUserId`
  - `externalThreadId`
  - `externalMessageId`
  - `messageText`
  - `ingressSignature`
- 新增紧凑的请求状态返回结构：
  - 请求元数据
  - 目标 scope
  - 目标 company 或 instance action
  - 关联 CEO issue
  - 活跃 run
  - 聚合阶段计数
  - 下一批待发外部消息
- 后续需新增 assistant memory 相关内部接口或服务契约，用于：
  - 记忆提案写入
  - 记忆检索
  - 记忆确认 / 驳回
  - 记忆整理任务投递
- 扩展 activity / 审计记录，在所有 Board Assistant 触发的变更中写入：
  - `requestId`
  - `channel`
  - 外部用户 ID
  - 目标 scope
  - 目标 companies
- 新增 core <-> channel plugin 的受限接口约束：
  - ingress
  - outbox poll / ack
  - channel health
  - channel binding sync
- 这些接口只允许受信 channel plugin 使用专用 `board assistant ingress secret` 调用。
- outbox 投递失败的 v1 重试策略固定为：
  - 指数退避
  - 单条消息最多重试 `5 次`
  - 超过上限后标记为 `failed`，并进入待人工查看队列
- 新增 destructive preview 返回结构，用于实例级高风险动作确认前展示：
  - `riskLevel`
  - `impactSummary`
  - `activeRunCount`
  - `entityCounts`

## 测试方案

- 助理定位：
  - 它以实例级系统人格运行，而不是普通 `agent` 记录
  - 它拥有独立的 4 文档包
- 助理交互：
  - 普通对话不会被误落为正式动作
  - 任务意图会先生成结构化理解并请求确认
  - 明确任务可直接进入正式动作流
  - 任务卡片固定字段完整
  - 微信任务卡片同时支持自然语言确认与按钮确认
  - `修改理解` 走自然语言修正
  - `稍后提醒我` 会进入待确认队列与提醒计划
  - `只做分析` 不会落正式对象
- onboarding 与人格：
  - 首次启动会进入轻量 5 步 onboarding
  - onboarding 结果会写入 `SOUL.md` 和用户偏好
  - `SOUL.md` 修改必须经过预览与用户确认
  - 只有你本人能最终确认 `SOUL.md` 修改
- 权限与隔离：
  - Board Assistant 仅在 `instance_admin` 身份下拥有实例级跨 company 能力
  - 现有 agent 仍然禁止跨 company
- 绑定与鉴权：
  - 未绑定的外部用户无法触发任何动作
  - ingress secret 错误时拒绝
  - 解绑后旧线程或旧用户映射失效
  - channel plugin 无法绕过 core 直接执行实例动作
- group 规则：
  - 未配置的 group 不可解析
  - `all-active-companies` 仅在显式启用时可用
- 查询规则：
  - 仅精确 company / group 查询成功
  - 歧义查询返回澄清，不泄露业务明细
- company-scoped 写请求：
  - 自动分析 company 后进入 `proposed`
  - 未确认前不创建 CEO issue
  - 确认后才创建 company-scoped CEO issue
- instance-scoped 写请求：
  - 公司创建在确认后执行
  - 公司删除必须精确指定目标并确认后执行
  - 公司删除遇到活跃 runs 时进入 `blocked`
- 自动执行：
  - 默认关闭
  - 开启后仅系统预定义低风险动作可自动执行
  - 高风险动作与 `SOUL.md` 修改仍需确认
- 确认与过期：
  - 普通确认可通过聊天或 Web 完成
  - 高风险确认只能通过 Web 完成
  - `proposed` 超时进入 `expired`
  - 取消后进入 `cancelled`
- 幂等与恢复：
  - 重放 ingress 不重复创建 request
  - 重放 confirm 不重复执行 instance action 或 CEO issue 创建
  - core crash 后可恢复卡住的 `queued/routed/executing` 请求
- 长期记忆：
  - 私人助理记忆与审计记忆分层
  - 后台记忆整理不会直接污染高敏感记忆
  - 高敏感记忆提案需要确认后才写入
  - 短期状态允许写入，长期心理标签不会自动固化
  - 对内沟通会沉淀 relationship / working memory 摘要
  - 私人记忆默认不会直接外传到员工沟通
- skill 与插件协作：
  - 助理能优先使用 skill
  - 助理和 `plugin-execution-improvement`、`plugin-skills-system` 的协作链路不冲突
- 主动提醒与简报：
  - 仅高价值事件会主动提醒
  - 按需简报与关键事件简报可生成
  - 观察性观点会附证据摘要，不会自动上升为强组织裁决
- 对内沟通与线程：
  - 助理与每个 CEO / 员工有独立长期线程
  - 线程可归档与唤醒
  - 你可旁观、联合发言、接管
  - 主动对内沟通必须带来源说明
  - 新正式任务不会被助理绕过你直接下达
  - 催办节流生效，多次无响应会升级给你
- 代言与语气：
  - 对你 / 员工 / CEO 的语气策略区分明确
  - 对内发言会标注“代表 Founder”或“代表系统流程”
  - 代表你发言时允许润色，但不会擅改立场和承诺
- 多 target 派发：
  - 显式 group 请求按 target `best-effort`
  - 单个 target 失败不回滚已成功 target
  - 可针对失败 target 单独重试
- 聚合汇报：
  - 当不同 target 处于 `done` / `blocked` / `running` 混合状态时，外部消息符合预期且不会重复刷屏
- bridge 韧性：
  - 长轮询超时、断线重连、cursor 恢复、重复消息去重都不会造成重复落单
- 插件边界：
  - 停用某个 channel plugin 不影响 core 和其他 channel plugin
  - channel plugin 升级不会改变 core 的请求状态机语义
- 审计闭环：
  - 每次改动都能从外部消息追溯到全局请求、target、CEO issue 或实例动作和 activity 轨迹

## 假设与默认值

- “系统 agent”在实现上是实例级 Board Assistant / Executive Assistant 服务或人格，不是新增跨 company `agents` 记录。
- v1 只服务你本人，但通道层不是单一微信专用设计。
- v1 先实现 `wechat` channel plugin，后续可扩展 `feishu` 等 app。
- 渠道接入推荐采用插件形态，但 Board Assistant core 仍保留在受控内核层。
- 助理在产品体验上是你的个人助理，不是纯命令机器人。
- 助理拥有独立的 `SOUL.md / AGENTS.md / HEARTBEAT.md / TOOLS.md` 文档包。
- 助理长期记忆以内建 memory core 为主，后台可使用独立 LLM 做异步整理。
- 自动执行默认关闭；v1 仅允许按系统预定义风险白名单开启有限自动执行。
- 首次在微信启动时采用轻量 5 步 onboarding。
- 微信默认回复风格是短而准；先给短回答和结构化卡片，只有在你要求时再展开。
- 助理对你可使用私人名字；对系统员工显示正式头衔。
- 查询类不做模糊自动路由；写请求可以推荐 company，但必须确认后执行。
- company-scoped 改动必须形成正式的 company-scoped CEO 工作单。
- 公司创建属于 instance-scoped 动作，允许在聊天提出、确认后执行。
- 公司删除属于 instance-scoped 高风险动作，允许在聊天提出，但必须通过 Web 高风险确认后执行。
- 外部聊天侧只接收聚合阶段播报，不推送细粒度 run / log 流。
