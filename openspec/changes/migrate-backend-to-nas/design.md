# 设计说明：NAS 自建后端与数据库

## 当前架构

- 前端：构建后托管为静态资源，通过浏览器直接访问。
- 后端：Cloudflare Worker，导出 `fetch(request, env)`，通过 `env.DB` 调用 D1 数据库。
- 存储：Cloudflare D1 单表 `projects`，字段与 `schema.sql` 保持一致。

## 目标架构

- 在 NAS 上运行一个常驻的后端进程：
  - 技术栈：Node.js + Express（或类似轻量框架）。
  - 路由：
    - `GET /api/projects`
    - `POST /api/projects`
    - `GET /api/projects/:id`
    - `PUT /api/projects/:id`
    - `PATCH /api/projects/:id/status`
    - `DELETE /api/projects/:id`
  - 行为与 Cloudflare Worker 版本保持一致，便于前端无感切换。

- 数据库：
  - 推荐优先使用 SQLite（文件型数据库，部署简单，适合单机 NAS 场景）。
  - 使用与 `schema.sql` 等价的建表语句，字段与类型保持一致。
  - 通过 Node.js 数据库驱动（如 `better-sqlite3`）执行 SQL。

- 网络与部署：
  - NAS 内部监听一个 HTTP 端口（例如 `http://localhost:8787`）。
  - 通过路由器端口转发或 Cloudflare Tunnel 将该服务暴露为公网可访问的 HTTPS 域名（例如 `https://api.example.com`）。
  - 前端在生产环境下将 `API_BASE` 切换为该域名前缀（`https://api.example.com/api`）。

## 兼容性与迁移策略

- API 兼容：确保 NAS 后端返回的 JSON 结构与 Worker 完全一致，字段名不变。
- 渐进迁移：
  - 初始阶段可以同时保留 Cloudflare Worker 与 NAS 后端，前端通过配置决定使用哪一套。
  - 验证 NAS 后端稳定后，再考虑下线 D1 与 Worker。

## 后续扩展考虑（非本次必做）

- 将大体积图片从 JSON 中拆分，迁移到对象存储（NAS 文件系统或专用对象存储），数据库仅存路径或 URL。
- 引入简单的访问控制（例如基于 API Key 的保护），保证 NAS 暴露到公网后的安全性。 

