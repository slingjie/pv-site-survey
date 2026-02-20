# Cloudflare Access 配置指南

> 前置条件：已执行 `npm run deploy` 部署最新代码

## 配置顺序

1. 部署最新代码（`npm run deploy`）
2. 绑定自定义域名
3. 创建 Zero Trust Access Application + Policy
4. 设置 Pages 环境变量
5. 再次部署使环境变量生效（`npm run deploy`）

---

## Step 1: 绑定自定义域名

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → 找到 Pages 项目（`tk-report`）
3. **Custom domains** → **Set up a custom domain**
4. 输入域名（如 `shilingjie.xyz` 或 `app.shilingjie.xyz`）
5. 按提示完成 DNS 记录，等待状态变为 **Active**

---

## Step 2: 创建 Access Application

1. 进入 [Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. 左侧 **Access** → **Applications** → **Add an application**
3. 选择 **Self-hosted**
4. 填写：
   - **Application name**: `勘探报告工具`
   - **Session Duration**: `7 days`
   - **Application domain**: Step 1 绑定的域名
5. 保存后，在详情页复制 **Application Audience (AUD) Tag**

---

## Step 3: 创建 Access Policy

在 Application 详情中：

1. **Add a policy**
2. **Policy name**: `Allow users`
3. **Action**: `Allow`
4. **Include** 规则：
   - **Emails**: 输入允许登录的具体邮箱
   - 或 **Emails ending in**: 输入邮箱域名（如 `@yourcompany.com`）
5. **Save policy**

> 新用户需在此处添加邮箱/域名后才能登录（等同管理员审批）

---

## Step 4: 设置 Pages 环境变量

1. **Workers & Pages** → 项目 → **Settings** → **Environment variables**
2. 在 **Production** 环境添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `CF_ACCESS_TEAM_DOMAIN` | `你的team名.cloudflareaccess.com` | Zero Trust 左上角可见 |
| `CF_ACCESS_AUD` | Step 2 复制的 AUD Tag | Application Audience Tag |
| `ADMIN_EMAIL` | `admin@example.com` | 管理员邮箱，多个用逗号分隔 |

---

## Step 5: 重新部署

```bash
npm run deploy
```

环境变量在下次部署时生效。

---

## 验证清单

- [ ] 访问域名 → 跳转 Cloudflare Access 登录页
- [ ] 管理员邮箱登录 → 顶部显示邮箱 + "管理员"
- [ ] 管理员可查看所有项目
- [ ] 普通用户邮箱登录 → 顶部显示 "普通用户"
- [ ] 普通用户只能看到自己的项目
- [ ] 退出登录按钮正常工作
- [ ] 未在 Policy 中的邮箱无法登录

---

## 后续维护

- **添加新用户**: Access → Applications → Policy → 添加邮箱
- **修改管理员**: Pages 环境变量 → 修改 `ADMIN_EMAIL` → 重新部署
- **更换域名**: 修改 Custom domain + Access Application domain + `VITE_CF_ACCESS_TEAM_DOMAIN`（如前端 logout 需要）
