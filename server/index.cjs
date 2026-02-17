// 简易 NAS 后端：Node.js + Express + SQLite
// 提供与 Cloudflare Worker 版本兼容的 /api/projects 接口

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const { randomUUID } = require("crypto");

// -------------------- 数据库初始化 --------------------

const DB_PATH =
  process.env.DB_PATH ||
  path.join(__dirname, "..", "data", "tk_report_projects.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// 使用 backend/schema.sql 作为真源初始化表结构
const schemaPath = path.join(__dirname, "..", "backend", "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf-8");
db.exec(schemaSql);

// -------------------- 辅助类型与函数 --------------------

/**
 * 将底层行记录转换为前端所需的 ProjectSummary 结构
 */
function rowToSummary(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    status: row.status,
    surveyDate: row.survey_date || undefined,
    surveyors: row.surveyors || undefined,
    projectType: row.project_type || null,
    updatedAt: row.updated_at,
  };
}

// -------------------- Express 应用 --------------------

const app = express();
const PORT = process.env.PORT || 8787;

// JSON 体积限制适当放宽，便于携带压缩后的图片
app.use(express.json({ limit: "32mb" }));

// CORS：默认允许所有来源，可按需通过环境变量收紧
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN.split(","),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// 健康检查
app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

// -------------------- /api/projects 路由 --------------------

// 列出所有项目
app.get("/api/projects", (_req, res) => {
  const stmt = db.prepare(
    `SELECT id, name, location, status, survey_date, surveyors, project_type, report_data, created_at, updated_at
     FROM projects
     ORDER BY updated_at DESC`,
  );
  const rows = stmt.all();
  res.json(rows.map(rowToSummary));
});

// 获取单个项目详情
app.get("/api/projects/:id", (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare(
    `SELECT id, name, location, status, survey_date, surveyors, project_type, report_data, created_at, updated_at
     FROM projects
     WHERE id = ?`,
  );
  const row = stmt.get(id);
  if (!row) {
    res.status(404).send("Not found");
    return;
  }
  let reportData = null;
  try {
    reportData = JSON.parse(row.report_data);
  } catch {
    reportData = null;
  }
  res.json({
    project: rowToSummary(row),
    reportData,
  });
});

// 创建新项目
app.post("/api/projects", (req, res) => {
  const payload = req.body || {};
  const project = payload.project || {};
  const reportData = payload.reportData;

  if (!project.name || !project.location || !project.status) {
    res.status(400).send("Missing required project fields");
    return;
  }
  if (!reportData) {
    res.status(400).send("Missing reportData");
    return;
  }

  const id = project.id || randomUUID();
  const reportJson = JSON.stringify(reportData);

  const stmt = db.prepare(
    `INSERT INTO projects
     (id, name, location, status, survey_date, surveyors, project_type, report_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  );

  stmt.run(
    id,
    project.name,
    project.location,
    project.status,
    project.surveyDate || null,
    project.surveyors || null,
    project.projectType || null,
    reportJson,
  );

  res.status(201).json({ id });
});

// 更新项目及报告
app.put("/api/projects/:id", (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const project = payload.project;
  const reportData = payload.reportData;

  if (!project && !reportData) {
    res.status(400).send("Nothing to update");
    return;
  }

  const existing = db
    .prepare("SELECT id FROM projects WHERE id = ?")
    .get(id);
  if (!existing) {
    res.status(404).send("Not found");
    return;
  }

  const reportJson = reportData ? JSON.stringify(reportData) : null;

  const stmt = db.prepare(
    `UPDATE projects
     SET
       name = COALESCE(?, name),
       location = COALESCE(?, location),
       status = COALESCE(?, status),
       survey_date = COALESCE(?, survey_date),
       surveyors = COALESCE(?, surveyors),
       project_type = COALESCE(?, project_type),
       report_data = COALESCE(?, report_data),
       updated_at = datetime('now')
     WHERE id = ?`,
  );

  stmt.run(
    project?.name ?? null,
    project?.location ?? null,
    project?.status ?? null,
    project?.surveyDate ?? null,
    project?.surveyors ?? null,
    project?.projectType ?? null,
    reportJson,
    id,
  );

  res.status(204).send();
});

// 更新项目状态
app.patch("/api/projects/:id/status", (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const status = body.status;

  if (!status) {
    res.status(400).send("Missing status");
    return;
  }

  const stmt = db.prepare(
    `UPDATE projects
     SET status = ?, updated_at = datetime('now')
     WHERE id = ?`,
  );

  const result = stmt.run(status, id);
  if (result.changes === 0) {
    res.status(404).send("Not found");
    return;
  }

  res.status(204).send();
});

// 删除项目
app.delete("/api/projects/:id", (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
  const result = stmt.run(id);
  if (result.changes === 0) {
    res.status(404).send("Not found");
    return;
  }
  res.status(204).send();
});

// -------------------- 启动服务 --------------------

app.listen(PORT, () => {
  console.log(
    `[tk-report] NAS 后端已启动：http://0.0.0.0:${PORT} （数据库：${DB_PATH}）`,
  );
});

