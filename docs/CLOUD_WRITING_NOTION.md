# Notion 写作与文章读取

核实日期：2026-10-12。已完成用户文章库的只读 API 验证和一篇真实文章的本地博客同步；结果及复现命令见[文章读取路径](./NOTION_API_READING.md#用户账号验证清单)。

## 免费能力

官方价格页中 Free 为 $0，个人单成员工作区不限页面与内容块，单文件上传上限 5 MB；Public API 在 Free、Plus、Business、Enterprise 四列均标记支持。核实时读取了价格页原始 HTML 的对应功能行，避免文本提取丢失勾选符号。[价格与功能](https://www.notion.com/pricing)

Notion 提供网页、桌面与 iOS/Android 客户端；手机可读取、编辑同一工作区的内容。[移动端说明](https://www.notion.com/help/notion-for-mobile)

## 官方读取路径

工作区所有者可创建 internal connection，取得 API Token，并只授予读取内容能力。连接须另外获得页面或数据库访问权限；共享父页面会继承到子页面，无需将页面公开到互联网。[连接与授权](https://developers.notion.com/guides/get-started/internal-connections)

目前官方提供 `GET /v1/pages/{page_id}/markdown`，要求读取权限与 API 版本 `2026-03-11`。返回的是 Notion 扩展 Markdown；不能直接当成普通 Markdown。响应包含截断标记和未读取块 ID，部分嵌入类型仍需块接口处理。[Markdown 读取](https://developers.notion.com/reference/retrieve-page-markdown)、[格式与支持范围](https://developers.notion.com/guides/data-apis/working-with-markdown-content)

接口存在连接级与工作区级限流，需要按服务返回的等待时间重试。[调用限制](https://developers.notion.com/reference/request-limits)

## 对博客的建议与待验证项

已确认使用 My blog 文章库、to-blog-site 复选框和 Notion 属性元数据。只有明确选中的页面进入博客，页面标题为唯一标题来源；空分类和摘要规则见[需求记录](./NOTION_REQUIREMENTS.md)。

已成功读取用户 `My blog` 数据库的选定文章列表，并将一篇文章的属性和完整 Markdown 构建为静态博客。分页、日期、正文格式、图片及失败保护已通过可控返回测试；剩余真实内容与线上验收见[验收记录](./NOTION_ACCEPTANCE.md)。
