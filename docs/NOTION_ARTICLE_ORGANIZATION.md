# Notion 文章整理

沿用 My blog 文章库，All blogs 是画廊视图，每张卡片是一篇独立文章。点击新建写正文，无需重新建立文章库。

## 文章属性

| 属性 | 类型 | 用途 |
| --- | --- | --- |
| Name / 页面标题 | Title | 唯一标题来源 |
| to-blog-site | Checkbox | 默认不勾选，勾选允许公开 |
| Published | Date | 选定文章必填，用于显示及按年归档 |
| category | Select | 空值保留，博客显示“未分组” |
| description | Text | 空值保留，不自动生成摘要 |
| Tags | Multi-select | 继续供作者整理，不自动作为分类 |

在文章标题下方 Add a property 添加属性；这些属性属于文章库，每篇文章分别填写。已有 AI custom autofill 文本不自动作为摘要来源；整理字段时可自行迁移其值到 description。

## 发布

在 Notion 完成正文及日期，再勾选 to-blog-site。勾选期间保存修改进入下次同步；取消勾选、移出库或回收站撤回在成功同步后下架。

页面是否 Publish to web 与博客发布选择独立，读取须通过连接授权。首版仍按年归档，不增加分类或标签页面。

完整规则见[需求记录](./NOTION_REQUIREMENTS.md)，读取事实见[API 路径](./NOTION_API_READING.md)，日期处理见[元数据](./ARTICLE_METADATA.md)，正文转换见[文章页面](./ARTICLE_PAGES.md)。
