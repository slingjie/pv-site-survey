# 勘探报告工具 — 部署方案评估与迁移计划

## Context

评估 "1124勘探报告工具" 的部署架构，并将全部后端从 Supabase 迁移到 Cloudflare Pages Functions + D1 + R2 一体化部署。

**评估结论：方案 1（轻量计算架构）— 完美适配**
- 无 Python，后端已是 TypeScript
- 纯 CRUD + 图片上传，CPU 时间远低于 10ms 限制
- 已有 D1 数据库和 Worker 代码可复用

## 迁移范围

需要迁移 3 个模块，完全脱离 Supabase：

| 模块 | 当前实现 | 迁移目标 | 实际状态 |
|------|---------|---------|---------|
| 项目 CRUD | `services/projectApi.ts` → Supabase | Functions + D1（复用 `backend/src/worker.ts` 逻辑） | ✅ 已完成 |
| 价格库 | `services/priceApi.ts` → Supabase | Functions + D1（新增电价表 schema） | ⏭️ 跳过（代码中不存在） |
| 图片上传 | `services/projectApi.ts` → Supabase Storage | Functions + R2 | ✅ 已完成 |

## 目标架构

> ⚠️ **实际架构变更**：由于 Pages Functions 无法解析跨目录 `_` 前缀文件的 import，最终采用单文件 catch-all 方案 `functions/api/[[route]].ts`，而非下方的多文件结构。

```
勘探报告工具/
├── dist/                              # Vite 构建输出
├── functions/                         # Pages Functions（后端）
│   └── api/
│       ├── _shared.ts                 # 共享类型 + Env 接口 + CORS 工具
│       ├── projects/
│       │   ├── index.ts               # GET/POST /api/projects
│       │   ├── [id].ts               # GET/PUT/DELETE /api/projects/:id
│       │   └── [id]/
│       │       └── status.ts          # PATCH /api/projects/:id/status
│       ├── tou-policies/
│       │   ├── index.ts               # GET/POST /api/tou-policies
│       │   └── [id].ts               # GET/PUT/DELETE /api/tou-policies/:id
│       ├── price-entries/
│       │   └── index.ts               # POST /api/price-entries (批量保存)
│       └── upload.ts                  # POST /api/upload (图片上传到 R2)
├── services/                          # 前端 API 调用层（改为 fetch /api/...）
│   ├── projectApi.ts                  # 改为调用 /api/projects
│   ├── priceApi.ts                    # 改为调用 /api/tou-policies + /api/price-entries
│   └── supabaseClient.ts             # 删除
├── wrangler.toml                      # D1 + R2 绑定
├── package.json
└── vite.config.ts
```

## 迁移步骤

### 步骤 1：基础配置

1. 创建根目录 `wrangler.toml`（D1 + R2 绑定，复用已有 database_id） — ✅ 已完成
2. 创建 R2 bucket：`npx wrangler r2 bucket create tk-report-images` — ✅ 已完成
3. 更新 `package.json` scripts：加 `preview` 和 `deploy` 命令 — ✅ 已完成
4. 更新 D1 schema：在已有 `backend/schema.sql` 基础上新增电价表（JSONB → TEXT JSON 适配 SQLite） — ⏭️ 跳过（价格库不存在）

**D1 电价表 schema（从 Postgres 适配）：** — ⏭️ 跳过
- `tou_policies`：`JSONB` → `TEXT`（存 JSON 字符串），`UUID` → `TEXT`，`TIMESTAMP` → `TEXT`
- `price_entries`：同上，外键约束保留
- `price_entries`：同上，外键约束保留

### 步骤 2：创建 Pages Functions（后端）

> ⚠️ **实际变更**：改为单文件 `functions/api/[[route]].ts`（约 157 行），包含所有路由逻辑 + `ensureTable()` 自动建表。

**关键文件和复用关系：**

| 新文件 | 复用来源 | 说明 | 实际状态 |
|--------|---------|------|---------|
| `functions/api/_shared.ts` | `backend/src/worker.ts` L1-56 | Env 接口（加 R2）、类型定义、withCors、rowToSummary | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/projects/index.ts` | `worker.ts` handleListProjects + handleCreateProject | 直接迁移 | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/projects/[id].ts` | `worker.ts` handleGetProject + handleUpdateProject + handleDeleteProject | 直接迁移 | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/projects/[id]/status.ts` | `worker.ts` handleUpdateStatus | 直接迁移 | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/tou-policies/index.ts` | 新写 | 参考 `priceApi.ts` L24-138 的 Supabase 逻辑改为 D1 SQL | ⏭️ 跳过（价格库不存在） |
| `functions/api/tou-policies/[id].ts` | 新写 | GET 详情（含 prices）、DELETE | ⏭️ 跳过（价格库不存在） |
| `functions/api/price-entries/index.ts` | 新写 | 参考 `priceApi.ts` L141-168 批量保存 | ⏭️ 跳过（价格库不存在） |
| `functions/api/upload.ts` | 新写 | 接收 FormData，存入 R2，返回公开 URL | ✅ 已完成（合并到 [[route]].ts） |

### 步骤 3：改写前端 API 调用层

**`services/projectApi.ts`（改写）：** — ✅ 已完成
- 删除所有 Supabase 导入和直连逻辑
- 改为 `fetch("/api/projects")` 调用 Functions
- 图片上传改为 `fetch("/api/upload")` → R2
- `prepareReportDataWithUploadedImages` 中的 Supabase Storage 调用改为 `/api/upload`

**`services/priceApi.ts`（改写）：** — ⏭️ 跳过（价格库不存在）
- 删除 Supabase 导入
- 改为 `fetch("/api/tou-policies")` 和 `fetch("/api/price-entries")`
- 保留 localStorage 降级逻辑（`isSupabaseConfigured` 改为检测 API 可用性或直接删除）

**删除文件：**
- `services/supabaseClient.ts` — ✅ 已删除
- `services/priceRepo/supabasePriceRepo.ts`（如果有被引用则一并清理） — ⏭️ 不存在

### 步骤 4：清理依赖

- `package.json` 移除 `@supabase/supabase-js` — ✅ 已完成
- 移除 `better-sqlite3`、`express`、`cors`（Node.js 后端依赖） — ✅ 已完成
- `.env.local` 移除 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` — ✅ 已完成
- `vite.config.ts` 移除 API 代理配置（Functions 同域，不需要代理） — ✅ 已完成

### 步骤 5：可选清理

- `backend/` 目录可保留作参考或删除
- `server/index.cjs` 可保留（NAS 自托管方案）或删除

## 关键文件清单

| 文件 | 操作 | 实际状态 |
|------|------|---------|
| `wrangler.toml`（根目录） | 新建 | ✅ 已完成 |
| `functions/api/_shared.ts` | 新建 | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/projects/index.ts` | 新建（从 worker.ts 迁移） | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/projects/[id].ts` | 新建（从 worker.ts 迁移） | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/projects/[id]/status.ts` | 新建（从 worker.ts 迁移） | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/tou-policies/index.ts` | 新建 | ⏭️ 跳过（价格库不存在） |
| `functions/api/tou-policies/[id].ts` | 新建 | ⏭️ 跳过（价格库不存在） |
| `functions/api/price-entries/index.ts` | 新建 | ⏭️ 跳过（价格库不存在） |
| `functions/api/upload.ts` | 新建 | ❌ 未创建（合并到 [[route]].ts） |
| `functions/api/[[route]].ts` | — | ✅ 新建（单文件 catch-all） |
| `backend/schema.sql` | 修改（追加电价表） | ⏭️ 跳过（价格库不存在） |
| `services/projectApi.ts` | 改写 | ✅ 已完成 |
| `services/priceApi.ts` | 改写 | ⏭️ 跳过（价格库不存在） |
| `services/supabaseClient.ts` | 删除 | ✅ 已删除 |
| `App.tsx` | — | ✅ 已清理（移除 mock 数据） |
| `index.html` | — | ✅ 已清理（移除 importmap） |
| `package.json` | 修改（scripts + 移除 supabase 依赖） | ✅ 已完成 |
| `vite.config.ts` | 修改（移除代理） | ✅ 已完成 |
| `.env.local` | 修改（移除 supabase 变量） | ✅ 已完成 |

## 验证方式

1. `npx wrangler d1 execute tk_report_db --local --file=backend/schema.sql` — 初始化本地 D1 — ⚠️ 改为代码中 `ensureTable()` 自动建表
2. `npm run build && npx wrangler pages dev dist` — 本地测试 — ✅ 已验证
3. 访问 `http://localhost:8788` 确认前端加载 — ✅ 已验证
4. 测试项目 CRUD：创建/编辑/删除项目 — ✅ 已验证
5. 测试图片上传：在项目中添加图片，确认存入 R2 — ✅ 已验证
6. 测试价格库：创建/编辑/删除电价政策 — ⏭️ 跳过（价格库不存在）
7. `npm run deploy` — 部署到 Cloudflare Pages — ✅ 已完成
8. 线上验证所有功能 — ✅ 已验证（https://tk-report.pages.dev）

---

## 迁移完成总结（2026-02-18）

### 实际迁移范围

与原计划相比，实际只迁移了 2 个模块（价格库模块在代码中不存在）：

| 模块 | 状态 |
|------|------|
| 项目 CRUD | 已完成 |
| 图片上传 | 已完成 |
| 价格库（tou-policies / price-entries） | 跳过（代码中不存在该模块） |

### 架构变更

原计划使用多文件 Pages Functions（`_shared.ts` + 各路由文件），实际遇到 **Pages Functions 无法解析跨目录 `_` 前缀文件的 import** 问题，最终改为单文件 catch-all 方案：

```
functions/
└── api/
    └── [[route]].ts    # 所有 API 路由集中处理
```

这个文件包含：Env 接口、CORS 工具函数、`ensureTable()` 自动建表、全部路由处理逻辑（约 157 行）。

### API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/:id` | 获取项目详情 + reportData |
| PUT | `/api/projects/:id` | 更新项目 |
| DELETE | `/api/projects/:id` | 删除项目 |
| PATCH | `/api/projects/:id/status` | 更新项目状态 |
| POST | `/api/upload` | 图片上传到 R2 |
| GET | `/api/images/*` | 获取 R2 图片 |

### 资源绑定

| 资源 | 绑定名 | 标识 |
|------|--------|------|
| D1 数据库 | `DB` | `tk_report_db` (id: `9cc4a0a1-0c7c-4938-ba67-83e8d6a8d662`) |
| R2 存储桶 | `IMAGES` | `tk-report-images` |

### 文件变更汇总

| 文件 | 操作 |
|------|------|
| `wrangler.toml` | 新建（D1 + R2 绑定） |
| `functions/api/[[route]].ts` | 新建（全部 API 逻辑） |
| `services/projectApi.ts` | 改写（Supabase → fetch） |
| `services/supabaseClient.ts` | 删除 |
| `App.tsx` | 清理（移除 mock 数据和 backendAvailable 逻辑） |
| `index.html` | 清理（移除 importmap 和 index.css 引用） |
| `package.json` | 修改（移除 supabase 依赖，添加 wrangler） |
| `vite.config.ts` | 修改（移除 proxy） |
| `.env.local` | 修改（移除 supabase 变量） |

### 生产部署

- 项目名：`tk-report`
- 生产 URL：https://tk-report.pages.dev
- D1 和 R2 绑定通过 Cloudflare REST API 配置到 Pages 项目
- 本地开发：`npm run build && npx wrangler pages dev dist`
- 部署命令：`npm run deploy`

### 遇到的问题及解决

1. **Pages Functions import 解析失败** — `_shared.ts` 无法被嵌套目录导入 → 合并为单文件 `[[route]].ts`
2. **D1 本地无表** — `wrangler d1 execute` 对 Pages 项目不生效 → 添加 `ensureTable()` 每次请求自动建表
3. **`/index.css` 404** — `index.html` 引用了不存在的文件 → 移除引用
