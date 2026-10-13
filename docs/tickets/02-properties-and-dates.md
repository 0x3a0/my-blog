# 02：同步文章属性与 Published 日期边界

状态：已发布 [GitHub Issue #3](https://github.com/0x3a0/my-blog/issues/3)；实现与剩余验收见[验收记录](../NOTION_ACCEPTANCE.md)。

## Parent

[Notion 正式规格 #1](https://github.com/0x3a0/my-blog/issues/1)。覆盖用户故事：16–20、30、52、61–69。

## What to build

作者只在 Notion 属性栏填写或修改摘要、分类和 Published，下一次同步即可在博客看到相应结果；包括清空属性、修改归档年份、未来日期和日期区间。

## Acceptance criteria

- [ ] description 取文本，缺失或空白保存空值，不从正文或 AI custom autofill 自动生成摘要。
- [ ] category 取单选，缺失或未选保存空值；首页、归档和详情显示“未分组”，不把该显示名写回 Notion。
- [ ] Tags 继续供作者整理，不作为 category、发布选择或新增标签页面来源。
- [ ] 选定文章缺少 Published、日期无效或相关属性类型错误时报告文章和字段，整次失败保留旧站点。
- [ ] 纯日期保持填写日；带时间按北京时间显示和归档；日期区间仅使用起始日期。
- [ ] 未来 Published 照常发布，仍仅由复选框决定是否公开；列表按该日期排序。
- [ ] 修改 Published 更新排序及年份归属；正文编辑不自动改写文章日期，不记录或展示更新时间。
- [ ] 通过真实同步和构建验证属性填写、清空、缺省、未来日期及跨年场景，并确认源文章标题仍是唯一标题来源。

## Blocked by

- [草案 01：打通首篇 Notion 文章的完整同步](./01-first-notion-article.md)。
