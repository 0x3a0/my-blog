# 项目约束

本文件约束 AI 助手在本仓库中的设计、代码和依赖选择。

## 规范要求

- 文档统一存放在`docs/`路径下
- 文档应遵循渐进式披露：主文档只写概要和目录，具体功能链接到对应小文档，保证每份文段精简短小

## 固定技术栈

- Astro: 以静态生成（SSG）为目标。
- TypeScript: 启用严格类型检查。
- Tailwind CSS 4: 默认使用 `tailwind css 4` 完成 CSS 样式的编写，非必要时不要写原生 CSS 代码。
- daisyUI: 现成的 UI 组件，优先使用 `daisyUI` 中已有的组件。
- pnpm: 使用 `pnpm` 进行包管理，不要同时维护 npm、Yarn 或 Bun 的 lockfile。

## 项目文档

- 实现或验收文章详情页、按年归档与语雀同步前，阅读 `docs/spec/README.md` 及相关章节，并遵循其中的功能范围与验收要求。
- 其他项目设计文档从 `docs/README.md` 进入。
- 若用户明确改变技术栈或范围，按新要求执行，并更新本文件及相关设计文档，避免留下互相矛盾的约定。

## 注意事项

- 不要无故升级或更新依赖
- AGENTS.md 内只保留必须遵守的、稳定的、可执行的规则，不要随意添加任何说明

## Agent skills

### Issue tracker

任务跟踪操作使用 GitHub 仓库 `0x3a0/my-blog`；操作前阅读 `docs/agents/issue-tracker.md`。

### Triage labels

任务状态使用默认五个标签；修改状态前阅读 `docs/agents/triage-labels.md`。

### Domain docs

项目采用单一上下文；探索或设计代码前按 `docs/agents/domain.md` 阅读领域文档。
