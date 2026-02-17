# 勘探报告工具

一个用于创建和管理现场勘探/踏勘报告的 Web 应用，偏重移动端使用体验，支持通过 **Supabase（Postgres + Storage）**、Cloudflare Workers + D1 或 NAS 自建后端 持久化项目与报告数据（当前推荐 Supabase 方案）。  
用户可以围绕单个项目，系统化记录厂区概况、建筑屋面、电气设施以及资料收集情况，并在浏览器本地生成可打印/导出的报告。

> 初始工程来源于 AI Studio 模板，现已整理成本地可直接运行的 Vite + React 项目。

## 功能概览

- **项目管理**
  - 首页展示项目列表（项目名称、所在地区、状态：踏勘中/已完成）
  - 支持新建踏勘项目（项目名称 + 所在地区）
  - 可在任意时间重新打开项目继续编辑报告

- **报告编辑器（ReportEditor）**
  - 按模块拆分踏勘信息：  
    - 厂区概况（地址、地理坐标、鸟瞰/卫星图、交通、风险区域、用电与产权信息等）  
    - 建筑屋面（单个或多个屋顶的面积、类型、朝向、遮挡/污染情况、结构与异常等）  
    - 电气设施（配电房现场照片、分项设备、进线与计量电压、并网方案、敷设方式等）  
    - 资料收集清单（厂区/厂房图纸、资质/产权证照、用电资料是否齐全等）
  - 大量字段采用枚举/标签方式录入，减少自由文本带来的标准化问题
  - 支持图片上传预览（屋面鸟瞰图、卫星图、配电房照片等）

- **报告生成与导出**
  - 基于当前表单数据在本地生成一份结构化的 HTML 勘探报告
  - 报告可在弹窗中预览、打印，或通过浏览器“打印为 PDF”导出
  - 一键复制底层 `ReportData` 的 JSON 数据，便于后续对接后端/大模型处理

- **移动端优先与视图切换**
  - 默认使用“手机视图”布局，适配踏勘现场在手机上操作的场景
  - 右下角浮动按钮支持在“手机视图”和“电脑视图”之间切换，便于在大屏上集中编辑

- **内置示例数据**
  - 通过 `services/mockData.ts` 提供多个示例项目及对应报告数据
  - 便于快速体验各模块填写效果和报告生成效果

## 技术栈

- **前端框架**：React 19（函数式组件 + Hooks）
- **语言**：TypeScript
- **构建工具**：Vite
- **UI 风格**：以 Tailwind 风格的原子类名为主（例如 `bg-gray-50`、`rounded-full` 等），可接入 TailwindCSS 或自行定义样式
- **后端（推荐方案）**：Supabase Postgres + Storage（前端直接通过 Supabase JS SDK 访问，无需自建服务器）
- **后端（方案二）**：Cloudflare Workers + D1（见 `backend/` 目录）
- **后端（方案三）**：自建 Node.js + SQLite 服务（见 `server/` 目录，可部署到家用 NAS）

## 目录结构

```text
.
├─ App.tsx                # 入口组件，路由/视图切换与顶层状态管理
├─ index.html             # Vite 入口 HTML 模板
├─ index.tsx              # React 挂载入口
├─ types.ts               # 核心类型定义（Project、ReportData 等）
├─ metadata.json          # 应用元数据（名称、描述、权限等）
├─ vite.config.ts         # Vite 配置
├─ tsconfig.json          # TypeScript 配置
├─ .env.local             # 环境变量（当前包含 GEMINI_API_KEY 占位）
├─ components
│  ├─ icons.tsx           # 通用图标组件集合
│  ├─ common              # 通用基础组件
│  │  ├─ FormField.tsx
│  │  ├─ TextInput.tsx
│  │  ├─ TextArea.tsx
│  │  ├─ RadioGroup.tsx
│  │  ├─ Chip.tsx
│  │  ├─ PickerField.tsx
│  │  ├─ BottomSheetPicker.tsx
│  │  ├─ ImageUploadCard.tsx
│  │  ├─ ImagePreviewModal.tsx
│  │  ├─ Toast.tsx
│  │  └─ GeneratedReportModal.tsx
│  ├─ editor              # 各踏勘模块编辑页面
│  │  ├─ PlantOverview.tsx
│  │  ├─ BuildingRoofs.tsx
│  │  ├─ ElectricalFacilities.tsx
│  │  ├─ DocumentCollection.tsx
│  │  └─ RoofSatelliteMap.tsx
│  └─ views               # 页面级视图组件
│     ├─ HomePage.tsx     # 项目列表页
│     ├─ NewProjectPage.tsx  # 新建项目页
│     └─ ReportEditor.tsx    # 报告编辑器主界面
├─ services
│  ├─ formConfigs.ts      # 各模块表单字段与枚举配置
│  ├─ mockData.ts         # 初始示例数据生成方法
│  ├─ supabaseClient.ts   # Supabase 客户端封装（读取环境变量创建 client）
│  └─ projectApi.ts       # 基于 Supabase 的项目与报告 CRUD、图片上传逻辑
├─ backend
│  ├─ src/worker.ts       # Cloudflare Worker 入口与 API 路由
│  ├─ schema.sql          # D1 数据库表结构
│  ├─ wrangler.toml       # Worker 与 D1 绑定配置
│  └─ package.json        # 后端脚本（dev / deploy / migrate）
├─ docs                   # 相关说明文档/草稿（架构说明、NAS 部署、Supabase 迁移与快速部署等）
├─ dist                   # Vite 构建产物
├─ server
│  └─ index.cjs           # Node.js + Express + SQLite 自建后端入口（可在 NAS 上运行）
└─ .gitignore
```

## 本地运行

### 1. 环境准备

- 建议 Node.js 版本：**≥ 18**
- 包管理工具：npm（可根据个人习惯改为 pnpm/yarn，自行调整命令）

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量（可选）

仓库中提供了 `.env.local` 文件，包含：

```bash
GEMINI_API_KEY=PLACEHOLDER_API_KEY
```

当前代码未直接使用该 Key，可视为后续接入大模型/AI 能力时的预留配置位。  
如果你计划在本项目上扩展 AI 相关能力，可以将其替换为真实的 API Key。

### 4. 启动开发服务器

```bash
npm run dev
```

默认情况下，Vite 会在 `http://localhost:3000` 提供开发预览（通过代理把 `/api` 转发到本地后端）。  
你可以选择：

- 使用 Cloudflare Worker：在 `backend` 目录执行 `npm install`（首次）和 `npm run dev`，默认监听 `http://127.0.0.1:8787`；
- 使用本地 Node.js + SQLite 后端：在项目根目录执行 `npm run server`，默认监听 `http://0.0.0.0:8787`。

### 5. 构建与预览生产版本

```bash
# 构建
npm run build

# 预览构建产物
npm run preview
```

## 使用指南

1. 启动应用后进入 **“我的项目”** 页面，可以看到若干内置示例项目。
2. 点击右上角的 `+` 按钮可 **新建踏勘项目**，输入项目名称与所在地区后保存。
3. 在项目卡片上点击任意项目进入 **报告编辑器**：
   - 顶部可修改项目名称、所在地区；
   - Tab/导航切换不同模块，如厂区概况、屋顶、电气、资料清单等；
   - 支持上传图片、选择枚举、填写文本等。
4. 在底部点击 **“生成报告”**，将基于当前数据生成一份 HTML 报告并在弹窗中预览：
   - 可以直接打印或选择“打印为 PDF”导出；
   - 也可以点击“复制 JSON 数据”，将底层 `ReportData` 拷贝到剪贴板。
5. 点击 **“保存”** 按钮会将编辑结果保存在前端状态中，并在后端可用时同步保存到 Cloudflare D1（后端不可用时仅更新本地状态并给出提示）。

## 数据模型简要说明

核心数据结构定义在 `types.ts` 中：

- `Project`：项目列表中每个项目的基础信息（id、名称、地区、状态）。
- `ReportData`：单个项目的完整报告数据，包含：
  - `plantOverview: PlantOverviewData`：厂区概况信息；
  - `buildingRoofs: BuildingRoof[]`：一个或多个屋顶记录；
  - `electricalFacilities: ElectricalFacilitiesData`：电气设施与并网信息；
  - `documentCollection: DocumentCollectionData`：按键-状态存储的资料收集情况。

表单的枚举项和字段配置集中在 `services/formConfigs.ts` 中，便于统一维护与扩展。

## 后端 API 与持久化存储

### 方案一：Supabase（推荐）

- 数据库：使用 Supabase 提供的 Postgres，与本地 SQLite 结构对应，核心表为 `public.projects`（字段见 `backend/schema.sql` 与 `docs/后端迁移Supabase与图片存储优化过程.md`）。
- 对象存储：使用 Supabase Storage 的 `project-images` bucket 存放所有截图、照片等大体积图片，在 `report_data` 中仅保存对应 URL。
- 访问方式：前端通过 `@supabase/supabase-js` 调用，封装在：
  - `services/supabaseClient.ts`
  - `services/projectApi.ts`
- 环境变量（Vite 前缀）：
  - `VITE_SUPABASE_URL`：项目的 `Project URL`；
  - `VITE_SUPABASE_ANON_KEY`：项目的 `anon public` key。
- 部署与初始化步骤：参考
  - `docs/Supabase部署快速手册.md`（从零搭建新环境的操作说明）；
  - `docs/后端迁移Supabase与图片存储优化过程.md`（从 Worker/NAS 迁移到 Supabase 的完整记录）。

前端默认优先使用 Supabase；如果未配置上述环境变量，则自动退回到本地示例数据，仅在浏览器内存中保存，不做持久化。

### 方案二：Cloudflare Workers + D1

- Worker 入口：`backend/src/worker.ts`，通过 Cloudflare Workers 提供 `/api/projects` 系列 REST 接口。
- 数据库：`backend/schema.sql` 中定义了 `projects` 表，用于存储项目基础信息与报告数据 JSON。
- 主要接口：
  - `GET /api/projects`：获取项目列表（不含完整报告数据）。
  - `POST /api/projects`：创建项目并保存报告数据。
  - `GET /api/projects/:id`：获取项目详情及完整报告数据。
  - `PUT /api/projects/:id`：更新项目与报告数据。
  - `PATCH /api/projects/:id/status`：仅更新项目状态（踏勘中/已完成）。
  - `DELETE /api/projects/:id`：删除项目及其报告。
- CORS：Worker 默认为所有接口添加 CORS 头，并处理 `OPTIONS` 预检请求，前端可直接以浏览器 Fetch 调用。

### 方案三：自建 Node.js + SQLite 后端（适合部署到 NAS）

- 入口：`server/index.cjs`，基于 Express + SQLite，实现与 Worker 相同的 `/api/projects` 系列接口。
- 数据库：默认使用 `data/tk_report_projects.db` 文件（SQLite），启动时会自动执行 `backend/schema.sql` 初始化 `projects` 表。
- 启动示例（本地或 NAS 上）：
  ```bash
  # 安装依赖（首次）
  npm install

  # 启动后端服务（默认端口 8787）
  npm run server

  # 可选环境变量
  # PORT=8787                # 服务监听端口
  # DB_PATH=/path/to/dbfile  # 自定义数据库文件路径
  # CORS_ORIGIN=https://your-frontend-domain.com  # 限制允许访问的前端域名，多个用逗号分隔
  ```
- 主要接口与 Worker 版本完全一致：
  - `GET /api/projects`
  - `POST /api/projects`
  - `GET /api/projects/:id`
  - `PUT /api/projects/:id`
  - `PATCH /api/projects/:id/status`
  - `DELETE /api/projects/:id`
- CORS：使用 `cors` 中间件，默认允许所有来源访问；可通过 `CORS_ORIGIN` 环境变量收紧为指定域名。


## 后续扩展示例建议

- **持久化存储**：
  - 结合浏览器 `localStorage` 或接入后端接口，实现项目与报告数据的持久化。
- **与大模型结合**：
  - 利用 `ReportData` 的结构化 JSON，调用大模型生成自然语言版踏勘报告/风险分析。
  - 可复用 `.env.local` 中的 `GEMINI_API_KEY` 作为配置入口。
- **权限与协作**：
  - 增加登录与权限控制，多人协作编辑同一个项目。
- **地图与定位能力**：
  - 利用 `metadata.json` 中申请的 `geolocation` 权限，实现现场定位与屋面打点标记。

---

如需在本项目基础上二次开发或接入后端/AI 能力，建议优先从以下文件入手：`App.tsx`、`ReportEditor.tsx`、`types.ts` 与 `services/formConfigs.ts`。
