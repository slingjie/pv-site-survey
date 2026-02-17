# 通用 Cloudflare + Supabase 架构说明（模板）

本说明与具体业务无关，抽象出一套基于 **Cloudflare Pages + Supabase** 的通用应用架构，可用于表单系统、管理后台、数据收集工具、轻量 SaaS 等场景。

---

## 一、适用场景与目标

- 适用场景：
  - 以 Web 界面为主的业务系统：运营后台、报表看板、配置中心、内容管理等。
  - 需要上传文件/图片的表单场景：调查问卷、报修系统、审批流程等。
  - 希望快速上线、尽量少维护自建服务器的中小型项目。
- 核心目标：
  - 前端静态托管，利用 CDN 加速。
  - 后端托管型 BaaS（数据库 + 文件存储 + Auth）。
  - 尽量减少自管服务，降低运维成本。
  - 前后端通过清晰的接口层解耦，方便演进。

---

## 二、通用逻辑分层

可以抽象为四层：

1. **表示层（Presentation / SPA）**
   - 技术选型：React / Vue / Svelte 等任意前端框架 + Vite/Next/Nuxt 等构建工具。
   - 功能：路由、界面、表单交互、图表展示、状态管理（React Query / Zustand 等）。
2. **前端访问层（Frontend Data Access）**
   - 职责：为表示层屏蔽具体后端实现细节。
   - 实现形式：
     - 直接使用 Supabase SDK。
     - 或封装 HTTP 客户端调用自建 API（如 Worker BFF）。
3. **BaaS 层（Supabase）**
   - Postgres：结构化/半结构化数据（表 + JSONB）。
   - Storage：文件/图片/附件。
   - Auth：用户认证、会话管理。
   - Edge Functions：需要服务端计算或第三方集成的逻辑。
4. **可选 API 网关 / BFF（Cloudflare Workers）**
   - 职责：
     - 聚合来自 Supabase / 第三方服务的数据。
     - 管理复杂鉴权/签名逻辑。
     - 做缓存或流式输出（如 SSE/流式 AI 输出）。

数据流示意：

```text
浏览器 SPA（表示层） ── 调用 ── 前端访问层（Supabase SDK 或 HTTP 客户端）
           │
           ├─ 直接访问 Supabase（简单业务）
           │       ├─ Postgres（CRUD）
           │       └─ Storage（文件上传/下载）
           │
           └─ 经过 Cloudflare Worker BFF（复杂/多源场景）
                   ├─ 调 Supabase
                   ├─ 调外部 API
                   └─ 做缓存/聚合/权限控制
```

---

## 三、通用目录结构模板

对于采用 Cloudflare Pages + Supabase 的前后端一体项目，可以采用类似结构：

```text
project-root
├─ src/                    # 前端源代码（React/Vue 等）
│  ├─ app.tsx / main.tsx   # SPA 入口
│  ├─ pages/               # 页面级组件（列表、详情、报表等）
│  ├─ components/          # 通用 UI 组件（表单、弹窗、表格等）
│  ├─ api/                 # 前端访问层封装（对 Supabase 或 HTTP API 的封装）
│  ├─ config/              # 业务配置（枚举、常量、表单配置等）
│  └─ types/               # TypeScript 类型定义（领域模型）
├─ docs/                   # 架构说明、部署手册、迁移记录
├─ supabase/               # 可选：SQL 脚本/迁移、RLS 策略示例
├─ worker/                 # 可选：Cloudflare Worker（BFF / API 网关）
│  ├─ src/
│  └─ wrangler.toml
├─ package.json
├─ tsconfig.json
└─ vite.config.ts / next.config.js 等
```

关键点：

- 将“前端访问层”（如 `api/` 或 `services/`）单独抽出来，避免各个组件直接调用 Supabase/HTTP。
- 类型定义与表结构尽量对应，方便在前后端共享模型。
- 若有 Worker，则视为“可选 BFF 层”，不要在业务代码中散落地直接调用多处后端。

---

## 四、通用数据与权限设计原则

### 4.1 表设计

- 核心表通常包含：
  - 主键 `id`（uuid/text）。
  - 业务字段（例如 name/status/...）。
  - 通用审计字段：`created_at`、`updated_at`。
  - 根据需要加上 `owner_id` / `tenant_id` 等多租户或归属字段。
- 大字段（富文本、配置 JSON）可使用 `jsonb`，避免过度拆表。

### 4.2 文件存储

- 使用 Storage bucket 保存大体积文件，只在表中保存路径或 URL。
- 推荐路径约定：
  - `bucket_name/user-or-tenant/业务实体/实体ID/文件名.ext`

### 4.3 权限控制

- 开发/测试阶段：
  - 可以暂时关闭 RLS 或使用较宽松策略。
- 生产阶段：
  - 启用 RLS，策略基于 `auth.uid()` 或 `tenant_id` 过滤访问。
  - Storage 同样使用策略限制 bucket 和路径。

### 4.4 多环境

- 最少区分：开发（local）/ 预发（staging）/ 生产（prod）三套 Supabase 项目。
- 各自使用不同的 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY`。

---

## 五、配置与环境变量约定

### 5.1 前端环境变量

在使用 Vite 等工具时，前端可约定：

- `VITE_SUPABASE_URL`：目标 Supabase 项目的 URL。
- `VITE_SUPABASE_ANON_KEY`：匿名访问 key（仅在前端使用）。
- 其他业务相关变量统一加 `VITE_` 前缀。

### 5.2 Supabase 客户端封装模式

推荐统一封装一个模块（伪代码）：

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(supabaseUrl!, supabaseAnonKey!);
}

export const getSupabaseClient = (): SupabaseClient => {
  if (!client) {
    throw new Error("Supabase 未配置，请检查环境变量。");
  }
  return client;
};
```

这样：

- 组件与业务代码只依赖 `getSupabaseClient()` 与 `isSupabaseConfigured`。
- 在未配置 Supabase 时，可以自动回退到本地 mock 数据或禁用相关功能。

### 5.3 Cloudflare Pages 环境变量

- 在 Cloudflare Pages 的 Production/Preview 环境中分别配置：
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- 不同环境指向不同的 Supabase 项目，实现多环境隔离。

---

## 六、何时引入 Cloudflare Worker / Edge Functions

虽然“前端直接连 Supabase”对很多中小项目已经足够，但在以下情况可以考虑增加一个 BFF 层：

- 需要聚合多个数据源（如 Supabase + 其他第三方 API）。
- 需要处理一些不适合放在浏览器的逻辑：
  - 复杂签名、密钥操作。
  - 大批量导出/报表生成。
  - 与内部网络或私有 API 的交互。
- 对响应性能有更高要求，希望：
  - 在边缘节点做缓存。
  - 做流式输出（例如 AI 生成长文、流式日志等）。

此时可以：

- 使用 Cloudflare Workers 作为 API 网关。
- 使用 Supabase Edge Functions 作为“数据库附近的业务逻辑层”。
- 前端只调用统一的 HTTP API，不关心背后是 Supabase 还是其他服务。

---

## 七、小结：可迁移到任意业务的一套模式

可以概括为一句话：

> 把前端当作一个纯静态 SPA 托管在 Cloudflare Pages，把绝大部分数据/文件/权限交给 Supabase 管，再根据复杂度决定是否加一个 Worker/Edge Functions 作为 BFF。

在任何新的项目中，你只需要：

1. 换掉业务领域模型（表结构 + 前端类型定义）。
2. 重新设计对应的表单页面和 UI。
3. 在 `api/` 或 `services/` 目录中编写新的 Supabase 访问封装。
4. 按照本说明的通用原则配置 Supabase 表、Storage 和 RLS。

就可以获得一套结构清晰、易扩展、运维成本低的 Cloudflare + Supabase 架构。

