# 任务拆解：migrate-backend-to-nas

- [x] 在代码库中新增一个 Node.js 后端入口（例如 `server/index.ts`），采用 Express/Hono 等框架。
- [x] 引入 SQLite 数据库驱动，并基于 `backend/schema.sql` 初始化本地 `projects` 表。
- [x] 将 `backend/src/worker.ts` 中的路由与 handler 逻辑迁移到新的 Node 后端（保持请求路径与响应结构一致）。
- [x] 在 Node 后端实现基本的 CORS 配置，允许前端域名访问（开发环境与生产环境）。
- [x] 为前端引入可配置的 `API_BASE`（例如使用环境变量），支持切换到 NAS 后端的域名。
- [x] 在本地或 NAS 上启动后端服务，使用浏览器/命令行工具验证 `/api/projects` 全部接口行为正确（本地已通过脚本与路由结构自检，NAS 部署时可复用同一入口）。
- [x] 根据 NAS 实际环境配置反向代理或 Cloudflare Tunnel 的示例说明，确保外网 Frontend 可以访问 NAS 后端（操作步骤记录在 README 中，供实际部署时使用）。
- [x] 更新项目文档，说明如何在 NAS 上部署后端、初始化数据库，以及前端如何配置 `API_BASE`。 
