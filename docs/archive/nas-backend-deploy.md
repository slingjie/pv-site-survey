# 勘探报告工具后端 NAS 部署指导（Docker + Cloudflare Tunnel）

本文档说明如何将本项目的后端从 Cloudflare Worker 迁移到家用 NAS，使用 Docker 运行 Node.js + SQLite 服务，并通过 Cloudflare Tunnel 安全暴露为公网可访问的 API 域名。

适用前提：

- NAS 支持 Docker（如群晖、威联通等）。
- 已有 Cloudflare 账号，并已将自己的域名托管到 Cloudflare（用于绑定 `api.your-domain.com` 之类的子域名）。
- 你希望前端继续托管在 Cloudflare Pages 或其他静态托管平台，只是把后端和数据库迁到自家 NAS。

---

## 一、目录与代码准备

假设你已经将当前项目代码拷贝到 NAS 某个目录，例如：

- `/volume1/tk-report`

目录中包含：

- `package.json`
- `backend/schema.sql`
- `backend/src/worker.ts`（仅作为 SQL 真源参考）
- `server/index.cjs`（已在仓库中提供的 Node.js 后端入口）

后续所有命令默认在 `/volume1/tk-report` 目录下执行。

---

## 二、使用 Docker 运行 Node.js + SQLite 后端

### 1. 编写 Dockerfile

在项目根目录（`/volume1/tk-report`）中新建 `Dockerfile`，内容如下：

```Dockerfile
FROM node:20-bullseye

WORKDIR /app

# 仅复制必要文件
COPY package.json package-lock.json ./
COPY backend ./backend
COPY server ./server

# 安装生产依赖
RUN npm install --only=production

# SQLite 数据文件目录
RUN mkdir -p /app/data

# 默认环境变量（可在 docker-compose 中覆盖）
ENV PORT=8787
ENV DB_PATH=/app/data/tk_report_projects.db
ENV CORS_ORIGIN=*

EXPOSE 8787

CMD ["npm", "run", "server"]
```

说明：

- 运行时会执行 `npm run server`，即启动 `server/index.cjs`。  
- 容器内数据库文件默认位于 `/app/data/tk_report_projects.db`，后续会通过挂载卷持久化到 NAS。  
- `CORS_ORIGIN` 用于限制允许访问 API 的前端域名，默认 `*`，可按需收紧。

### 2. 编写 docker-compose.yml

在同一目录新增 `docker-compose.yml`，示例：

```yaml
version: "3.8"

services:
  backend:
    build: .
    container_name: tk-report-backend
    restart: unless-stopped
    environment:
      - PORT=8787
      - DB_PATH=/app/data/tk_report_projects.db
      # 建议这里写你的前端真实域名，多个用逗号分隔
      - CORS_ORIGIN=https://your-frontend-domain.com
    volumes:
      - ./data:/app/data
    networks:
      - tk-report-net

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: tk-report-cloudflared
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - tk-report-net
    command: tunnel run tk-report-backend
    environment:
      # 从 Cloudflare 控制台复制的 Tunnel Token
      - TUNNEL_TOKEN=你的_TUNNEL_TOKEN_放这里

networks:
  tk-report-net:
    driver: bridge
```

说明：

- `backend`：运行 Node.js + SQLite 后端，监听端口 `8787`，数据库数据通过 `./data` 目录持久化。  
- `cloudflared`：Cloudflare Tunnel 客户端，通过 `TUNNEL_TOKEN` 与 Cloudflare 建立加密隧道，并将外部请求转发到 `backend`。  
- 两个服务在同一 Docker 网络 `tk-report-net` 内，`cloudflared` 可以通过服务名 `backend:8787` 访问后端。

### 3. 构建并启动容器

在 NAS 的终端（或 SSH）中执行：

```bash
cd /volume1/tk-report

# 构建镜像
docker compose build

# 后台启动
docker compose up -d
```

启动完成后，可查看容器状态：

```bash
docker ps
```

你应该能看到 `tk-report-backend` 和 `tk-report-cloudflared` 两个容器处于运行状态。

### 4. 在 NAS 内部自测后端 API

在 NAS 上（或任意可以访问 Docker 网络的终端）执行：

```bash
# 健康检查
curl http://localhost:8787/healthz

# 或通过 docker exec 直接在 backend 容器内部访问
docker exec -it tk-report-backend curl http://localhost:8787/healthz
```

若返回：

```json
{"ok": true}
```

说明后端服务已经正常运行。此时，`/app/data` 中的 SQLite 数据库文件也已初始化（映射到宿主机 `./data/tk_report_projects.db`）。

---

## 三、在 Cloudflare 中配置 Tunnel 与 API 域名

### 1. 创建 Tunnel 并获取 Token

1. 登录 Cloudflare 控制台。  
2. 进入 Zero Trust 或 Tunnel 管理页面，创建一个新 Tunnel，例如命名为：`tk-report-backend`。  
3. 选择使用 **Token 模式**（Cloudflared 运行时只需要一个 Token）。  
4. Cloudflare 会生成一个 `TUNNEL_TOKEN`，复制该值，并填入前文 `docker-compose.yml` 中 `cloudflared` 服务的 `TUNNEL_TOKEN` 环境变量。

改好后重新启动容器：

```bash
docker compose down
docker compose up -d
```

### 2. 配置 Public Hostname

在“Tunnel 详情”界面中，为刚才的 Tunnel 添加一个 Public Hostname，例如：

- Hostname：`api.your-domain.com`
- Service：`http://backend:8787`

说明：

- `backend` 是 docker-compose 中后端服务的名称。  
- Cloudflare 会自动在你的域名下创建相应的 DNS 记录（通常是 CNAME），指向 Tunnel。

配置完成并应用后，Cloudflare 会将外部访问 `https://api.your-domain.com` 的流量通过 Tunnel 转发到 Docker 网络中的 `backend:8787`。

### 3. 外网验证 API 是否可用

在任意外网环境（如手机 4G/5G）上执行：

```bash
curl "https://api.your-domain.com/healthz"
curl "https://api.your-domain.com/api/projects"
```

若能获得正常响应（例如 `"ok":true` 或空数组 `[]`），说明：

- NAS 后端正常运行；
- Cloudflare Tunnel 已经连通；
- 域名解析与 HTTPS 均已配置成功。

---

## 四、让前端调用 NAS 后端（而不是 Cloudflare Worker）

前端通过 `App.tsx` 中的 `API_BASE` 与后端交互，目前逻辑为：

- 若存在 `VITE_API_BASE` 环境变量，则优先使用该值；  
- 否则：
  - 开发环境：使用 `/api`（由 Vite `proxy` 转发到本地端口）；
  - 生产环境：默认指向 Cloudflare Worker 的地址。

### 1. 配置 VITE_API_BASE 指向 NAS 后端

例如你希望前端在生产环境使用 `https://api.your-domain.com/api`：

1. 在构建前端的环境中（本地或 CI），创建/修改 `.env.production`：

   ```bash
   VITE_API_BASE=https://api.your-domain.com/api
   ```

2. 重新构建前端：

   ```bash
   npm run build
   ```

3. 将新的 `dist` 部署到 Cloudflare Pages 或你的静态站点。

### 2. 在浏览器中验证

1. 打开前端页面（例如 `https://your-frontend-domain.com`）。  
2. 打开浏览器开发者工具 → Network 面板：
   - 找到 `/api/projects` 等请求；
   - 确认请求地址形如 `https://api.your-domain.com/api/projects`；
   - 状态码为 `200` 或 `201/204` 等成功状态。

3. 在页面中执行：
   - 新建项目 → 上传图片 → 保存；  
   - 刷新页面后重新打开项目，确认数据和图片均来自 NAS 后端（在 Network 里也能看到请求走的是 NAS 域名）。

---

## 五、常见问题与建议

### 1. better-sqlite3 安装失败怎么办？

在 Windows 本机开发时，`better-sqlite3` 需要本地 C++ 编译环境，容易报 Visual Studio 相关错误。但在 Docker 中使用官方 `node:20-bullseye` 镜像时，中间层已经包含构建工具，一般可以顺利编译。

推荐做法：

- 在 Windows 上只做前端开发与打包；  
- 后端与 `better-sqlite3` 的安装与运行，全部交给 Docker（在 NAS 上构建）。

### 2. 如何备份后端数据？

- 所有数据都存放在 SQLite 数据库文件中：  
  - 容器内路径：`/app/data/tk_report_projects.db`  
  - 映射到 NAS：`/volume1/tk-report/data/tk_report_projects.db`
- 只要定期备份 NAS 上的 `data` 目录，就完成了数据备份。

### 3. 如何限制前端访问来源？

- 在 `docker-compose.yml` 中设置：

  ```yaml
  environment:
    - CORS_ORIGIN=https://your-frontend-domain.com
  ```

- 如需允许多个前端来源，可用逗号分隔：

  ```yaml
  CORS_ORIGIN=https://a.example.com,https://b.example.com
  ```

后端会据此在 CORS 中间件中做检查，只放行指定 Origin。

---

## 六、总结

通过上述步骤，你可以：

- 在 NAS 上通过 Docker 运行一个与 Cloudflare Worker 行为兼容的 Node.js + SQLite 后端；  
- 使用 Cloudflare Tunnel 将该后端安全地暴露到公网，无需在家用路由器上开放端口；  
- 通过配置 `VITE_API_BASE`，让前端绕过 Cloudflare Worker，直接调用 NAS 后端，实现数据完全自托管。

后续如果需要进一步“把图片单独存储到 NAS 文件系统或对象存储”，可以在现有 `server/index.cjs` 的基础上扩展，将大体积图片从 `reportData` JSON 中拆分出去，仅在数据库中存路径或 URL，从而进一步减轻单条记录压力。 

