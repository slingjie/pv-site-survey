# 勘探报告工具 — 部署方案评估与迁移计划

## Context

评估 "1124勘探报告工具" 的部署架构，并将全部后端从 Supabase 迁移到 Cloudflare Pages Functions + D1 + R2 一体化部署。

**评估结论：方案 1（轻量计算架构）— 完美适配**
- 无 Python，后端已是 TypeScript
- 纯 CRUD + 图片上传，CPU 时间远低于 10ms 限制
- 已有 D1 数据库和 Worker 代码可复用

## 迁移范围

需要迁移 3 个模块，完全脱离 Supabase：

| 模块 | 当前实现 | 迁移目标 |
|------|---------|---------|
| 项目 CRUD | `services/projectApi.ts` → Supabase | Functions + D1（复用 `backend/src/worker.ts` 逻辑） |
| 价格库 | `services/priceApi.ts` → Supabase | Functions + D1（新增电价表 schema） |
| 图片上传 | `services/projectApi.ts` → Supabase Storage | Functions + R2 |

## 目标架构

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

1. 创建根目录 `wrangler.toml`（D1 + R2 绑定，复用已有 database_id）
2. 创建 R2 bucket：`npx wrangler r2 bucket create tk-report-images`
3. 更新 `package.json` scripts：加 `preview` 和 `deploy` 命令
4. 更新 D1 schema：在已有 `backend/schema.sql` 基础上新增电价表（JSONB → TEXT JSON 适配 SQLite）

**D1 电价表 schema（从 Postgres 适配）：**
- `tou_policies`：`JSONB` → `TEXT`（存 JSON 字符串），`UUID` → `TEXT`，`TIMESTAMP` → `TEXT`
- `price_entries`：同上，外键约束保留

### 步骤 2：创建 Pages Functions（后端）

**关键文件和复用关系：**

| 新文件 | 复用来源 | 说明 |
|--------|---------|------|
| `functions/api/_shared.ts` | `backend/src/worker.ts` L1-56 | Env 接口（加 R2）、类型定义、withCors、rowToSummary |
| `functions/api/projects/index.ts` | `worker.ts` handleListProjects + handleCreateProject | 直接迁移 |
| `functions/api/projects/[id].ts` | `worker.ts` handleGetProject + handleUpdateProject + handleDeleteProject | 直接迁移 |
| `functions/api/projects/[id]/status.ts` | `worker.ts` handleUpdateStatus | 直接迁移 |
| `functions/api/tou-policies/index.ts` | 新写 | 参考 `priceApi.ts` L24-138 的 Supabase 逻辑改为 D1 SQL |
| `functions/api/tou-policies/[id].ts` | 新写 | GET 详情（含 prices）、DELETE |
| `functions/api/price-entries/index.ts` | 新写 | 参考 `priceApi.ts` L141-168 批量保存 |
| `functions/api/upload.ts` | 新写 | 接收 FormData，存入 R2，返回公开 URL |

### 步骤 3：改写前端 API 调用层

**`services/projectApi.ts`（改写）：**
- 删除所有 Supabase 导入和直连逻辑
- 改为 `fetch("/api/projects")` 调用 Functions
- 图片上传改为 `fetch("/api/upload")` → R2
- `prepareReportDataWithUploadedImages` 中的 Supabase Storage 调用改为 `/api/upload`

**`services/priceApi.ts`（改写）：**
- 删除 Supabase 导入
- 改为 `fetch("/api/tou-policies")` 和 `fetch("/api/price-entries")`
- 保留 localStorage 降级逻辑（`isSupabaseConfigured` 改为检测 API 可用性或直接删除）

**删除文件：**
- `services/supabaseClient.ts`
- `services/priceRepo/supabasePriceRepo.ts`（如果有被引用则一并清理）

### 步骤 4：清理依赖

- `package.json` 移除 `@supabase/supabase-js`
- 移除 `better-sqlite3`、`express`、`cors`（Node.js 后端依赖）
- `.env.local` 移除 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
- `vite.config.ts` 移除 API 代理配置（Functions 同域，不需要代理）

### 步骤 5：可选清理

- `backend/` 目录可保留作参考或删除
- `server/index.cjs` 可保留（NAS 自托管方案）或删除

## 关键文件清单

| 文件 | 操作 |
|------|------|
| `wrangler.toml`（根目录） | 新建 |
| `functions/api/_shared.ts` | 新建 |
| `functions/api/projects/index.ts` | 新建（从 worker.ts 迁移） |
| `functions/api/projects/[id].ts` | 新建（从 worker.ts 迁移） |
| `functions/api/projects/[id]/status.ts` | 新建（从 worker.ts 迁移） |
| `functions/api/tou-policies/index.ts` | 新建 |
| `functions/api/tou-policies/[id].ts` | 新建 |
| `functions/api/price-entries/index.ts` | 新建 |
| `functions/api/upload.ts` | 新建 |
| `backend/schema.sql` | 修改（追加电价表） |
| `services/projectApi.ts` | 改写 |
| `services/priceApi.ts` | 改写 |
| `services/supabaseClient.ts` | 删除 |
| `package.json` | 修改（scripts + 移除 supabase 依赖） |
| `vite.config.ts` | 修改（移除代理） |
| `.env.local` | 修改（移除 supabase 变量） |

## 验证方式

1. `npx wrangler d1 execute tk_report_db --local --file=backend/schema.sql` — 初始化本地 D1
2. `npm run build && npx wrangler pages dev dist` — 本地测试
3. 访问 `http://localhost:8788` 确认前端加载
4. 测试项目 CRUD：创建/编辑/删除项目
5. 测试图片上传：在项目中添加图片，确认存入 R2
6. 测试价格库：创建/编辑/删除电价政策
7. `npm run deploy` — 部署到 Cloudflare Pages
8. 线上验证所有功能
