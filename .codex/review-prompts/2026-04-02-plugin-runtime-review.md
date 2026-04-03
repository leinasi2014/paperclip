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

你的审查视角：插件系统、运行时、热更新与宿主边界。
重点找：
- 哪些设计与现有插件架构/宿主生命周期不兼容
- 哪些热更新假设过强
- 哪些地方可能导致停机、状态漂移、无法回滚
- 哪些地方 system plugin/core 职责边界不清

不要改代码，也不要提出低置信度泛泛建议。
输出要求：
- 使用中文
- findings 按严重程度排序
- 给出具体文档与章节定位
- 最后补 open questions
