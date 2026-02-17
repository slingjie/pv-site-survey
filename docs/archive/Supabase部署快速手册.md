# 勘探报告工具 Supabase 部署快速手册（新环境从零搭建）

> 场景：在一个全新的 Supabase + Cloudflare Pages 环境，从零部署本项目的后端与图片存储能力。

---

## 1. Supabase 端初始化

### 1.1 创建项目

1. 在 Supabase 官网创建新项目（记下 `Project URL` 与 `anon public key`）。
2. 选择最近的区域，等待数据库初始化完成。

### 1.2 创建 `projects` 表

在 Supabase 控制台 → `SQL` → `New query` 中执行：

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

alter table public.projects disable row level security;
```

> 说明：先关闭 RLS 简化部署，后续如需权限控制再单独设计策略。

### 1.3 创建图片存储 bucket

1. 控制台左侧 `Storage → Buckets → New bucket`。  
2. 名称填写：`project-images`，类型建议选 `Public`。  

为避免 RLS 阻止匿名访问，在 `SQL` 中执行：

```sql
create policy "public all access storage"
on storage.objects
for all
to public
using (true)
with check (true);
```

> 后续如需加强安全，可将策略收紧为仅匹配 bucket_id = 'project-images'，或结合 Auth 做细粒度控制。

---

## 2. 前端环境变量配置

### 2.1 本地开发（`.env.local`）

在项目根目录新建或编辑 `.env.local`：

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

保存后：

```bash
npm install
npm run dev
```

确保在本地可以：

- 打开页面；
- 新建项目、上传图片、保存后刷新仍可看到图片与数据。

### 2.2 Cloudflare Pages 环境变量

1. 打开 Cloudflare 控制台 → `Workers & Pages` → 进入对应的 **Pages 项目**。  
2. 顶部选择 `设置 (Settings)` → `Build & deployments` → `Environment variables`。  
3. 在 Production（和可选的 Preview）中添加：

   - `VITE_SUPABASE_URL = https://<your-project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY = <your-anon-public-key>`

4. 保存后重新触发部署（或等待下一次构建）。

---

## 3. 构建与部署前端

### 3.1 本地构建检查

```bash
npm run build
```

确认构建成功，无 TypeScript / 打包错误。

### 3.2 Pages 绑定仓库并自动构建

若尚未创建 Pages 项目：

1. 在 Cloudflare Pages 中创建新项目，绑定本仓库。  
2. 构建命令：`npm run build`  
3. 构建输出目录：`dist`  

首次构建成功后，会生成形如 `https://xxx.pages.dev` 的访问地址。

---

## 4. 验证流程

部署完成后，在线上站点按以下步骤自测：

1. 打开 `https://<your-pages-domain>.pages.dev`。  
2. 新建项目（填写名称、地址、日期等），进入编辑页面。  
3. 在“厂区概况 / 屋面 / 电气设施”等模块上传多张图片，保存并返回首页。  
4. 刷新页面，再次进入该项目：
   - 确认文字信息与图片均存在。  
5. 在 Supabase 控制台中：
   - `public.projects` 表能看到新记录，`report_data` 中图片字段为 URL；  
   - `Storage → project-images` bucket 中存在对应图片文件。

若出现错误：

- 403 或提示 `row-level security policy`：检查 `projects` 表是否已关闭 RLS，`storage.objects` 是否存在允许 public 访问的策略。
- 400 + `Bad Request`：通常为 Storage 策略或 bucket 名不匹配，确认 bucket 名为 `project-images` 且策略生效。

---

## 5. 后续可选加强项

上线后，如需提升安全与可维护性，可考虑：

- 引入 Supabase Auth，将项目与用户绑定，并重新启用 RLS；
- 收紧 Storage 访问策略，仅允许访问 `project-images` 且按用户隔离路径；
- 在前端增加图片压缩、上传进度与错误重试机制。

以上步骤执行完毕，即可在一个全新的 Supabase + Cloudflare Pages 环境中完整运行本项目。 

