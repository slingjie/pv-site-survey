# 用户登录与权限系统 PRD

> 创建日期：2026-02-19
> 最后修订：2026-02-19（v4）
> 状态：待审阅

## 1. 背景与目标

当前系统完全无认证，任何人访问部署 URL 都能 CRUD 所有项目数据。需要新增用户认证和数据隔离能力。

### 核心目标
- 用户通过邮箱 OTP 验证码登录（Cloudflare Access 提供）
- 普通用户只能看到和操作自己的项目
- 管理员可查看所有用户的项目（只读）
- 新用户需管理员在 Cloudflare Dashboard 中审批（添加邮箱到 Access Policy）

## 2. 技术选型

### 最终方案：Cloudflare Access + D1 角色管理

| 组件 | 职责 |
|------|------|
| Cloudflare Access | 认证（邮箱 OTP 登录）、会话管理、新用户审批 |
| D1 users 表 | 角色管理（user/admin）、用户信息存储 |
| 现有 catch-all handler | 鉴权中间件、数据隔离查询 |

### 选型理由

对比了三个方案后选择此方案：

1. **Cloudflare Access + D1**（✅ 选定）— 无需密码管理和 JWT 签发，登录页由 CF 提供，邮箱 OTP 体验好
2. **自建 JWT 认证** — 需自己实现密码哈希、JWT 签发验证，代码量更大
3. **better-auth 库** — 需引入 Drizzle/Kysely + Hono，与现有架构冲突，过度设计

### 前置条件
- 自定义域名 `shilingjie.xyz` 已绑定到 Pages 项目
- Cloudflare Zero Trust 免费版（50 用户上限）

## 3. 认证流程

```
用户访问 shilingjie.xyz
  → Cloudflare Access 拦截，弹出登录页
  → 用户输入邮箱，收到 OTP 验证码
  → 验证通过，CF Access 设置 JWT cookie（CF_Authorization）
  → 请求到达 Pages Functions
  → 后端使用 @cloudflare/pages-plugin-cloudflare-access 校验 JWT 签名（验证 AUD + team domain）
  → 校验通过后，从 JWT payload 中提取 email（不信任裸 header）
  → 查 D1 users 表获取角色
  → 根据角色做数据隔离
```

### 认证信任边界（安全关键）

**原则：绝不信任裸 header，必须校验 JWT 签名。**

- `Cf-Access-Authenticated-User-Email` header 可被伪造（如通过 `*.pages.dev` 等未受 Access 保护的入口）
- 后端必须从 `CF_Authorization` cookie 中提取 JWT，使用 `CF_ACCESS_AUD` 验证签名后，从 `payload.email` 获取邮箱
- 使用 `@cloudflare/pages-plugin-cloudflare-access` 插件自动完成 JWT 校验
- JWT 校验失败 → 直接返回 403，不进入业务逻辑

**验收标准：**
- [ ] 所有 API 路由（除 OPTIONS）必须经过 JWT 校验
- [ ] 伪造 `Cf-Access-Authenticated-User-Email` header 但无有效 JWT cookie → 返回 403
- [ ] 通过 `*.pages.dev` 域名访问 API → 返回 403（无 CF Access JWT）

### 用户角色

| 角色 | 说明 |
|------|------|
| `admin` | 通过环境变量 `ADMIN_EMAIL` 指定。可查看所有用户的项目（只读），可编辑/删除自己的项目 |
| `user` | 其他所有用户。只能查看、编辑、删除自己的项目 |

### 初始管理员机制（安全关键）

**不再使用"首个用户自动 admin"策略**，改为配置化 bootstrap：

- 环境变量 `ADMIN_EMAIL` 指定管理员邮箱（支持逗号分隔多个）
- 邮箱比对规范：入库和比较前统一 `trim().toLowerCase()`，避免大小写和空格导致匹配失败
- 用户首次登录时，`getOrCreateUser()` 检查邮箱是否在 `ADMIN_EMAIL` 列表中：
  - 匹配 → `role = 'admin'`
  - 不匹配 → `role = 'user'`
- 后续如需新增管理员，修改环境变量并在 D1 中 UPDATE 对应用户的 role

**`ADMIN_EMAIL` 缺失时的行为：**
- 若 `ADMIN_EMAIL` 为空或未配置，所有新用户均为 `role = 'user'`
- 系统正常运行，但无人拥有 admin 权限（无法查看他人项目）
- 后端在 `ADMIN_EMAIL` 未配置时，每次请求在 console 输出一条 warning：`[AUTH] ADMIN_EMAIL not configured, no admin users will be created`
- 管理员可随时通过设置 `ADMIN_EMAIL` + D1 SQL `UPDATE users SET role='admin' WHERE email=?` 来补救

**验收标准：**
- [ ] `ADMIN_EMAIL` 中的邮箱首次登录后 role 为 admin
- [ ] 非 `ADMIN_EMAIL` 的邮箱首次登录后 role 为 user
- [ ] 多个用户同时首次登录不会产生多个意外 admin

### 新用户审批流程

1. 管理员在 Cloudflare Zero Trust Dashboard → Access → Applications → Policy 中添加允许的邮箱
2. 被添加的邮箱即可通过 OTP 登录
3. 首次登录时后端自动在 D1 users 表中创建记录

## 4. 数据库变更

### 4.1 新增 users 表

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  created_at TEXT DEFAULT (datetime('now'))
)
```

### 4.2 修改 projects 表

为已有 projects 表新增 `user_id` 列和索引：

```sql
ALTER TABLE projects ADD COLUMN user_id TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
```

> 用 try/catch 包裹 ALTER TABLE，列已存在时忽略错误。

### 4.3 存量数据迁移策略

**问题：** 已有项目的 `user_id` 为空字符串，需要明确归属。

**策略：** 使用 D1 `migrations` 标记表，确保迁移只执行一次且不依赖特定触发条件。

1. 新增 `migrations` 表：
```sql
CREATE TABLE IF NOT EXISTS migrations (
  key TEXT PRIMARY KEY,
  executed_at TEXT DEFAULT (datetime('now'))
)
```
2. 在 `ensureTable()` 中检查 migration key `backfill_user_id` 是否已执行
3. 若未执行，查找第一个 admin 用户（`SELECT id FROM users WHERE role='admin' LIMIT 1`）
4. 若存在 admin，执行 `UPDATE projects SET user_id = ? WHERE user_id = ''`，然后插入 migration 记录
5. 若不存在 admin（`ADMIN_EMAIL` 未配置或 admin 尚未登录），跳过，下次请求再检查

**优势：**
- 不依赖"admin 且新创建"这一窄条件
- admin 记录无论是自动创建还是手工导入，都能触发迁移
- migration 标记表可复用于后续其他迁移

**验收标准：**
- [ ] 部署后存量项目的 user_id 不再为空字符串
- [ ] 存量项目归属到首个 admin
- [ ] admin 记录已存在（预置/手工导入）时迁移也能触发
- [ ] 迁移只执行一次（幂等）
- [ ] 迁移后 `WHERE user_id = ?` 查询可命中索引

## 5. API 变更

### 5.1 新增接口

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/auth/me` | 返回当前登录用户信息（id, email, role） |

### 5.2 现有接口变更

所有 `/api/projects*`、`/api/upload`、`/api/images/*` 接口新增认证逻辑：

- 使用 `@cloudflare/pages-plugin-cloudflare-access` 校验 JWT 签名
- JWT 校验失败 → 返回 403
- 校验通过后从 JWT payload 提取 email
- 查 D1 users 表获取用户（不存在则自动创建）

### 5.3 统一错误码与前端行为映射

> `@cloudflare/pages-plugin-cloudflare-access` 插件在 JWT 校验失败时返回 403（纯文本，无 JSON body）。业务层错误统一返回 JSON body 带 `code` 字段。

**错误响应格式：**

```typescript
// 插件层（JWT 校验失败）：返回纯 403，无 body
// 业务层：返回 JSON
{ "code": "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND", "message": "..." }
```

| HTTP 状态码 | code 字段 | 触发场景 | 前端行为 |
|-------------|-----------|----------|----------|
| 403 | （无 JSON body） | JWT 校验失败（插件层拦截） | 跳转 CF Access 登录页（`window.location.reload()`） |
| 403 | `AUTH_REQUIRED` | JWT 有效但用户记录异常 | 跳转 CF Access 登录页 |
| 403 | `FORBIDDEN` | JWT 有效但无权访问该资源 | 显示"无权限"提示，不跳转 |
| 404 | `NOT_FOUND` | 项目/图片不存在 | 显示"未找到"提示 |

**前端判别逻辑：**
```
response.status === 403
  → 尝试 response.json()
    → 成功且 code === 'FORBIDDEN' → 显示"无权限"
    → 成功且 code === 'AUTH_REQUIRED' → reload 触发 CF Access
    → 失败（非 JSON，插件层拦截） → reload 触发 CF Access
```

**403 细分场景：**
- JWT 校验失败（插件层）→ 403（无 body）
- 普通用户访问他人项目 → 403 `FORBIDDEN`
- 普通用户修改/删除他人项目 → 403 `FORBIDDEN`
- 管理员修改/删除他人项目 → 403 `FORBIDDEN`
- 普通用户上传到他人项目 → 403 `FORBIDDEN`
- 普通用户访问他人项目图片 → 403 `FORBIDDEN`

数据隔离规则：

| 接口 | 普通用户 | 管理员 |
|------|----------|--------|
| GET /api/projects | 只返回自己的项目 | 返回所有项目 |
| POST /api/projects | 创建时写入自己的 user_id | 创建时写入自己的 user_id |
| GET /api/projects/:id | 只能查看自己的项目 | 可查看任何项目 |
| PUT /api/projects/:id | 只能修改自己的项目 | 只能修改自己的项目 |
| DELETE /api/projects/:id | 只能删除自己的项目 | 只能删除自己的项目 |
| POST /api/upload | 只能上传到自己的项目 | 只能上传到自己的项目 |
| GET /api/images/* | 只能访问自己项目的图片 | 可访问任何图片 |

### 5.4 上传与图片访问隔离策略（安全关键）

**上传隔离：**
- `POST /api/upload` 接收 `projectId` 参数时，必须校验该项目属于当前用户
- 非本人项目 → 返回 403
- R2 存储 key 格式不变：`{projectId}/{fieldKey}/{timestamp}-{random}.{ext}`
- 由于 projectId 已与 user_id 绑定，key 命名空间天然按用户隔离

**图片访问隔离：**
- `GET /api/images/*` 从 key 中解析 projectId（第一段路径）
- 查 D1 确认该项目属于当前用户，或当前用户为 admin
- 非本人项目且非 admin → 返回 403

**验收标准：**
- [ ] 用户 A 无法通过 `/api/upload` 向用户 B 的项目上传文件
- [ ] 用户 A 无法通过 `/api/images/*` 访问用户 B 项目的图片
- [ ] admin 可访问任何项目的图片（只读）

## 6. 前端变更

### 6.1 新增类型 — `src/types.ts`

```typescript
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}
```

### 6.2 新增认证服务 — `src/services/authApi.ts`

- `fetchCurrentUser(): Promise<User>` → 调用 `GET /api/auth/me`
- `logout()` → 跳转到 CF Access logout URL（`<team-domain>/cdn-cgi/access/logout`）

### 6.3 修改 `src/services/projectApi.ts`

所有 fetch 请求添加 `credentials: 'include'`，确保 CF Access 的 JWT cookie 被发送。

### 6.4 修改 `src/App.tsx`

- 启动时调用 `fetchCurrentUser()` 获取用户信息
- 所有 403 响应统一按 JSON `code` 字段分流（与 5.3 一致）：
  - 非 JSON 响应（插件层拦截）→ 未认证，`window.location.reload()` 触发 CF Access 登录
  - `code === 'AUTH_REQUIRED'` → 未认证，`window.location.reload()`
  - `code === 'FORBIDDEN'` → 显示"无权限"提示，不跳转
- 已认证 → 显示主界面
- 顶部显示当前邮箱 + 角色标识 + 退出按钮

## 7. 实现步骤

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 1 | Cloudflare Dashboard 配置（手动） | — |
| 2 | 安装 `@cloudflare/pages-plugin-cloudflare-access` | package.json |
| 3 | 数据库变更：新增 users 表 + projects 加 user_id 列 | `functions/api/[[route]].ts` |
| 4 | 后端认证逻辑：提取邮箱、自动创建用户、数据隔离 | `functions/api/[[route]].ts` |
| 5 | 新增 User 类型 | `src/types.ts` |
| 6 | 新增认证服务 | `src/services/authApi.ts`（新建） |
| 7 | 修改 API 调用加 credentials | `src/services/projectApi.ts` |
| 8 | 修改 App 加登录状态判断 | `src/App.tsx` |
| 9 | 更新 wrangler 配置说明 | `wrangler.example.toml` |

## 8. Cloudflare Dashboard 配置指南

### 8.1 绑定自定义域名

1. Pages 项目 → Custom domains → Add domain → `shilingjie.xyz`
2. 按提示配置 DNS CNAME 记录

### 8.2 配置 Zero Trust Access

1. Cloudflare Dashboard → Zero Trust → Access → Applications
2. Add application → Self-hosted
3. Application name: `踏勘报告工具`
4. Application domain: `shilingjie.xyz`
5. Session duration: `7 days`
6. 记录 Application AUD tag

### 8.3 配置 Access Policy

1. Policy name: `允许的用户`
2. Action: Allow
3. Include → Emails → 添加允许的邮箱地址
4. Authentication → One-time PIN

## 9. 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `CF_ACCESS_TEAM_DOMAIN` | Zero Trust team domain | `your-team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Application AUD tag | `abc123...` |
| `ADMIN_EMAIL` | 管理员邮箱（逗号分隔多个） | `admin@example.com` |

> 本地开发时在 `.dev.vars` 中配置，生产环境在 Cloudflare Dashboard 中设置。

## 10. 验证方式

### 10.1 部署验证流程

1. 绑定自定义域名 `shilingjie.xyz` 到 Pages 项目
2. 配置 Cloudflare Access Application + Policy
3. 设置环境变量 `ADMIN_EMAIL`
4. `npm run deploy` 部署
5. 按下方验收用例逐项验证

### 10.2 API 级验收用例

> 假设：用户 A（admin@example.com，admin），用户 B（user@example.com，user），用户 A 创建了项目 P1，用户 B 创建了项目 P2

| # | 场景 | 请求 | 期望状态码 | 期望响应 |
|---|------|------|-----------|----------|
| 1 | 无 JWT cookie 访问 API | `GET /api/projects`（无 cookie） | 403 | 拒绝访问（未认证） |
| 2 | 伪造 header 无 JWT | `GET /api/projects`（伪造 `Cf-Access-Authenticated-User-Email` header，无 JWT cookie） | 403 | 拒绝访问（JWT 校验失败） |
| 3 | 通过 *.pages.dev 访问 | `GET /api/projects`（via tk-report.pages.dev） | 403 | 拒绝访问（无 CF Access JWT） |
| 4 | admin 获取自身信息 | 用户 A: `GET /api/auth/me` | 200 | `{ email, role: "admin" }` |
| 5 | user 获取自身信息 | 用户 B: `GET /api/auth/me` | 200 | `{ email, role: "user" }` |
| 6 | admin 查看项目列表 | 用户 A: `GET /api/projects` | 200 | 返回 P1 + P2（所有项目） |
| 7 | user 查看项目列表 | 用户 B: `GET /api/projects` | 200 | 仅返回 P2 |
| 8 | user 查看他人项目详情 | 用户 B: `GET /api/projects/{P1.id}` | 403 | 无权限 |
| 9 | admin 查看他人项目详情 | 用户 A: `GET /api/projects/{P2.id}` | 200 | 返回 P2 详情 |
| 10 | user 修改自己项目 | 用户 B: `PUT /api/projects/{P2.id}` | 204 | 成功 |
| 11 | user 修改他人项目 | 用户 B: `PUT /api/projects/{P1.id}` | 403 | 无权限 |
| 12 | admin 修改他人项目 | 用户 A: `PUT /api/projects/{P2.id}` | 403 | 无权限（admin 对他人只读） |
| 13 | user 删除他人项目 | 用户 B: `DELETE /api/projects/{P1.id}` | 403 | 无权限 |
| 14 | admin 删除他人项目 | 用户 A: `DELETE /api/projects/{P2.id}` | 403 | 无权限（admin 对他人只读） |
| 15 | user 上传到他人项目 | 用户 B: `POST /api/upload`（projectId=P1.id） | 403 | 无权限 |
| 16 | user 访问他人项目图片 | 用户 B: `GET /api/images/{P1.id}/...` | 403 | 无权限 |
| 17 | admin 访问他人项目图片 | 用户 A: `GET /api/images/{P2.id}/...` | 200 | 返回图片 |
| 18 | ADMIN_EMAIL 用户首次登录 | admin@example.com 首次登录 | — | users 表 role='admin' |
| 19 | 非 ADMIN_EMAIL 用户首次登录 | user@example.com 首次登录 | — | users 表 role='user' |
| 20 | 存量数据迁移 | 存在 admin 用户后，迁移任务首次成功执行 | — | 所有 user_id='' 的项目归属到该 admin，migrations 表记录 `backfill_user_id` |

## 11. 后续可扩展

- 更换域名：只需在 CF Dashboard 更新 Access Application 的域名配置
- 应用内审批：后续可在 D1 users 表加 status 字段，实现应用内二次审批
- 迁移到自建认证：后端改为验证自签 JWT 而非 CF Access header
- 用户管理界面：管理员查看用户列表、修改角色等

## 12. 讨论记录

| 问题 | 决定 |
|------|------|
| 管理员创建方式 | 环境变量 `ADMIN_EMAIL` 配置化指定（v2 修订，原方案"首个用户自动 admin"存在并发风险） |
| 管理员对他人项目权限 | 只读查看 |
| MVP 用户管理界面 | 不需要 |
| 注册审批方式 | CF Dashboard 添加邮箱 |
| 登录状态保持 | CF Access session 7天 |
| 登录方式 | Cloudflare Access 邮箱 OTP |
| 自定义域名 | shilingjie.xyz（后续可更换） |
| 认证信任边界 | 必须校验 JWT 签名，不信任裸 header（v2 修订） |
| 上传/图片隔离 | 校验 projectId 归属，非本人项目返回 403（v2 修订） |
| 存量数据迁移 | 存在 admin 后由 migration key（`backfill_user_id`）一次性回填 user_id + 建索引（v3 修订） |
| 错误码语义 | 统一 403 + JSON body `code` 字段（`AUTH_REQUIRED` / `FORBIDDEN`），前端按 code 分流（v3 修订） |
