# 语雀同步、文章详情与按年归档规格

状态：规格与测试入口已确认，已发布为 [GitHub Issue #1](https://github.com/0x3a0/my-blog/issues/1)，标记为 `ready-for-agent`。功能尚未实现。

## Problem Statement

作者在语雀写作，希望自行选择哪些文章公开到博客，并让后续修改自动同步。目前博客只有首页布局，文章尚无详情页，也缺少完整的文章浏览入口和语雀同步。

## Solution

作者在单个语雀知识库的“博客发布”分组及其子分组中选定文章，每天北京时间 06:00 同步最新保存内容。读者通过首页或 Header 的 `blogs` 进入按年归档与详情页。只有完整同步和构建成功后才更新网站。

## User Stories

共 60 项，按角色分章，编号连续：

- [作者：内容与发布选择（1–20）](./AUTHOR_STORIES.md)
- [维护者：同步与可靠性（21–40）](./SYNC_STORIES.md)
- [读者：归档与阅读（41–60）](./READER_STORIES.md)

## Implementation Decisions

- [模块与接口](./IMPLEMENTATION.md)：同步任务、内容集合、页面与部署的协作。
- [语雀读取契约](./API_CONTRACT.md)：接口事实、验证条件与错误分类。
- [发布规则](../ARTICLE_PUBLISHING.md)、[元数据规则](../ARTICLE_METADATA.md)、[同步规则](../YUQUE_SYNC.md)、[页面规则](../ARTICLE_PAGES.md)：已确认的产品行为。

## Testing Decisions

以一次同步任务及其生成网站作为主要测试入口，测试外部可见行为。[测试方案](./TESTING.md)与[验收场景](./TEST_CASES.md)列出具体检查。

## Out of Scope

首版聚焦普通文章、单知识库和按年归档。[范围外事项](./OUT_OF_SCOPE.md)明确其余内容。

## Further Notes

最新保存内容、私密读取和 frontmatter 保留尚需实际验证。任务跟踪器与标签映射已配置，见[交接说明](./FURTHER_NOTES.md)。
