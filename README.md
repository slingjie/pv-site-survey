# 勘探报告工具 (PV Site Survey Tool)

移动优先的光伏/储能项目现场踏勘报告工具。支持系统化记录厂区概况、建筑屋顶、电气设施和资料收集，并在本地生成可打印的 HTML 报告。

**线上地址**：自行部署后生成。

## 功能特性

- **项目管理** — 创建、编辑、删除踏勘项目，支持按名称/地点搜索、按状态/类型筛选
- **踏勘报告** — 四大模块：厂区概况、建筑屋顶、电气设施、资料收集
- **图片上传** — 现场拍照或选择图片，自动上传至云端存储
- **用户权限** — Cloudflare Access 认证，管理员可查看所有用户项目并按用户筛选
- **PWA 离线** — Service Worker 缓存，离线可用，数据本地优先同步
- **报告生成** — 本地生成可打印 HTML 格式踏勘报告
- **多端适配** — 移动端优先设计，支持手机/电脑视图切换

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS (CDN) |
| 后端 | Cloudflare Pages Functions |
| 数据库 | Cloudflare D1 (SQLite) |
| 文件存储 | Cloudflare R2 |
| 认证 | Cloudflare Access |
| PWA | vite-plugin-pwa + Workbox |

## 项目结构

```
├── App.tsx                        # 入口组件，路由与顶层状态
├── types.ts                       # 全局类型定义
├── index.tsx                      # React 挂载入口
├── components/
│   ├── views/                     # 页面级组件
│   │   ├── HomePage.tsx           # 首页：项目列表、搜索筛选
│   │   ├── ReportEditor.tsx       # 报告编辑器（Tab 导航）
│   │   └── NewProjectPage.tsx     # 新建项目页
│   ├── editor/                    # 各踏勘模块编辑器
│   └── common/                    # 通用 UI 组件
├── services/
│   ├── projectApi.ts              # API 调用层
│   ├── authApi.ts                 # 认证相关 API
│   ├── formConfigs.ts             # 表单字段配置
│   ├── db.ts                      # 本地 IndexedDB 存储
│   └── sync.ts                    # 离线同步逻辑
├── functions/
│   └── api/[[route]].ts           # 后端 catch-all 路由处理
└── src/
    └── sw.ts                      # Service Worker
```

## 快速开始

### 环境准备

- Node.js >= 18
- Cloudflare 账号 + Wrangler CLI

### 安装与运行

```bash
# 安装依赖
npm install

# 本地开发（仅前端）
npm run dev

# 本地开发（含 Cloudflare Functions）
npm run preview:cf

# 部署到 Cloudflare Pages
npm run deploy
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/me` | 获取当前用户信息 |
| GET | `/api/projects` | 项目列表（管理员返回全部，含创建者邮箱） |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/:id` | 获取项目详情 + 报告数据 |
| PUT | `/api/projects/:id` | 更新项目/报告 |
| PATCH | `/api/projects/:id/status` | 更新项目状态 |
| DELETE | `/api/projects/:id` | 删除项目（仅项目所有者） |
| POST | `/api/upload` | 上传图片至 R2 |
| GET | `/api/images/*` | 获取图片 |

## 权限模型

- **普通用户** — 仅能查看和操作自己创建的项目
- **管理员** — 可查看所有用户项目，卡片显示创建者邮箱，支持按用户筛选；对他人项目隐藏删除按钮
- 管理员邮箱通过环境变量 `ADMIN_EMAIL` 配置（逗号分隔多个）

## 环境变量

| 变量 | 说明 |
|------|------|
| `CF_ACCESS_TEAM_DOMAIN` | Cloudflare Access 团队域名 |
| `CF_ACCESS_AUD` | Cloudflare Access Application Audience Tag |
| `ADMIN_EMAIL` | 管理员邮箱列表（逗号分隔） |

## License

MIT