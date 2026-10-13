# Notion 同步、文章详情与按年归档规格

2026-10-13：已确认改为每次完整读取勾选集合、构建并替换全站，无发布清单或逐篇撤回确认。本地章节记录最新约定；[GitHub Issue #1](https://github.com/0x3a0/my-blog/issues/1)为原始规格，尚未同步本轮调整。实现及剩余真实验收见[交接](./FURTHER_NOTES.md)和[验收记录](../NOTION_ACCEPTANCE.md)。

## Problem Statement

作者需要在云端统一写作、多端修改，明确选择公开内容，并由博客自动更新。见[问题与方案](./PROBLEM_AND_SOLUTION.md)。

## Solution

沿用 Notion My blog，以 to-blog-site 控制发布，每日北京时间 06:00 同步；首页最新五篇、详情与按年归档使用同一完整结果，失败保留旧站点。

## User Stories

- [作者故事 1–20](./AUTHOR_STORIES.md)、[维护者故事 21–40](./SYNC_STORIES.md)。
- [读者故事 41–60](./READER_STORIES.md)、[边界故事 61–80](./EDGE_CASE_STORIES.md)。

## Implementation Decisions

- [模块与接口](./IMPLEMENTATION.md)、[Notion 读取契约](./API_CONTRACT.md)。
- [发布选择](../ARTICLE_PUBLISHING.md)、[文章属性](../ARTICLE_METADATA.md)、[同步保护](../NOTION_SYNC.md)、[页面](../ARTICLE_PAGES.md)。

## Testing Decisions

沿用已确认的完整同步与真实静态构建入口，见[测试方案](./TESTING.md)及[验收场景](./TEST_CASES.md)。

## Out of Scope

见[范围外事项](./OUT_OF_SCOPE.md)。

## Further Notes

见[交接状态](./FURTHER_NOTES.md)、[需求记录](../NOTION_REQUIREMENTS.md)与[SDK 读取流程](../NOTION_API_READING.md)。实现任务已发布为 #2–#8。
