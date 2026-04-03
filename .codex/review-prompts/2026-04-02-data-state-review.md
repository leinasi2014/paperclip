先理解整个项目，再审阅以下 4 份设计文档：
- doc/plans/2026-04-02-department-minister-and-subagent-org-model.md
- doc/plans/2026-04-02-execution-improvement-plugin.md
- doc/plans/2026-04-02-skills-system-plugin.md
- doc/plans/2026-04-02-system-self-evolution-and-hot-update.md

先阅读并建立上下文：
- AGENTS.md
- doc/GOAL.md
- doc/PRODUCT.md
- doc/SPEC-implementation.md
- doc/DEVELOPING.md
- doc/DATABASE.md

你的审查视角：数据模型、状态机、可实现性。
重点找：
- 状态转换缺口
- 缺少关键实体/字段
- 跨文档状态语义不一致
- 会导致数据库/路由/UI 难以落地的模糊点
- 与现有 issue/project/company/plugin 模型的冲突

不要改代码，也不要提出低置信度泛泛建议。
输出要求：
- 使用中文
- findings 按严重程度排序
- 给出具体文档与章节定位
- 最后补 open questions
