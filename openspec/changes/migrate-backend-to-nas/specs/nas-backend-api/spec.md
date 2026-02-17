# Spec: NAS 自建后端 API

## ADDED Requirements

### Requirement: 提供与 Worker 兼容的 REST API

后端 **SHALL** 在 NAS 上提供与现有 Cloudflare Worker 兼容的 REST API 接口，以便前端可以通过切换 `API_BASE` 无缝对接。

#### Scenario: 列出所有项目

- 当客户端对 `GET /api/projects` 发起请求时：
  - 系统应从本地数据库的 `projects` 表中读取所有记录，并按 `updated_at` 倒序排序。
  - 返回的每条记录应包含：`id`, `name`, `location`, `status`, `surveyDate`, `surveyors`, `projectType`, `updatedAt` 字段。

#### Scenario: 创建新项目

- 当客户端向 `POST /api/projects` 发送包含 `project` 与 `reportData` 字段的 JSON 请求体时：
  - 若缺少必填字段（例如 `name` 或 `location` 或 `status`），应返回 `400` 状态码。
  - 否则，在数据库中插入一条新记录，并返回 `201` 状态码与新项目的 `id`。

#### Scenario: 获取单个项目详情

- 当客户端对 `GET /api/projects/:id` 发起请求时：
  - 若存在对应记录，应返回包含 `project`（项目摘要）和 `reportData`（完整报告 JSON）的响应。
  - 若不存在对应记录，应返回 `404` 状态码。

#### Scenario: 更新项目及报告

- 当客户端向 `PUT /api/projects/:id` 发送包含 `project` 与/或 `reportData` 的 JSON 请求体时：
  - 若指定 `id` 不存在，应返回 `404` 状态码。
  - 若更新成功，不需要返回实体内容，应返回 `204` 状态码。

#### Scenario: 更新项目状态

- 当客户端向 `PATCH /api/projects/:id/status` 发送 `{ "status": "editing" | "completed" }` 时：
  - 若缺少 `status` 字段，应返回 `400` 状态码。
  - 若更新成功，应返回 `204` 状态码。
  - 若记录不存在，应返回 `404` 状态码。

#### Scenario: 删除项目

- 当客户端对 `DELETE /api/projects/:id` 发起请求时：
  - 若记录存在，应删除并返回 `204` 状态码。
  - 若记录不存在，应返回 `404` 状态码。

### Requirement: 使用本地数据库存储项目与报告

后端 **MUST** 在 NAS 环境中使用本地数据库持久化项目与报告数据，避免对 Cloudflare D1 的依赖。

#### Scenario: 初始化数据库结构

- 部署后端服务时：
  - 系统应基于 `backend/schema.sql` 中的建表语句创建 `projects` 表（若尚未存在）。
  - 字段应至少包含：`id`, `name`, `location`, `status`, `survey_date`, `surveyors`, `project_type`, `report_data`, `created_at`, `updated_at`。

#### Scenario: 存储完整的报告 JSON

- 当收到创建或更新项目的请求时：
  - 系统应将 `reportData` 序列化为 JSON 文本并存入 `report_data` 字段。
  - 不再受 Cloudflare D1 单条记录容量限制的约束（具体上限由所选数据库决定）。

### Requirement: 支持跨域访问前端

后端 **SHALL** 允许来自前端部署域名的跨域访问，保证浏览器可以直接调用 NAS 后端 API。

#### Scenario: 允许指定来源的 CORS 请求

- 当前端在浏览器中从不同域名访问 NAS 后端时：
  - 后端应在响应中正确返回 `Access-Control-Allow-Origin` 等 CORS 头部（可配置为前端域名或 `*`）。
  - 对于 `OPTIONS` 预检请求，应返回 `204` 或 `200` 状态码以及允许的方法与头部信息。
