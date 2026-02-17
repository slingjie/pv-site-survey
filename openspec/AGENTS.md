# OpenSpec 目录协作规范

- 本目录仅存放 OpenSpec 相关元数据与变更说明，不直接存放业务代码。
- 书写语言统一使用简体中文。
- Markdown 文件使用 UTF-8 编码，标题层级保持简洁（不超过 3 级）。
- 在 `openspec/changes/<id>/` 下：
  - `proposal.md`：描述问题背景、目标与范围。
  - `design.md`：记录关键架构决策与技术取舍。
  - `tasks.md`：拆解为可执行的小任务列表。
  - `specs/<capability>/spec.md`：存放具体需求，按能力维度拆分。
- 变更 ID（`<id>`）需使用动词开头的短横线风格，例如：`migrate-backend-to-nas`。
- 编写新 spec 前，优先复用现有概念与字段命名，避免同义术语混用。

