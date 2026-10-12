# 07：每天自动同步并发布完整 Notion 博客

状态：已发布 [GitHub Issue #8](https://github.com/0x3a0/my-blog/issues/8)；实现与剩余验收见[验收记录](../NOTION_ACCEPTANCE.md)。

## Parent

[Notion 正式规格 #1](https://github.com/0x3a0/my-blog/issues/1)。覆盖用户故事：21–22、35–40、60、80。

## What to build

部署流程每天北京时间 06:00 计划读取 Notion，校验并构建完整候选后发布 GitHub Pages；作者只在 Notion 写作、选择和撤回，失败时线上网站继续完整可用。

## Acceptance criteria

- [ ] 接入每日北京时间 06:00 的计划触发，区分计划、实际开始及完成时间，不承诺准点完成。
- [ ] 复用默认分支的 GitHub Pages 流程及部署基础路径，自动同步、构建、上传和部署使用同一份完整成功候选。
- [ ] 任一同步、正文、资源、类型检查或构建失败均不上传或部署空结果、部分结果，已发布站点继续完整可用。
- [ ] Notion 读取凭据仅由执行环境和仓库 Secret 提供，不写入文章、构建产物、任务正文或日志；只请求必要的读取授权。
- [ ] 列出作者需在 Notion 及仓库中配置的必要字段、数据源、读取授权和 Secret，保留本地验证方式；不替作者提交聊天中的 Token。
- [ ] 避免并发发布互相覆盖，重跑不会重复文章；更新、日期调整和撤回在一次成功发布后统一可见。
- [ ] 使用受控返回核验工作流失败不进入上传部署；用真实代表文章完成一次读取、图片、正文、首页、归档、详情及撤回的发布验收。
- [ ] 交接记录逐项验收证据及实际接入限制，保留固定技术栈，不把本地测试通过当作线上自动发布已经完成。

## Blocked by

- [草案 03：让 Notion 文章图片长期公开可读](./03-persistent-article-images.md)。
- [草案 04：保留 Notion 正文结构与文章链接](./04-notion-content-and-links.md)。
- [草案 05：可靠撤回文章并保留失败前的完整站点](./05-withdrawal-and-failure-protection.md)。
- [草案 06：完成真实文章的首页、详情与按年归档](./06-real-article-archive-and-reading.md)。
