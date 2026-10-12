# Notion 实现代码审查

用户确认基准 `e06edf1`，覆盖所有实现前未提交的页面、文档及 Notion 接入。初审比较 `e06edf1...2b3172a`，两名审查者分别检查仓库规范和规格。

## Standards

硬性规则违例 0。发现两项 P3 判断性问题，均已处理：

- 无调用方的完整 HTML 转换属于 possible Speculative Generality；删除该入口及专用 rehype-sanitize 依赖，保留 Notion 表格转换。
- 线上清单类型与校验重复属于 possible Duplicated Code；合并为一个版本化 schema 并推导类型，命令和同步入口共用。

## Spec

初审发现六项错误实现，均已修复：

- P1：提交后清理失败误报同步失败。临时清理有限重试，失败仅告警，实际提交结果保持成功；提交前错误仍保留旧站点。
- P2：固定占位符碰撞。转换标记避开原文，普通文本与代码不再互相替换。
- P2：嵌套提示框脱离列表。保留父列表缩进，提示框继续作为该列表项的引用。
- P2：日期提及丢失信息。保留开始/结束日期、时间与时区；格式依据 [Notion 增强 Markdown](https://developers.notion.com/guides/data-apis/enhanced-markdown#mentions)。
- P2：损坏图片只凭头部通过。通过 sharp 解码校验全部帧，截断 PNG/JPEG 的同步回归验证旧站点保留。
- P2：图片校验/保存错误缺少定位。下载、格式校验和保存均报告文章 ID 及安全资源编号，不输出签名 URL。

没有发现明确范围蔓延。真实图片、作者修改/撤回及远程部署缺少完整证据，仍按[验收记录](./NOTION_ACCEPTANCE.md)待验收。

初审合计：Standards 2 项（最高 P3），Spec 6 项（最高 P1）；两轴问题分别处理，没有合并排序。

`dbe7afe` 修复后由原两位审查者分别复核：Standards 原问题剩余 0、新增硬性违例 0；Spec 原问题剩余 0、新增问题 0。
