# Notion 读取契约

官方接口与只读探针记录见[读取路径](../NOTION_API_READING.md)。同步单向读取，不创建或修改 Notion 文章及属性。

## 来源与接口

指定 My blog 数据库及所属文章数据源；多个数据源时必须明确选择，不能默认取第一项。沿用已验证的 Notion-Version 2026-03-11，鉴权仅来自执行环境。

- 数据库读取确定所属数据源；数据源查询负责枚举页面并处理全部分页，不能把画廊视图当作公开授权。[数据库](https://developers.notion.com/reference/retrieve-database)、[查询](https://developers.notion.com/reference/query-a-data-source)
- 页面对象提供标题、属性、身份及编辑时间，Markdown 读取提供正文；必要时补读内容块。[页面](https://developers.notion.com/reference/retrieve-a-page)、[正文](https://developers.notion.com/reference/retrieve-page-markdown)

## 属性契约

to-blog-site 必须是复选框，只有 true 允许公开；缺失或错误类型不能当作可信空集合。标题取页面的标题属性，当前名称为 Name，不增加第二份标题。Published 为必填日期，category 为可缺省单选，description 为可缺省文本；具体空值和日期规则见[元数据](../ARTICLE_METADATA.md)。其他属性不隐含发布、分类或摘要规则。

稳定页面 ID 决定文章身份及地址；标题、属性和正文须对应一致的最新保存状态。若读取期间源内容变化，有限重读后仍无法取得一致状态则报告失败，不回退旧正文。

## 正文与资源

默认正文是扩展 Markdown，按[文章页面规则](../ARTICLE_PAGES.md)转换。[增强格式](https://developers.notion.com/guides/data-apis/enhanced-markdown)

检查截断、未知内容块及未知占位，只有缺失内容全部处理完才可发布；权限不足、未取得正文与有效空正文分别处理。范围外或无法完整转换的内容报告文章和类型，并阻止整次发布。[缺失块](https://developers.notion.com/reference/retrieve-page-markdown#unknown-blocks)

必需图片在同步时下载并转为持久静态资源，替换临时签名及其他源图片地址，验证无需 Notion 登录即可读取。下载、内容校验或持久化失败阻止提交。[文件读取](https://developers.notion.com/guides/data-apis/retrieving-files)

## 完整性与撤回

完整处理分页、结果完整性、有限重试及接口错误。正常完整空集合可提交空站点；重复或异常游标、结果上限造成的不完整查询、鉴权失效及权限不足均失败。[分页上限](https://developers.notion.com/reference/query-a-data-source#pagination-limit)、[请求限制](https://developers.notion.com/reference/request-limits)

只有可靠确认取消勾选、移出文章库或放入回收站，才在完整成功同步中撤回；404、权限错误或不完整结果不能单独作为撤回依据。新增、更新与撤回统一提交，任一失败保留完整旧站点。
