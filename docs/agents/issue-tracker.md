# 任务跟踪器

任务与规格使用 [0x3a0/my-blog 的 GitHub Issues](https://github.com/0x3a0/my-blog/issues)。所有操作明确指定该仓库。

- 优先使用已连接的 GitHub 工具；不支持的操作使用已登录的 GitHub 网页或已认证的 gh。使用 gh 时明确指定 `--repo 0x3a0/my-blog`。
- “发布到任务跟踪器”表示创建 GitHub Issue；“获取任务”表示读取对应 Issue。发布前检查同一规格是否已有记录，避免重复。
- 任务引用使用仓库内的 Issue 编号或完整链接。评论、状态变更及关闭操作均记录在对应 Issue。
- 按[标签映射](./triage-labels.md)应用状态；通过文件或结构化参数传递多行正文，保留实际换行。
- PRs as a request surface: no。
- 父子任务优先使用 GitHub 原生子任务与依赖关系；不可用时在正文中记录所属父任务与阻塞编号。
