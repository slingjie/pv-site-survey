# 勘探报告工具 OpenSpec 项目说明

## 项目概览

- 项目名称：勘探报告工具
- 前端技术栈：React + TypeScript + Vite（静态构建，可托管在 Cloudflare Pages 或自建静态站）
- 现有后端：Cloudflare Worker + D1（`backend/src/worker.ts` + `schema.sql`）
- 数据模型：单表 `projects`，存储项目元信息与序列化的 `report_data` JSON。

## OpenSpec 使用范围

- 描述前端与后端之间的 API 协议、部署拓扑与演进计划。
- 记录从 Cloudflare 托管后端迁移至自建后端（如 NAS）的架构与需求。
- 后续可以在此基础上继续扩展，如图片对象存储、权限控制等。

## 约定

- 所有新增/修改的需求说明统一放在 `openspec/changes/<change-id>/` 目录下。
- 每个变更使用唯一 `change-id`，动词开头，描述性强，例如：`migrate-backend-to-nas`。
- 需求文档中的接口路径、字段名称应与实际代码保持一致（例如：`/api/projects`）。

