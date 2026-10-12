# Notion 文章 API 读取路径

核实日期：2026-10-12。已使用本地凭据完成文章库的只读 API 验证和一篇真实文章的本地同步。当前决定见[需求讨论](./NOTION_REQUIREMENTS.md)，文章组织见[整理说明](./NOTION_ARTICLE_ORGANIZATION.md)。

## 接口选择

用户提供的 `POST /v1/pages` 是创建页面接口。读取现有文章应使用以下接口；请求统一带 `Authorization: Bearer <token>` 和当前版本 `Notion-Version: 2026-03-11`。[创建页面](https://developers.notion.com/reference/post-page)、[Markdown 读取](https://developers.notion.com/reference/retrieve-page-markdown)

| 目的 | 请求 | 得到的内容 |
| --- | --- | --- |
| 获取文章属性 | `GET /v1/pages/{page_id}` | 页面对象、标题与属性，不包含正文 |
| 获取文章正文 | `GET /v1/pages/{page_id}/markdown` | JSON 内的 `markdown` 字符串 |
| 枚举普通父页的子页 / 补读复杂块 | `GET /v1/blocks/{block_id}/children` | 分页的内容块 |
| 获取数据库下的数据源 ID | `GET /v1/databases/{database_id}` | `data_sources` 数组 |
| 查询文章列表 | `POST /v1/data_sources/{data_source_id}/query` | 可筛选、排序、分页的页面列表 |

表中接口语义来源：[页面属性](https://developers.notion.com/reference/retrieve-a-page)、[正文](https://developers.notion.com/reference/retrieve-page-markdown)、[子块](https://developers.notion.com/reference/get-block-children)、[数据库](https://developers.notion.com/reference/retrieve-database)、[数据源查询](https://developers.notion.com/reference/query-a-data-source)。不要照旧版示例使用 `/databases/{id}/query`；数据库与数据源已拆分。[旧版说明](https://developers.notion.com/reference/retrieve-a-database)

## 先取得读取权限

建议为同步程序创建 **Internal connection**，只开启读取内容能力。工作区所有者在 Developer portal 创建连接，复制 Token，然后在 Content access 授权文章库；也可在 Notion 页右上角 `••• → Connections → + Add connection` 授权。父页授权会继承到子页，不需要公开页面。[官方创建与授权步骤](https://developers.notion.com/guides/get-started/internal-connections)

个人脚本也可使用 **PAT**：在 Developer portal 的 Personal access tokens 创建 Token，启用 Notion API。PAT 使用创建者权限，无需逐页 Add connections；权限更宽，且有有效期。Free 工作区只有所有者能创建带 Notion API 能力的 PAT。[PAT 权限、计划与有效期](https://developers.notion.com/guides/get-started/personal-access-tokens)

Public API 在 Free、Plus、Business、Enterprise 均支持；核实时查看价格页原始 HTML 的 Public API 行，四个计划均为勾选。单成员 Free 工作区不限块；多成员 Free 的块数量限制仍允许读取。本地运行同步程序不需要 Notion Workers。[价格页](https://www.notion.com/pricing)、[工作区块限制](https://developers.notion.com/reference/workspace-block-limits)

## 路径 A：先验证截图中的一篇文章

打开 `blog` 子页，`Share → Copy link`；URL 路径末尾的 32 位 ID 是 `page_id`，可转换为 `8-4-4-4-12` 格式。数据库 ID 同样取数据库 URL 路径中的 ID；不要取 `?v=` 后的视图 ID。[页面 ID 获取](https://developers.notion.com/guides/data-apis/working-with-page-content#creating-a-page-with-content)、[数据库 ID 获取](https://developers.notion.com/reference/retrieve-database)

下面是 HTTP 请求格式，占位符需替换；不会创建或修改页面：

```http
GET https://api.notion.com/v1/pages/{blog_page_id}/markdown
Authorization: Bearer <token>
Notion-Version: 2026-03-11
```

响应中的 `markdown` 就是该页正文。标题和业务属性可另取 `GET /v1/pages/{blog_page_id}`。[正文响应](https://developers.notion.com/reference/retrieve-page-markdown)、[页面属性](https://developers.notion.com/reference/retrieve-a-page)

若保留 `test → blog` 的普通父子页结构，先用 `GET /v1/blocks/{test_page_id}/children?page_size=100` 枚举父页，识别 `type: "child_page"`，再用各子页 ID 单独读取正文。枚举要处理 `has_more` / `next_cursor`；子页藏在其他内容块中时，还要遍历那些块。[子块分页](https://developers.notion.com/reference/get-block-children)、[页面与子页块](https://developers.notion.com/guides/data-apis/working-with-page-content)

**父页 Markdown 不能当作全部文章的合并导出。** 官方增强 Markdown 将子页表示为 `<page url="...">title</page>` 引用；应逐篇读取自己的页面 ID。普通父页的页面属性只有标题，自定义分类和发布字段更适合放在数据库内。[子页引用格式](https://developers.notion.com/guides/data-apis/enhanced-markdown#page-and-database-references)、[属性区别](https://developers.notion.com/reference/retrieve-a-page#parent-and-properties)

## 路径 B：从文章库批量读取

先获取数据库，再从 `data_sources` 的 `id` / `name` 中选定文章数据源；不要假设数据库 ID 等于数据源 ID，也不要无条件选第一个数据源。[数据库响应](https://developers.notion.com/reference/retrieve-database)

```http
GET https://api.notion.com/v1/databases/{database_id}
Authorization: Bearer <token>
Notion-Version: 2026-03-11
```

文章库已使用复选框属性 `to-blog-site`，只有勾选页面允许公开；正式同步已验证该筛选。官方支持 checkbox 筛选。[查询与筛选](https://developers.notion.com/reference/query-a-data-source#filtering)

```http
POST https://api.notion.com/v1/data_sources/{data_source_id}/query
Authorization: Bearer <token>
Notion-Version: 2026-03-11
Content-Type: application/json

{
  "filter": { "property": "to-blog-site", "checkbox": { "equals": true } },
  "page_size": 100
}
```

遍历 `results` 中的页面，使用页面属性作元数据、页面 ID 作身份，再逐篇请求 Markdown。存在后续页时，把 `next_cursor` 放进下一次请求的 `start_cursor`。还应检查 `request_status.type`；即使 `has_more: false`，超过单次查询 10,000 条的结果也可能不完整。[分页与结果上限](https://developers.notion.com/reference/query-a-data-source#pagination-limit)

## 分发前的转换

- 默认返回增强 Markdown（`v1`），包含颜色属性、callout、columns 等扩展；应转换为目标平台格式。`markdown_version=v2` 是另一个预览格式，不能据此假设所有平台直接兼容。[格式版本](https://developers.notion.com/guides/data-apis/working-with-markdown-content#markdown-versions)、[增强语法](https://developers.notion.com/guides/data-apis/enhanced-markdown)
- 检查 `truncated`、`unknown_block_ids` 和正文中的 `<unknown>`。可把缺失块 ID 再传给 Markdown 接口；权限缺失可能返回 404，不支持的书签、嵌入等应使用块接口处理。建议任一正文缺失未处理完就暂停该篇分发。[缺失块](https://developers.notion.com/reference/retrieve-page-markdown#unknown-blocks)
- Notion 托管图片的文件下载地址是临时签名 URL，约一小时过期。建议同步时下载并上传到目标平台或自己的存储，替换正文图片地址；`external` 文件则是外部公开 URL。[图片与文件读取](https://developers.notion.com/guides/data-apis/retrieving-files)
- 调用采用队列，遇到限流读取 `Retry-After`，设置有限重试，最终失败需报告。[调用限制](https://developers.notion.com/reference/request-limits)

实现使用页面 ID 作稳定地址、图片内容哈希作静态文件名，临时 URL 变化不会改变相同图片的持久地址。只有完整查询成功并取得明确撤回证据才撤下文章；细节见[同步说明](./NOTION_SYNC.md)。

## 用户账号验证清单

已验证 Token 有效，`My blog` 链接对应数据库，其数据源可以查询。最新查询返回一篇文章：`The Art of Living in the Moment`。示例文章成功返回 3,131 个 UTF-16 代码单元的 Markdown，`truncated: false`、`unknown_block_ids: []`，正文中没有 `<unknown>` 标签。

最初探针看到 `Name`、`Tags`、`Published` 和 `AI custom autofill`。本次正式同步已看到新增的 `to-blog-site` 复选框与 `description` 文本；缺失 `category` 按规则保留空值。读取未修改这些字段。

验证命令：

```sh
node --env-file-if-exists=.env scripts/probe-notion.ts <数据库UUID> [代表文章UUID]
```

凭据从本地 `.env` 的 `NOTION_TOKEN` 读取，数据库也可通过 `NOTION_DATABASE_ID` 配置。多个数据源时需明确指定 `NOTION_DATA_SOURCE_ID`。完整列表读取后，验证一篇指定文章；未指定时优先选择有标题的页面。正文和验证清单保存到 Git 忽略的 `.artifacts/notion-verification/`，输出不包含 Token。

正式同步使用 `pnpm notion:sync`，而不是探针；配置见[本地说明](./NOTION_SETUP.md)。可控返回测试已覆盖跨页枚举、属性、格式、持久图片及失败保护。仍需确认连接权限、真实图片、作者修改/撤回以及线上发布，见[验收记录](./NOTION_ACCEPTANCE.md)。
