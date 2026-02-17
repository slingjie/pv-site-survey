# 勘探报告工具架构总览（Cloudflare Pages + Supabase 模式）

本文档整理当前项目在「Cloudflare Pages + Supabase」模式下的整体架构，方便后续在其他项目中复用同一套模式（静态前端 + BaaS 后端）。

---

## 一、整体架构概览

### 1.1 高层架构角色分工

- 前端应用：
  - 技术栈：React + TypeScript + Vite，单页应用（SPA）。
  - 部署：构建产物托管在 Cloudflare Pages。
  - 职责：踏勘项目管理、报告编辑、报告预览/打印/导出。
- 后端服务：
  - 主要模式：Supabase（Postgres + Storage），作为托管型 BaaS。
  - 访问方式：前端直接使用 `@supabase/supabase-js` SDK 调用，无自建 API 服务器。
  - 职责：
    - Postgres：保存项目基础信息与结构化报告数据（JSONB）。
    - Storage：保存大体积图片文件，仅在数据库中保存公开 URL。
- 备选/历史后端：
  - Cloudflare Workers + D1（`backend/`）：早期版本使用的 Serverless API。
  - Node.js + Express + SQLite（`server/index.cjs`）：适合部署在 NAS 的自管后端。

用文字形式的架构示意：

```text
[手机 / PC 浏览器]
        │  HTTPS
        ▼
 Cloudflare Pages（静态前端 SPA）
        │  通过 Supabase JS SDK 调用
        ▼
    Supabase 项目
   ├─ Postgres（public.projects 表）
   └─ Storage（project-images bucket）
```

> 核心思路：让 Cloudflare 只负责前端托管与 CDN，所有数据存储和文件上传交给 Supabase；前端直接连 Supabase，无需额外的自建 Node/Worker API。

### 1.2 目录与职责对照

- 前端核心：
  - `App.tsx`：顶层视图切换与状态管理（项目列表、编辑器、新建页面）。
  - `components/views/`：页面级组件（`HomePage.tsx`、`NewProjectPage.tsx`、`ReportEditor.tsx`）。
  - `components/editor/`：报告各模块的编辑页面（厂区概况、屋面、电气设施、资料清单等）。
  - `components/common/`：通用表单组件与弹窗（输入框、图片上传、Toast、报告预览等）。
  - `types.ts`：`Project`、`ReportData` 等核心数据模型。
  - `services/formConfigs.ts`：所有表单字段与枚举配置的唯一真源。
  - `services/mockData.ts`：内置示例项目与报告数据（本地演示/离线模式）。
- Supabase 集成：
  - `services/supabaseClient.ts`：Supabase 客户端封装（读取环境变量创建 client）。
  - `services/projectApi.ts`：基于 Supabase 的项目 CRUD 与图片上传逻辑。
- 历史/备选后端：
  - `backend/`：Cloudflare Worker + D1 版本的 `/api/projects`。
  - `server/index.cjs`：Express + SQLite 版本的 `/api/projects`，可用于 NAS。

---

## 二、前端架构与运行模式

### 2.1 App 级状态与页面结构

入口组件：`App.tsx`

- 负责管理以下状态：
  - `projects: Project[]`：项目列表。
  - `projectsData: Record<string, ReportData>`：每个项目的完整报告数据。
  - `currentView: "home" | "new" | "editor"`：当前视图。
  - `currentReportId: string | null`：当前正在编辑的项目 ID。
  - `isMobileView: boolean`：当前展示模式（手机视图 / 电脑视图）。
  - `backendAvailable: boolean`：是否检测到 Supabase 后端可用。
  - `initializing: boolean`：是否仍在初始化（加载项目列表）。
- 初始化逻辑：
  - 默认根据窗口宽度选择手机视图或电脑视图。
  - 调用 `supabaseBackendAvailable()`：
    - 若环境变量缺失，则使用 `INITIAL_MOCK_PROJECTS` 与 `INITIAL_MOCK_DATA`。
    - 若已配置 Supabase，则调用 `listProjects()` 从 Postgres 加载项目列表。
  - 首次加载失败（网络/权限等）时，自动回退到本地示例数据。

页面级组件：

- `HomePage`：项目列表视图（展示项目基本信息、状态、操作按钮）。
- `NewProjectPage`：新建项目表单（名称、地址、项目类型等）。
- `ReportEditor`：报告主编辑界面，内部再拆分为多个模块标签页：
  - 厂区概况（`PlantOverview.tsx`）
  - 建筑屋面（`BuildingRoofs.tsx`）
  - 屋顶卫星图（`RoofSatelliteMap.tsx`）
  - 电气设施（`ElectricalFacilities.tsx`）
  - 资料收集清单（`DocumentCollection.tsx`）

### 2.2 表单与枚举配置

`services/formConfigs.ts` 是表单配置的唯一真源，负责：

- 定义各类枚举（屋顶类型、污染程度、用电时段、并网模式、资料收集状态等）。
- 定义各模块的 section 与字段：
  - 字段类型：文本、数字、单选、多选 chips、图片、textarea 等。
  - 是否必填、占位提示、枚举 key 等。

所有编辑组件只关心“配置 + 当前 `ReportData`”，从而降低硬编码耦合，方便在后续项目中复用这一套“配置驱动的动态表单”模式。

### 2.3 图片与报告生成

前端对图片的处理分两层：

- 表单层面：通过 `ImageUploadCard` 等组件接收图片，通常先存为 data:URL（Base64）。
- 存储层面：在调用 Supabase 后端保存时，统一将 data:URL 转为 blob 上传至 Storage，并用公开 URL 回写到 `ReportData`。

报告生成：

- 在 `ReportEditor` 中基于当前 `ReportData` 生成报告视图，使用 Tailwind 风格类名进行排版。
- 通过弹窗（`GeneratedReportModal`）提供预览、打印、导出 PDF（浏览器自带“打印为 PDF”）能力。

---

## 三、Supabase 后端结构

### 3.1 数据库表：`public.projects`

参考 `docs/Supabase部署快速手册.md` 与 `docs/后端迁移Supabase与图片存储优化过程.md`，核心表结构为：

```sql
create table public.projects (
  id text primary key,
  name text not null,
  location text not null,
  status text not null,
  survey_date date,
  surveyors text,
  project_type text,
  report_data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

要点：

- `report_data` 使用 `jsonb`，存完整的 `ReportData`（图片字段已替换为 URL）。
- 通过 `status`、`updated_at` 等字段建立索引以支持常用查询。
- 初期为简化调试可关闭 RLS，正式环境建议按项目/用户设计更细粒度的 RLS 策略。

### 3.2 Storage：`project-images` bucket

- 所有图片统一存放在 `project-images` bucket 中。
- 路径命名规则（简化表达）：
  - `projectId/模块-字段-序号/文件名.ext`
  - 例如：
    - `TK-2025-001/roof-roofA-birdView/xxx.png`
    - `TK-2025-001/plantOverview-overviewPhotos-0/yyy.jpg`
- 前端通过 `supabase.storage.from(IMAGE_BUCKET).upload(...)` 上传，随后调用 `getPublicUrl` 获取公开 URL。

权限策略：

- 开发/测试阶段可以使用一条“全开放”的策略：

  ```sql
  create policy "public all access storage"
  on storage.objects
  for all
  to public
  using (true)
  with check (true);
  ```

- 上线后建议：
  - 改为只针对特定 bucket；
  - 并结合 Supabase Auth 或 Edge Function 实现更严格控制。

### 3.3 Supabase 客户端封装

`services/supabaseClient.ts`：

- 从 Vite 环境变量读取配置：
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- 暴露：
  - `isSupabaseConfigured`：当前环境是否已配置 Supabase。
  - `getSupabaseClient()`：返回已初始化的 Supabase 客户端，未配置时抛出明确错误。

这一层封装是可复用的模式：在其他项目中只需复制该文件并同步环境变量命名即可。

### 3.4 项目与报告 API 封装

`services/projectApi.ts` 对 Supabase 操作进行了领域化封装：

- 图片上传与 `ReportData` 准备：
  - `prepareReportDataWithUploadedImages(projectId, data)`：
    - 深拷贝一份 `ReportData`；
    - 遍历所有图片字段：
      - 若字段值是 data:URL，则上传到 Storage，替换为公共 URL；
      - 若已是 URL，则保持不变；
    - 返回“图片已全部变为 URL”的新 `ReportData`。
- 项目列表与详情：
  - `listProjects()`：从 `projects` 表读取项目列表（不含 `report_data`）。
  - `getProjectWithReport(id)`：读取单个项目，包含完整 `report_data`。
- 创建/保存：
  - `createProjectWithReport(project, reportData)`：
    - 调用 `prepareReportDataWithUploadedImages`；
    - 插入一条新记录。
  - `saveProjectWithReport(project, reportData)`：
    - 调用 `prepareReportDataWithUploadedImages`；
    - 使用 `upsert` 按 `id` 更新整条记录，并刷新 `updated_at`。
- 状态更新与删除：
  - `updateProjectStatusRemote(projectId, status)`：只更新状态与 `updated_at`。
  - `deleteProjectRemote(projectId)`：删除项目及其报告。

App 中的使用方式：

- 初始化列表：`listProjects()`。
- 打开项目：`getProjectWithReport(id)`。
- 新建项目：`createProjectWithReport(...)`。
- 保存报告：`saveProjectWithReport(...)`。
- 更新状态 / 删除：分别调用对应的 Supabase API 封装。

---

## 四、运行环境与部署流程

### 4.1 本地开发

1. 克隆仓库后安装依赖：
   ```bash
   npm install
   ```
2. 在根目录创建 `.env.local`：
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   ```
3. 启动开发服务器：
   ```bash
   npm run dev
   ```
4. 若未配置 Supabase 环境变量：
   - 前端会自动使用本地示例数据；
   - 所有更改仅保存在浏览器运行时内存中（刷新即丢失）。

### 4.2 Cloudflare Pages 部署

1. 在 Cloudflare Pages 创建项目并绑定本仓库。
2. 配置构建：
   - 构建命令：`npm run build`
   - 构建输出目录：`dist`
3. 在 Pages 环境变量中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 部署完成后即得到一个公开的 SPA 站点 URL。

Supabase 端的初始化（建表、创建 bucket、权限策略等）详见：

- `docs/Supabase部署快速手册.md`
- `docs/后端迁移Supabase与图片存储优化过程.md`

---

## 五、可复用的 Cloudflare + Supabase 架构模式

下面是一套可以在其他项目中直接套用的通用步骤。

### 5.1 架构模式抽象

1. 前端：
   - 使用 React/Vue/Svelte 等任一前端框架构建 SPA；
   - 通过 Vite/Next 等工具打包；
   - 部署到 Cloudflare Pages（或其他静态托管平台）。
2. 后端：
   - 不自建服务，直接使用 Supabase：
     - Postgres 存结构化数据；
     - Storage 存图片/文件；
     - 可选 Auth / Edge Functions 做认证与复杂逻辑。
3. 通信：
   - 前端直接使用 `@supabase/supabase-js` 访问 Supabase；
   - 如后续需要更复杂的网关或缓存，再考虑增加 Cloudflare Worker 作 BFF。

### 5.2 在新项目中落地的最低步骤

以本项目为模板，新项目可以按如下步骤搭建：

1. 在 Supabase 创建新项目：
   - 建立业务相关的数据表（参考本项目的 `public.projects`）。
   - 创建 Storage bucket（如 `project-images`、`attachments` 等）。
   - 初始化必要的 RLS 策略（开发阶段可先简单开放，后续再收紧）。
2. 在前端项目中拷贝/复用以下模式：
   - `supabaseClient.ts`：统一封装 Supabase 客户端与配置检测。
   - 某个 `xxxApi.ts`：按业务抽象 CRUD 与文件上传逻辑。
   - 在 App 入口处：
     - 根据 `isSupabaseConfigured` 决定使用“真实后端”还是“本地 mock 数据”。
3. 在 Cloudflare Pages 配置：
   - 构建命令与输出目录；
   - `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 环境变量。
4. 若有图片/附件：
   - 统一在 API 层实现“data:URL → Storage 上传 → URL 回写”的逻辑；
   - 页面层只关心“拿到一个字符串 URL 就能展示图片”，不关心存储细节。

### 5.3 与本项目的差异化扩展

在其他项目中复用这套模式时，可以：

- 替换领域模型：
  - 本项目使用 `Project` + `ReportData`，新项目可以改为其他实体；
  - 保持“前端对象结构 ≈ Postgres JSONB 字段结构”的思路。
- 加入 Auth 与 RLS：
  - 使用 Supabase Auth 绑定用户；
  - 在表上开启 RLS，通过策略保证“用户只能访问自己的数据”。
- 增加 Edge Functions 或 Worker：
  - 某些需要服务端计算的逻辑可以放在 Supabase Edge Functions；
  - 或在 Cloudflare Worker 中做额外的聚合/缓存。

---

## 六、历史后端模式（Cloudflare Worker / NAS）的作用

虽然当前推荐并默认使用 Supabase 方案，但仓库中保留了两套历史/备选后端实现：

- Cloudflare Workers + D1：
  - 位置：`backend/src/worker.ts`、`backend/schema.sql`、`backend/wrangler.toml`。
  - 在需要完全依赖 Cloudflare 生态（不使用 Supabase）时可以启用。
- Node.js + Express + SQLite（NAS）：
  - 位置：`server/index.cjs`。
  - 适合在家用 NAS 或自管服务器上部署本地化后端。

在新项目中，如果某些场景不方便使用 Supabase，也可以参考这些实现将 `/api/projects` 替换为自建 API 服务；前端调用方式基本不变。

---

## 七、小结

- 当前推荐的「Cloudflare Pages + Supabase」模式可以概括为：
  - Cloudflare Pages：负责前端 SPA 的构建与托管。
  - Supabase Postgres：存储业务数据（JSONB/结构化字段）。
  - Supabase Storage：存储所有图片与附件，数据库中仅保存 URL。
  - 前端通过 `@supabase/supabase-js` 直接访问，无需自建 API 网关。
- 本项目已经提供了一套完整的实现示例：
  - 前端表单/报告编辑架构；
  - 数据模型与枚举配置；
  - Supabase 集成与图片上传流程；
  - Cloudflare Pages 与 Supabase 的部署与联调文档。

在未来的新项目中，可以以本仓库为“蓝本”，复用上述模式，只更换业务域模型和具体字段，即可快速搭建一套稳定的「Cloudflare + Supabase」应用架构。
