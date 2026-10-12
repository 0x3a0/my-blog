# Notion 实现任务

来源：[正式规格](../spec/README.md)及[GitHub Issue #1](https://github.com/0x3a0/my-blog/issues/1)。七项任务已发布为该规格的原生子任务，并建立原生阻塞关系。

| 任务 | 交付 | 直接阻塞 |
| --- | --- | --- |
| [#2](https://github.com/0x3a0/my-blog/issues/2) · [说明](./01-first-notion-article.md) | 首篇完整同步 | 无 |
| [#3](https://github.com/0x3a0/my-blog/issues/3) · [说明](./02-properties-and-dates.md) | 属性与日期 | #2 |
| [#4](https://github.com/0x3a0/my-blog/issues/4) · [说明](./03-persistent-article-images.md) | 图片持久化 | #2 |
| [#5](https://github.com/0x3a0/my-blog/issues/5) · [说明](./04-notion-content-and-links.md) | 正文与文章链接 | #2 |
| [#6](https://github.com/0x3a0/my-blog/issues/6) · [说明](./05-withdrawal-and-failure-protection.md) | 撤回与失败保护 | #2 |
| [#7](https://github.com/0x3a0/my-blog/issues/7) · [说明](./06-real-article-archive-and-reading.md) | 首页、详情、按年归档 | #3 |
| [#8](https://github.com/0x3a0/my-blog/issues/8) · [说明](./07-daily-notion-publication.md) | 每日自动发布 | #4、#5、#6、#7 |

代码及可控返回测试已实现；真实文章本地同步通过。剩余真实图片、作者修改/撤回、GitHub 配置与线上部署见[验收记录](../NOTION_ACCEPTANCE.md)。各任务的最新状态以 GitHub 为准，父规格的标题、正文和状态保持不变。

本轮 #2、#3、#5、#7 已验收关闭；#4、#6、#8 保持开放并标记 ready-for-human，记录各自未完成的真实验收。实现与修复提交在本地 main，尚未推送远程。
