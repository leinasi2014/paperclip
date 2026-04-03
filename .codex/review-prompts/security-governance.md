先理解整个项目，再审阅以下已修订文档：
- doc/plans/2026-04-02-department-minister-and-subagent-org-model.md
- doc/plans/2026-04-02-execution-improvement-plugin.md
- doc/plans/2026-04-02-skills-system-plugin.md
- doc/plans/2026-04-02-system-self-evolution-and-hot-update.md

先读上下文：
- AGENTS.md
- doc/GOAL.md
- doc/PRODUCT.md
- doc/SPEC-implementation.md
- doc/DEVELOPING.md
- doc/DATABASE.md

你是安全专家。重点找：
- 权限绕过
- board / CEO / human override 边界不清
- system plugin 作为同源可信 JS 的风险
- plugin host services 暴露过宽
- critical blocking / resume 是否可能被插件越权
- skills 双真相是否会变成安全或治理漏洞

只输出 findings，按严重程度排序。
