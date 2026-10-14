# 本地 Notion 配置

使用现有 `My blog` 文章库，每条记录是一篇文章。数据库权限授予读取连接即可，无需 Publish to web。连接与授权步骤见[API 说明](./NOTION_API_READING.md#授权与请求保护)。

| 属性 | 类型 | 规则 |
| --- | --- | --- |
| 标题（现有 Name） | Title | 唯一标题来源 |
| to-blog-site | Checkbox | 仅勾选文章公开 |
| Published | Date | 勾选文章必填，区间取开始日期 |
| description | Text | 缺失或为空保留空值 |
| category | Select | 缺失或未选显示“未分组” |

`Tags` 与现有自动填充字段不参与发布规则。勾选后保存的修改会在下次成功同步更新；取消勾选等撤回规则见[发布边界](./ARTICLE_PUBLISHING.md)。

以 `.env.example` 创建本地 `.env`，填写 `NOTION_TOKEN` 和固定的 `NOTION_DATA_SOURCE_ID`，同步直接读取该数据源。`NOTION_DATABASE_ID` 可留空；填写时额外检查所属数据库。只知道数据库 ID 时也可只填 `NOTION_DATABASE_ID`，程序寻找唯一数据源；存在多个数据源时必须明确指定。ID 获取方式见[读取路径](./NOTION_API_READING.md)。不要把凭据写入文档、聊天或提交记录。

运行一次 `pnpm notion:sync` 即完成拉取和静态构建，无需再运行 `notion:publish`。

| 成功结果 | 位置 |
| --- | --- |
| Markdown 文章 | `src/content/blog` |
| 持久图片 | `public/article-assets` |
| 完整静态站点 | `dist` |

生成文章和图片均受 Git 忽略；文章以 Notion 为来源，本地修改会在下次成功同步被替换。每次完整读取当前勾选集合，不依赖旧文章或发布清单。候选在 `.cache/notion` 中隔离构建，全部校验成功后才更新工作目录和 `dist`；成功或正常失败后清理候选。普通 `pnpm build` 构建当前本地文章，不主动连接 Notion；正式发布使用[每日发布入口](./NOTION_DEPLOYMENT.md)。失败保护见[同步说明](./NOTION_SYNC.md)。

本地同步、开发、构建和预览默认从 `/` 开始，不需要配置 `SITE_URL` 或 `SITE_BASE`；本地 `.env` 只保存 Notion 读取配置。线上工作流从 GitHub Pages 读取域名与基础路径，普通项目站点使用 `/my-blog/`，不将仓库名称写死在本地命令中。

运行 `pnpm dev` 直接启动 `astro dev`，读取 `src/content/blog` 与 `public`；默认打开 `http://localhost:4321/`，具体以终端地址为准。未同步过时先运行 `pnpm notion:sync`。开发模式不直接请求 Notion；需要本地查看云端修改时先同步，再重启开发服务。已同步内容目录不参与开发文件监听，避免 Windows 阻止目录替换。

线上更新无需每天在电脑上运行命令：完成[GitHub 一次性配置](./NOTION_DEPLOYMENT.md)后，GitHub 每日自动拉取、构建并部署；云端生成内容不会自动下载到本地电脑。

本地预览已同步的 `dist` 站点，直接运行 `pnpm preview`，打开 `http://localhost:4321/`。预览不会重新读取 Notion。此前按 `/my-blog/` 生成的本地文章需要重新同步一次，使正文图片与文章链接改为根路径。

内容支持及失败条件见[规格](./spec/API_CONTRACT.md)与[验收记录](./NOTION_ACCEPTANCE.md)。
