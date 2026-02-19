# 勘探报告工具 — 离线模式（PWA）方案与实施记录

## Context

勘探报告工具当前是纯在线模式，所有数据操作直接调用后端 API。用户在手机端现场勘探时经常没有网络，导致无法创建/保存项目。需要实现离线优先（local-first）架构：数据先存本地 IndexedDB，有网时自动同步到服务器。

**方案结论：PWA + IndexedDB + 同步队列 — 完美适配**
- 无需后端改动，现有 API 接口完全不变
- 前端改造为 local-first，离线可用
- Service Worker 缓存静态资源，确保离线时 App 能打开

## 方案概览

两层实现：
1. **PWA Service Worker** — 缓存静态资源（含 Tailwind CDN），确保离线时 App 能打开
2. **IndexedDB + 同步队列** — 本地存储项目数据，离线变更排队，联网后自动同步

冲突策略：Last Write Wins（时间戳）。同步粒度：项目级别。

## 目标架构

```text
用户操作（创建/编辑/删除项目）
       │
       ▼
  IndexedDB（本地持久化）
       │
       ├── 立即生效（UI 响应）
       │
       └── 入 syncQueue（同步队列）
              │
              ▼
         trySync()
              │
              ├── 在线 → 调用远程 API → 成功 → 清除队列项
              │                       → 失败 → 保留队列项
              │
              └── 离线 → 跳过
                    │
                    └── window.online 事件 → 重新消费队列
```

```text
Service Worker 缓存策略：
┌─────────────────────────┬──────────────┐
│ 资源类型                │ 策略         │
├─────────────────────────┼──────────────┤
│ 静态资源（JS/CSS/HTML） │ Precache     │
│ Tailwind CDN            │ CacheFirst   │
│ /api/images/*           │ CacheFirst   │
│ /api/* 其他接口         │ NetworkOnly  │
└─────────────────────────┴──────────────┘
```

## IndexedDB 数据模型

数据库名：`tk-report-db`，版本 1，3 个 ObjectStore：

| Store | keyPath | 说明 |
|-------|---------|------|
| `projects` | `id` | 项目元数据（Project 类型） |
| `reportData` | `projectId` | 完整 ReportData |
| `syncQueue` | `id`（autoIncrement） | 待同步操作队列 |

syncQueue 条目结构：

```ts
interface SyncQueueItem {
  id?: number;
  action: "create" | "update" | "updateStatus" | "delete";
  projectId: string;
  data?: unknown;
  timestamp: number;
}
```

## Local-first CRUD 改造

将 `services/projectApi.ts` 中的 6 个 API 函数改为 local-first 模式：

| 函数 | 改造逻辑 | 实际状态 |
|------|----------|---------|
| `listProjects` | 读 IndexedDB；若为空且在线则从远程拉取并缓存；远程失败返回空数组 | ✅ 已完成 |
| `getProjectWithReport` | 读 IndexedDB；若无则从远程拉取并缓存 | ✅ 已完成 |
| `createProjectWithReport` | 写 IndexedDB + 入队；尝试即时同步 | ✅ 已完成 |
| `saveProjectWithReport` | 写 IndexedDB + 入队；尝试即时同步 | ✅ 已完成 |
| `updateProjectStatusRemote` | 写 IndexedDB + 入队；尝试即时同步 | ✅ 已完成 |
| `deleteProjectRemote` | 删 IndexedDB + 入队；尝试即时同步 | ✅ 已完成 |

原始远程调用函数保留（加 `Remote` / `RemoteApi` 后缀），供 `sync.ts` 使用。

## 文件变更清单

### 新增文件

| 文件 | 说明 | 实际状态 |
|------|------|---------|
| `services/db.ts` | IndexedDB 封装（openDB、CRUD、同步队列操作） | ✅ 已完成 |
| `services/sync.ts` | 同步管理器（消费队列、状态订阅、online 事件监听） | ✅ 已完成 |
| `src/sw.ts` | Service Worker（Workbox precache + CDN/图片缓存路由） | ✅ 已完成 |
| `components/SyncIndicator.tsx` | 全局悬浮同步状态角标（在线/离线 + 待同步数） | ✅ 已完成 |
| `public/icon-192.png` | PWA 图标 192x192 | ✅ 已完成 |
| `public/icon-512.png` | PWA 图标 512x512 | ✅ 已完成 |

### 修改文件

| 文件 | 操作 | 实际状态 |
|------|------|---------|
| `package.json` | 添加 `vite-plugin-pwa` 到 devDependencies | ✅ 已完成 |
| `vite.config.ts` | 添加 VitePWA 插件（injectManifest 策略 + manifest 配置） | ✅ 已完成 |
| `tsconfig.json` | 添加 `vite-plugin-pwa/client` 类型声明 | ✅ 已完成 |
| `index.html` | 添加 `<meta name="theme-color">` | ✅ 已完成 |
| `index.tsx` | 使用 `virtual:pwa-register` 注册 Service Worker | ✅ 已完成 |
| `services/projectApi.ts` | 核心改造：原 CRUD 加 Remote 后缀，新增 local-first 包装层 | ✅ 已完成 |
| `App.tsx` | 引入 SyncIndicator 组件 + 初始化时触发 trySync | ✅ 已完成 |

### 未修改文件

| 文件 | 说明 |
|------|------|
| `functions/api/[[route]].ts` | 后端零改动，现有 API 接口完全不变 |
| `types.ts` | 数据类型不变 |
| `wrangler.toml` | 部署配置不变 |

## 线上测试报告（2026-02-19）

**测试环境**: https://tk-report.pages.dev/
**部署版本**: d5e85bdc
**浏览器**: Chrome DevTools（桌面端，模拟离线/在线切换）

### 测试结果总览

| # | 测试项 | 结果 |
|---|--------|------|
| 1 | Service Worker 注册与激活 | ✅ 通过 |
| 2 | 项目数据缓存到 IndexedDB | ✅ 通过 |
| 3 | 离线状态检测（SyncIndicator） | ✅ 通过 |
| 4 | 离线刷新页面（SW 缓存静态资源） | ✅ 通过 |
| 5 | 离线创建新项目 | ✅ 通过 |
| 6 | 恢复网络后自动同步 | ✅ 通过 |
| 7 | 服务端数据一致性验证 | ✅ 通过 |
| 8 | 缓存资源完整性 | ✅ 通过 |

### 详细测试记录

**测试 1 — Service Worker 注册**
- SW scope: `https://tk-report.pages.dev/`
- 状态: active=true, waiting=false
- Workbox precache: 6 个文件（index.html、2 个 JS、2 个 icon、manifest.webmanifest）

**测试 2 — IndexedDB 数据缓存**
- 首次在线加载后，3 个远程项目自动缓存到 IndexedDB `projects` store
- 同步队列为空（无待同步操作）

**测试 3 — 离线状态检测**
- 模拟断网后 SyncIndicator 从"在线"(绿点) 变为"离线"(红点)

**测试 4 — 离线刷新页面**
- 断网状态下刷新，页面完整加载
- 3 个项目全部从 IndexedDB 正常显示
- Tailwind CDN 离线命中缓存（HTTP 200）
- 唯一失败: `favicon.ico`（未提供，不影响功能）

**测试 5 — 离线创建新项目**
- 断网状态下创建"离线测试项目"（上海市浦东新区/储能）
- 编辑器正常打开，数据正确显示
- IndexedDB 验证: 4 个项目，syncQueue: 1 条 create 操作
- SyncIndicator 显示 badge "1"（1 项待同步）

**测试 6 — 恢复网络后自动同步**
- 恢复网络后 ~2 秒内自动同步完成
- syncQueue 清空为 0
- SyncIndicator 恢复"在线"，badge 消失

**测试 7 — 服务端数据一致性**
- 直接调用 `GET /api/projects` 确认服务端返回 4 个项目
- "离线测试项目"已成功同步到 D1 数据库

**测试 8 — 缓存资源完整性**
- Workbox precache: 6 个文件（index.html、JS bundle、icons、manifest）
- Tailwind CDN: 离线可用（CacheFirst 策略生效）
- API images: CacheFirst 策略已配置（本次无图片上传，未触发）

### 已知限制

1. `favicon.ico` 未提供，离线时会报一个 404（不影响功能）
2. Tailwind CDN 缓存依赖首次在线访问时 SW 拦截，首次安装 SW 后需刷新一次才生效
3. 冲突策略为 Last Write Wins，多设备同时离线编辑同一项目可能丢失一方修改

---

## 实施完成总结（2026-02-19）

### 实施范围

| 模块 | 状态 |
|------|------|
| PWA Service Worker（静态资源离线缓存） | ✅ 已完成 |
| IndexedDB 本地存储（项目 + 报告数据） | ✅ 已完成 |
| 同步队列（离线变更排队 + 联网自动同步） | ✅ 已完成 |
| Local-first CRUD 改造（6 个 API 函数） | ✅ 已完成 |
| SyncIndicator UI 角标 | ✅ 已完成 |
| 线上部署与测试 | ✅ 已完成 |

### 新增依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `vite-plugin-pwa` | ^1.2.0 | Vite PWA 插件（含 Workbox） |

### 生产部署

- 项目名：`tk-report`
- 生产 URL：https://tk-report.pages.dev
- 后端零改动：`functions/api/[[route]].ts` 不需要任何修改
- 部署命令：`npm run deploy`

### 验证方式

1. `npm run dev` 启动开发服务器，本地验证基本功能
2. `npm run deploy` 部署后，手机访问线上地址
3. 断开手机网络，创建/编辑项目 → 应正常保存到本地
4. 恢复网络 → 角标显示同步中 → 同步完成后服务端数据一致
5. Chrome DevTools → Application → Service Worker 确认注册
6. Chrome DevTools → Application → IndexedDB 确认数据存储
