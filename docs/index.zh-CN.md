# Paperclip 文档总览

`docs/` 是当前仓库唯一的项目级正式文档根目录，描述的是现在源码所对应的产品、架构、运维和开发行为。

## 目录

- [Start](start/index.zh-CN.md)：项目定位、首次运行、快速开始
- [Product](product/index.zh-CN.md)：公司模型、目标、治理、操作视角
- [Architecture](architecture/index.zh-CN.md)：V1 实现契约、运行模型、边界
- [Reference](reference/index.zh-CN.md)：命令、配置、环境变量、API/CLI 总览
- [Guides](guides/index.zh-CN.md)：部署模式、操作手册、排障入口
- [Development](development/index.zh-CN.md)：本地开发、测试、迁移、贡献约束
- [Extensions](extensions/index.zh-CN.md)：adapter、plugin、company package 与包文档

## 文档规则

- 项目级文档只放在 `docs/`。
- `README.md`、`CONTRIBUTING.md`、`AGENTS.md` 只做入口和约束，不再承载完整手册。
- 包级 `README.md` 只保留包职责、最小用法和指向 `docs/` 的深链。
- `releases/*.md` 与各包 `CHANGELOG.md` 继续保留在原位置。
- 被程序直接读取的 Markdown，例如 onboarding assets，继续跟代码放在一起。

## 当前推荐阅读顺序

1. [Start](start/index.zh-CN.md)
2. [Product](product/index.zh-CN.md)
3. [Architecture](architecture/index.zh-CN.md)
4. [Development](development/index.zh-CN.md)
5. [Reference](reference/index.zh-CN.md)
