# 本地 Notion 配置

使用现有 `My blog` 文章库，每条记录是一篇文章。数据库权限授予读取连接即可，无需 Publish to web。连接与授权步骤见[API 说明](./NOTION_API_READING.md#先取得读取权限)。

| 属性 | 类型 | 规则 |
| --- | --- | --- |
| 标题（现有 Name） | Title | 唯一标题来源 |
| to-blog-site | Checkbox | 仅勾选文章公开 |
| Published | Date | 勾选文章必填，区间取开始日期 |
| description | Text | 缺失或为空保留空值 |
| category | Select | 缺失或未选显示“未分组” |

`Tags` 与现有自动填充字段不参与发布规则。勾选后保存的修改会在下次成功同步更新；取消勾选等撤回规则见[发布边界](./ARTICLE_PUBLISHING.md)。

以 `.env.example` 创建本地 `.env`，填写 `NOTION_TOKEN` 和 `NOTION_DATABASE_ID`。只有数据库含多个数据源时必须指定 `NOTION_DATA_SOURCE_ID`。不要把凭据写入文档、聊天或提交记录。

运行 `pnpm notion:sync`，成功结果位于 `.artifacts/notion-published/site`。文章正文、图片及内部清单均位于 Git 忽略路径。普通 `pnpm build` 不主动连接 Notion；正式发布使用[每日发布入口](./NOTION_DEPLOYMENT.md)。

内容支持及失败条件见[规格](./spec/API_CONTRACT.md)与[验收记录](./NOTION_ACCEPTANCE.md)。

