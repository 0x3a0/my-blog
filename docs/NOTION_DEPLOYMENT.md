# GitHub Pages 自动发布

代码流程已实现，尚未在远程运行验收。每日触发时间是北京时间 06:00；实际开始和完成可能受 GitHub 排队影响。

## 仓库配置

在 `0x3a0/my-blog` 的 Settings → Secrets and variables → Actions 配置：

| 名称 | 位置 | 值 |
| --- | --- | --- |
| NOTION_TOKEN | Secrets | 仅有文章读取权限的连接 Token |
| NOTION_DATABASE_ID | Variables | My blog 数据库 ID |
| NOTION_DATA_SOURCE_ID | Variables | 多数据源时填写选定的数据源 ID |

Settings → Pages 的 Source 选择 GitHub Actions。不要在 Variables 中保存 Token。本地 `.env` 不会自动传到 GitHub。

## 首次部署

实现代码进入默认分支后，在 Actions 手动运行 `Deploy to GitHub Pages`。只有目标站点尚无 `blog-publication.json` 时勾选 `initialize`；这允许首次读取该文件返回 404。首次成功后，普通手动运行和每日运行均保持未勾选。

`initialize` 不忽略权限、服务错误或损坏清单。已有清单时仍检查来源与文章身份，防止把读取失败误判为空站点。更换文章库需要单独规划迁移。

## 成功与失败

同步后只上传 `.artifacts/notion-published/site`，部署依赖整个构建成功；任一必需文章、图片或构建失败时不上传、不更新线上站点。内部清单和 Token 不属于上传内容。

验证首页、`blogs`、文章详情与静态图片能匿名打开，然后完成[真实验收](./NOTION_ACCEPTANCE.md)。流程失败时先查看对应文章和内容类型，不要用首次初始化绕过错误。

