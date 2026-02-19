# Web 端多用户开发方案 (PV Site Survey)

针对本项目从单机工具升级为多用户 SaaS 版踏勘平台的详细开发方案。

## 1. 核心目标
- **用户体系**：支持用户注册、登录、身份认证。
- **数据隔离**：普通用户只能操作（增删改查）自己创建的踏勘项目。
- **管理权限**：管理员 (Admin) 可查看系统中所有用户的数据，并具备统计分析能力。

## 2. 数据库架构调整 (D1 / SQLite)

### 2.1 新增用户表
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,               -- UUID
  username TEXT UNIQUE NOT NULL,     -- 登录名
  password_hash TEXT NOT NULL,       -- 密码哈希 (bcrypt)
  nickname TEXT,                     -- 显示名称
  role TEXT DEFAULT 'user',          -- 角色: 'user' | 'admin'
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2.2 修改项目表
增加 `user_id` 字段以实现归属关联。
```sql
ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
```

## 3. 后端开发逻辑 (Cloudflare Workers)

### 3.1 身份鉴权 (JWT)
- 使用 JWT (JSON Web Token) 进行状态保持。
- 登录成功后分发 Token，前端在 Header 中携带 `Authorization: Bearer <token>`。

### 3.2 接口逻辑过滤
- **查询列表**：根据用户角色动态调整 SQL。
  - 普通用户：`SELECT * FROM projects WHERE user_id = ?`
  - 管理员：`SELECT * FROM projects`
- **详情/更新/删除**：在执行操作前校验 `user_id` 匹配或角色为 `admin`。

## 4. 前端开发逻辑 (React)

### 4.1 登录与权限控制
- 新增 `LoginView.tsx` 处理登录逻辑。
- 在 `App.tsx` 中根据 Token 状态决定渲染登录页还是主页。

### 4.2 界面适配
- **管理视图**：若为 Admin，在首页列表显示项目所属人。
- **只读模式**：管理员查看他人项目时，建议默认开启只读模式，防止误改。

## 5. 开发建议
- **安全性**：敏感密钥存放在 Cloudflare 环境遍历中，严禁明文存储密码。
- **存储隔离**：在 R2 图片存储路径中加入 `user_id` 前缀，实现资源层面的隔离。