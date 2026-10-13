# Notion 读取契约

官方接口与 SDK 读取流程见[读取路径](../NOTION_API_READING.md)。同步单向读取，不创建或修改 Notion 文章及属性。

## 来源与接口

优先配置 My blog 的固定 NOTION_DATA_SOURCE_ID，直接读取并校验数据源，不请求数据库。配置数据库 ID 时额外校验归属；只配置 NOTION_DATABASE_ID 时，读取数据库寻找唯一数据源；多个数据源必须明确选择，不能默认取第一项。使用官方 @notionhq/client SDK，固定 Notion-Version 2026-03-11，鉴权仅来自执行环境。

- 数据源读取验证身份和属性定义；查询直接筛选 to-blog-site 为 true 并处理全部分页，之后读取选中文章的属性和正文，不能把画廊视图当作公开授权。[数据源](https://developers.notion.com/reference/retrieve-a-data-source)、[查询](https://developers.notion.com/reference/query-a-data-source)
- 页面对象提供标题、属性、身份及编辑时间，Markdown 读取提供正文；必要时补读内容块。[页面](https://developers.notion.com/reference/retrieve-a-page)、[正文](https://developers.notion.com/reference/retrieve-page-markdown)
- 普通属性通过页面响应一起读取；标题、描述等可能不完整时才使用单项属性接口分页补读，不逐字段请求简单属性。[单项属性](https://developers.notion.com/reference/retrieve-a-page-property)

## 属性契约

to-blog-site 必须是复选框，只有 true 允许公开；缺失或错误类型不能当作可信空集合。标题取页面的标题属性，当前名称为 Name，不增加第二份标题。Published 为必填日期，category 为可缺省单选，description 为可缺省文本；具体空值和日期规则见[元数据](../ARTICLE_METADATA.md)。其他属性不隐含发布、分类或摘要规则。

稳定页面 ID 决定文章身份及地址；标题、属性和正文须对应一致的最新保存状态。若读取期间源内容变化，有限重读后仍无法取得一致状态则报告失败，不回退旧正文。

## 正文与资源

默认正文是扩展 Markdown，按[文章页面规则](../ARTICLE_PAGES.md)转换。[增强格式](https://developers.notion.com/guides/data-apis/enhanced-markdown)

检查截断、未知内容块及未知占位，只有缺失内容全部处理完才可发布；权限不足、未取得正文与有效空正文分别处理。范围外或无法完整转换的内容报告文章和类型，并阻止整次发布。[缺失块](https://developers.notion.com/reference/retrieve-page-markdown#unknown-blocks)

必需图片在同步时下载并转为持久静态资源，替换临时签名及其他源图片地址，验证无需 Notion 登录即可读取。下载、内容校验或持久化失败阻止提交。[文件读取](https://developers.notion.com/guides/data-apis/retrieving-files)

## 完整性与撤回

完整处理分页、结果完整性、有限重试及接口错误。正常完整空集合可提交空站点；重复或异常游标、结果上限造成的不完整查询、鉴权失效及权限不足均失败。[分页上限](https://developers.notion.com/reference/query-a-data-source#pagination-limit)、[请求限制](https://developers.notion.com/reference/request-limits)

以本次完整成功查询的勾选集合为唯一发布集合，不读取旧站点或发布清单，不逐篇确认旧文章缺失原因。完整替换自然处理新增、更新和撤回；正常完整空集合可提交空站点。本次必要请求出现 404、权限错误或不完整结果时停止发布，任一失败保留完整旧站点；成功查询的可见集合变化按本次结果生效。
