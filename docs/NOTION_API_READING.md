# Notion 文章 API 读取路径

核实日期：2026-10-12。请求使用官方 `@notionhq/client` 5.27.0，固定 `Notion-Version: 2026-03-11`。同步仅读取，不修改 Notion 内容。配置见[本地说明](./NOTION_SETUP.md)，完整性要求见[读取契约](./spec/API_CONTRACT.md)。

## 固定文章数据源

推荐配置 `NOTION_DATA_SOURCE_ID`，直接读取数据源并核验身份与属性定义。填写数据库 ID 时额外校验数据源归属，不依赖旧发布清单或来源指纹。

不知道数据源 ID 时，调用 `GET /v1/databases/{database_id}`，从 `data_sources` 中按名称选取对应的 `id`。数据库 ID 与数据源 ID 是不同身份。只配置数据库 ID 时程序寻找唯一数据源；有多个时必须明确指定。[数据库响应](https://developers.notion.com/reference/retrieve-database)、[数据源响应](https://developers.notion.com/reference/retrieve-a-data-source)

## 选中文章的读取流程

| 步骤 | SDK 方法 | 用途 |
| --- | --- | --- |
| 校验文章库 | `dataSources.retrieve` | 数据源身份、所属数据库和属性定义 |
| 枚举选中文章 | `dataSources.query` | 筛选 to-blog-site 为 true，处理全部分页 |
| 读取属性 | `pages.retrieve` | 一起读取标题、Published、category、description 与编辑时间 |
| 补充属性 | `pages.properties.retrieve` | 必要时分页读取可能不完整的标题或描述 |
| 读取正文 | `pages.retrieveMarkdown` | 取得正文和截断信息 |
| 补读特殊内容 | `blocks.retrieve` 或再次读取 Markdown | 定位 unknown 内容并补读；无法完整处理时失败 |

方法及接口语义见[官方 SDK](https://github.com/makenotion/notion-sdk-js)、[数据源查询](https://developers.notion.com/reference/query-a-data-source)、[页面属性](https://developers.notion.com/reference/retrieve-a-page)、[单项属性](https://developers.notion.com/reference/retrieve-a-page-property)、[Markdown 正文](https://developers.notion.com/reference/retrieve-page-markdown)。

查询请求的筛选条件为：

```ts
await client.dataSources.query({
  data_source_id: dataSourceId,
  filter: { property: 'to-blog-site', checkbox: { equals: true } },
  page_size: 100,
  start_cursor: cursor,
});
```

不能把数据库读取当作文章列表，也不需要逐篇请求每个简单属性。分页处理保留游标和结果完整性校验；`request_status.type` 为 incomplete 时停止发布，即使 `has_more` 为 false。[分页上限](https://developers.notion.com/reference/query-a-data-source#pagination-limit)

## 授权与请求保护

连接只需要读取能力，通过 Content access 或数据库的 Connections 授权文章库；不必发布 Notion 页面。[授权说明](https://developers.notion.com/guides/get-started/internal-connections)

Token 仅从执行环境读取，仅附加到 Notion API 请求，图片下载不携带 Token。SDK 负责请求序列化与常规限流重试；适配器保留请求间隔、超时，以及 SDK 不自动重试的只读 POST 查询服务错误的有限重试。远程错误消息与正文不进入日志，只报告安全的状态码。

## 正文与发布保护

- 默认增强 Markdown 包含提示框、分栏、表格及颜色等扩展。先规范化，再用一次普通 Markdown 解析处理文章链接、图片说明和图片地址，不重复解析整篇正文。[增强格式](https://developers.notion.com/guides/data-apis/enhanced-markdown)
- 检查 truncated、unknown_block_ids 和 unknown 占位；需要时补读，范围外或不完整内容使整次同步失败。[缺失块](https://developers.notion.com/reference/retrieve-page-markdown#unknown-blocks)
- 图片在同步时下载、校验并保存为本站静态资源，避免依赖临时签名地址。[文件读取](https://developers.notion.com/guides/data-apis/retrieving-files)
- 读取正文前后及构建结束后检查本次选中文章和集合的一致性，全部成功后整体替换。完整结果中缺失的旧文章自然撤回，不再请求旧文章；本次必要请求出现 404 或其他错误时保留完整旧站点。

旧的一次性探针已删除，统一使用 `pnpm notion:sync` 验证真实同步。测试与尚需真实验收的场景见[验收记录](./NOTION_ACCEPTANCE.md)。
