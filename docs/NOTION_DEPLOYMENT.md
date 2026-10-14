# GitHub Pages 自动发布

代码流程已实现，线上启用与验收待完成。首次部署前，流程文件必须进入默认分支 `main`，并完成下列一次性配置。之后只需在 Notion 写作和勾选发布，GitHub 每日自行拉取、构建和部署，电脑无需保持开机。

每日计划触发时间是北京时间 06:00；实际开始和完成可能受排队影响。默认分支代码推送与 Actions 手动运行也会触发。GitHub 公共仓库连续 60 天无仓库活动可能自动停用定时工作流，届时需在 Actions 重新启用。见[GitHub 定时规则](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

## 仓库配置

在 `0x3a0/my-blog` 的 Settings → Secrets and variables → Actions 配置：

| 名称 | 位置 | 值 |
| --- | --- | --- |
| NOTION_TOKEN | Secrets | 仅有文章读取权限的连接 Token |
| NOTION_DATA_SOURCE_ID | Variables | 推荐填写固定文章数据源 ID，直接查询文章 |
| NOTION_DATABASE_ID | Variables | 可选；未指定数据源时用于寻找唯一数据源，指定时校验归属 |

Settings → Pages 的 Source 选择 GitHub Actions；Actions 工作流需启用。不要在 Variables 中保存 Token。本地 `.env` 不会自动传到 GitHub。

`SITE_URL` 与 `SITE_BASE` 由工作流从 Pages 配置自动读取，不需要创建同名 Variables。默认项目地址为 `https://0x3a0.github.io/my-blog/`；本地命令默认使用 `/`，各自同步生成对应路径的文章、图片和完整站点。

## 首次部署

实现代码进入默认分支后，在 Actions 手动运行 `Deploy to GitHub Pages`。首次与后续运行使用相同全量同步流程，无需初始化选项，也不读取旧站点或发布清单。

每次拉取当前勾选集合并完整重建；有效空集合可生成空站点，接口错误或结果不完整则停止发布。更换配置的文章库后，下次成功部署采用新文章库的选定集合。

## 成功与失败

`pnpm notion:publish` 是 CI 的完整入口，包含检查、拉取和构建；无需在它之前单独执行 `notion:sync`。同步后只上传 `dist`，部署依赖整个构建成功；任一必需文章、图片或构建失败时不上传、不更新线上站点。临时候选和 Token 不属于上传内容。云端执行会在临时工作区生成 `src/content/blog`，不自动提交生成文章，也不更新本地电脑上的文件。

验证首页、`blogs`、文章详情与静态图片能匿名打开，然后完成[真实验收](./NOTION_ACCEPTANCE.md)。流程失败时先查看对应文章和内容类型，不要用首次初始化绕过错误。
