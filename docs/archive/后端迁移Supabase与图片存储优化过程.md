# 勘探报告工具后端迁移 Supabase 与图片存储优化过程记录

本文档记录本项目从 Cloudflare Worker / NAS 自建后端迁移到 Supabase（Postgres + Storage），并解决“大照片无法存储”问题的全过程，便于后续回顾与复用。

---

## 一、问题背景

原有架构：

- 前端：托管在 Cloudflare Pages。
- 后端：
  - Cloudflare Worker + D1（最早版本）；
  - 后续增加了 Node.js + Express + SQLite 的 NAS 版本（`server/index.cjs`）。
- 数据结构：
  - `projects` 表保存项目基本信息；
  - `report_data` 字段保存完整 `ReportData` JSON，其中包含大量 Base64 图片。

遇到的核心问题：

- 图片以 Base64 形式直接塞进 `report_data`，导致单条记录体积过大：
  - Cloudflare Worker / D1 有单行大小与请求体限制；
  - 即便迁到 NAS，本地存储虽然没限制，但同步到云端时仍容易超限。
- 典型现象：
  - 保存时弹出提示“当前报告包含的图片过多或过大，已超出云端单条记录容量上限，无法同步到服务器。”；
  - 或后端直接报 413 / 超时等错误。

目标：

- 后端迁移至 Supabase：
  - 使用 Postgres 保存项目信息与报告结构化数据；
  - 使用 Storage 存储大体积图片，并仅在数据库中存路径 / URL。
- 前端保持托管在 Cloudflare Pages，不增加自建服务器。

---

## 二、总体方案（方案 A）

沿用“前端直连后端服务”的思路，采用：

- Supabase：
  - Postgres：`public.projects` 表；
  - Storage：`project-images` bucket；
  - 匿名访问（使用 `anon` key，先不开启复杂权限）。
- 前端：
  - 保持 React + Vite 结构不变；
  - 新增 `services/supabaseClient.ts` 和 `services/projectApi.ts`；
  - 在 `App.tsx` 中替换原有 `API_BASE + fetch` 调用为 Supabase SDK 调用；
  - 在保存报告时：
    - 将所有 Base64 图片上传到 Storage；
    - 把字段值替换为公开 URL；
    - 仅保存替换后的 JSON 到 Postgres。

优势：

- 不再需要自建 Node/Express 服务；
- 大体积图片由对象存储接管，数据库只存 URL，彻底规避“单条记录太大”问题；
- 前端仍然只是一套纯静态站点，部署和运维简单。

---

## 三、Supabase 侧配置步骤

### 3.1 创建 `projects` 表

在 Supabase SQL 编辑器中执行：

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

create index projects_status_idx on public.projects(status);
create index projects_updated_at_idx on public.projects(updated_at desc);
```

注意事项：

- `report_data` 类型为 `jsonb`，用于存完整 `ReportData`（已经将图片字段替换为 URL）。
- 初期为简化调试，将该表的 Row Level Security（RLS）关闭：
  - 在 Table Editor 中取消勾选 “Enable Row Level Security (RLS)”；
  - 或执行：`alter table public.projects disable row level security;`

### 3.2 创建图片存储 bucket

1. 在 Storage → Buckets 中创建 `project-images`（建议小写命名），类型可选 Public。
2. 为防止 RLS 阻止匿名上传，在 `storage.objects` 上创建策略：

```sql
create policy "public all access storage"
on storage.objects
for all
to public
using (true)
with check (true);
```

说明：

- 为快速打通功能，这条策略允许 public 角色对所有 bucket 读写。
- 如果后续需要加强安全，可改为只针对 `project-images`，并结合自定义授权逻辑优化。

### 3.3 配置前端可用的 Supabase 环境变量

- 在本地 `.env.local` 中配置：

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

- 在 Cloudflare Pages 中：
  - 进入具体 Pages 项目（例如 `mobile`）；
  - Settings → Build & deployments → Environment variables；
  - 为 Production（和可选的 Preview）添加同名变量：
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`

---

## 四、前端代码改造

### 4.1 新增 Supabase 客户端封装

文件：`services/supabaseClient.ts`

- 从 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 创建客户端；
- 导出：
  - `isSupabaseConfigured`：判断是否已配置环境变量；
  - `getSupabaseClient()`：在未配置时抛出明确错误。

### 4.2 新增项目与图片访问封装

文件：`services/projectApi.ts`

主要内容：

- 常量：
  - `TABLE_NAME = "projects"`;
  - `IMAGE_BUCKET = "project-images"`;
- 图片处理：
  - `isDataUrl()`：判断字符串是否为 `data:` URL；
  - `uploadImageDataUrl(projectId, fieldKey, dataUrl)`：
    - 使用 `fetch(dataUrl)` 转为 `Blob`；
    - 构造路径：`projectId/字段名/时间戳-随机.ext`；
    - 调用 `supabase.storage.from(IMAGE_BUCKET).upload(...)` 上传；
    - 使用 `getPublicUrl` 获取公开 URL。
  - `prepareReportDataWithUploadedImages(projectId, data)`：
    - 深拷贝 `ReportData`；
    - 遍历所有图片字段（厂区概况、屋面、电气设施、子设施）；
    - 对 Base64 图片调用上传方法并替换为 URL；
    - 返回“图片已替换为 URL”的新 `ReportData`。
- 数据表 CRUD：
  - `listProjects()`：查询 `projects` 表并映射为 `Project[]`；
  - `getProjectWithReport(id)`：读取单条项目 + `report_data`；
  - `createProjectWithReport(project, reportData)`：插入新项目；
  - `saveProjectWithReport(project, reportData)`：upsert 项目与报告；
  - `updateProjectStatusRemote(id, status)`：更新状态；
  - `deleteProjectRemote(id)`：删除项目；
  - `supabaseBackendAvailable()`：基于环境变量判断是否启用 Supabase。

### 4.3 替换 `App.tsx` 中的后端调用逻辑

关键改动点：

- 删除原有 `API_BASE` 与 `fetch("/api/projects...")` 的调用；
- 初始化加载：
  - 若 `supabaseBackendAvailable()` 为假，回退到本地示例数据；
  - 否则调用 `listProjects()` 拉取项目列表，并标记 `backendAvailable = true`。
- 打开项目：
  - 若本地已有完整 `projectsData[reportId]`，直接进入编辑器；
  - 若后端可用，则调用 `getProjectWithReport(reportId)`，同步项目基础信息及 `reportData`。
- 新建项目：
  - 仍使用 `getInitialMockData` 生成本地初始报告；
  - 若后端可用，调用 `createProjectWithReport(newProject, newReportData)`。
- 保存报告：
  - 先更新本地 `projectsData`、`projects`；
  - 若后端可用：
    - 构造 `updatedProject`（同步名称、地址）；
    - 调用 `saveProjectWithReport(updatedProject, updatedReportData)`：
      - 内部会自动上传所有 Base64 图片到 Storage；
      - 返回的 `savedReport` 为“图片已替换为 URL”的版本；
    - 用 `savedReport` 覆盖本地缓存，避免同一图片反复上传。
  - 去掉了原本为了规避 D1 单行限制的 payload 体积检查逻辑。
- 更新项目状态 / 删除项目：
  - 分别改为调用 `updateProjectStatusRemote` 与 `deleteProjectRemote`。

---

## 五、调试与问题排查记录

### 5.1 Supabase 表 RLS 导致的 403

错误现象：

- 创建项目时报错：

```json
{
  "code": "42501",
  "message": "new row violates row-level security policy for table \"projects\""
}
```

原因：

- `projects` 表开启了 RLS，但没有任何策略允许 `anon` 角色插入数据。

解决：

- 在表编辑界面关闭 RLS，或执行：

```sql
alter table public.projects disable row level security;
```

### 5.2 Storage 上传图片时的 400 / RLS 问题

错误现象：

- 控制台报：

```text
POST .../storage/v1/object/project-images/... 400 (Bad Request)
StorageApiError: new row violates row-level security policy
```

原因：

- 默认开启的 Storage RLS 未配置允许 public 插入 `storage.objects` 的策略。
- 早期策略使用了错误的 `bucket_id` 比较（大小写或名称不一致）。

解决过程：

1. 针对 `project-images` bucket 创建插入 / 更新策略：

```sql
create policy "public upload project images"
on storage.objects
for insert
to public
with check (bucket_id = 'project-images');

create policy "public update project images"
on storage.objects
for update
to public
using (bucket_id = 'project-images')
with check (bucket_id = 'project-images');
```

2. 为快速打通功能，追加一条全开放策略：

```sql
create policy "public all access storage"
on storage.objects
for all
to public
using (true)
with check (true);
```

3. 再次测试上传图片与保存报告，确认 400 与 RLS 错误消失，图片正确写入 `project-images`。

---

## 六、当前状态与可进一步优化方向

当前状态：

- 新建项目、上传多张大图、保存 / 返回首页等流程均可通过；
- 图片文件存储在 Supabase Storage 中，对应 URL 写入 `projects.report_data`；
- 前端无需自建后端服务，只依赖 Supabase 与 Cloudflare Pages。

可进一步优化方向（后续迭代建议）：

1. **安全性与权限**
   - 为 `projects` 和 `storage.objects` 设计更精细的 RLS 策略：
     - 例如引入 Supabase Auth，将项目与用户绑定；
     - 仅允许登录用户访问自己名下的项目与图片。
   - 若长期使用匿名访问，可考虑：
     - 将 `public all access storage` 策略收紧为仅允许 `project-images`；
     - 或通过 Edge Function 封装上传逻辑。

2. **前端体验**
   - 图片上传进度与错误提示更细化：
     - 当前为“整体失败”提示，可增加逐张失败回退与重试。
   - 本地缓存策略：
     - 对已上传并替换成 URL 的图片避免重复上传。

3. **图片体积优化**
   - 在浏览器端做图片压缩：
     - 使用 `canvas` 或相关库将原图压缩到合适分辨率与质量；
     - 降低上传耗时与存储成本。

4. **数据备份与迁移**
   - 为 `projects` 表与 `project-images` bucket 配置定期备份；
   - 设计导出 / 导入脚本，方便在不同 Supabase 项目或环境间迁移。

---

## 七、小结

通过本次迁移与调优，本项目完成了：

- 从 Cloudflare Worker / NAS Node 后端切换到 Supabase（Postgres + Storage）；
- 将大体积图片从 JSON 字段剥离，交由对象存储管理；
- 前端仅通过 Supabase SDK 访问后端，无需维护额外服务器。

后续若需要引入用户体系和权限控制，可在当前基础上补充 Supabase Auth 与更精细的 RLS 策略，实现多用户隔离与更安全的数据访问。

