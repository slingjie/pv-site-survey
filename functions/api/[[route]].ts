import cloudflareAccessPlugin, {
  type PluginData,
} from "@cloudflare/pages-plugin-cloudflare-access";

interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  ADMIN_EMAIL?: string;
}

type Role = "user" | "admin";
type ErrorCode = "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND";
type ProjectStatus = "editing" | "completed";
type ProjectType = "pv" | "storage" | "pv_storage" | "other" | null;

interface AccessPayload {
  email?: string;
}

interface UserRow {
  id: string;
  email: string;
  role: Role;
}

interface ProjectOwnerRow {
  user_id: string;
}

interface ProjectRow {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  survey_date: string | null;
  surveyors: string | null;
  project_type: string | null;
  report_data: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  owner_email?: string;
}

const BACKFILL_USER_ID_MIGRATION_KEY = "backfill_user_id";

function rowToSummary(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    status: row.status,
    surveyDate: row.survey_date || undefined,
    surveyors: row.surveyors || undefined,
    projectType: (row.project_type as ProjectType) || null,
    updatedAt: row.updated_at,
    ownerEmail: row.owner_email || undefined,
  };
}

function withCors(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(res.body, { status: res.status, headers: h });
}

function json(data: unknown, status = 200) {
  return withCors(Response.json(data, { status }));
}

function jsonError(code: ErrorCode, message: string, status: number) {
  return json({ code, message }, status);
}

function badRequest(message: string) {
  return json({ message }, 400);
}

function ok() {
  return withCors(new Response(null, { status: 204 }));
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAccessDomain(value: string): string {
  const domain = value.trim();
  if (!domain) return "";
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}

function parseAdminEmails(rawValue?: string): Set<string> {
  const values = (rawValue || "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  return new Set(values);
}

async function ensureProjectsUserIdColumn(db: D1Database) {
  try {
    await db.prepare("ALTER TABLE projects ADD COLUMN user_id TEXT DEFAULT ''").run();
  } catch (error) {
    const message = String(error);
    if (!message.includes("duplicate column name")) {
      throw error;
    }
  }
}

async function ensureSchema(db: D1Database) {
  await db
    .prepare(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL,
      survey_date TEXT,
      surveyors TEXT,
      project_type TEXT,
      report_data TEXT NOT NULL,
      user_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`)
    .run();

  await db
    .prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      created_at TEXT DEFAULT (datetime('now'))
    )`)
    .run();

  await db
    .prepare(`CREATE TABLE IF NOT EXISTS migrations (
      key TEXT PRIMARY KEY,
      executed_at TEXT DEFAULT (datetime('now'))
    )`)
    .run();

  await ensureProjectsUserIdColumn(db);
  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)")
    .run();
}

async function getOrCreateUser(
  db: D1Database,
  email: string,
  adminEmails: Set<string>,
): Promise<UserRow> {
  const normalizedEmail = normalizeEmail(email);

  const existing = await db
    .prepare("SELECT id, email, role FROM users WHERE email = ?")
    .bind(normalizedEmail)
    .first<UserRow>();
  if (existing) return existing;

  const role: Role = adminEmails.has(normalizedEmail) ? "admin" : "user";
  const id = crypto.randomUUID();

  try {
    await db
      .prepare(
        "INSERT INTO users (id, email, role, created_at) VALUES (?, ?, ?, datetime('now'))",
      )
      .bind(id, normalizedEmail, role)
      .run();
    return { id, email: normalizedEmail, role };
  } catch {
    const raceResult = await db
      .prepare("SELECT id, email, role FROM users WHERE email = ?")
      .bind(normalizedEmail)
      .first<UserRow>();
    if (raceResult) return raceResult;
    throw new Error("无法创建用户记录");
  }
}

async function runBackfillUserIdMigration(db: D1Database) {
  const executed = await db
    .prepare("SELECT key FROM migrations WHERE key = ?")
    .bind(BACKFILL_USER_ID_MIGRATION_KEY)
    .first<{ key: string }>();
  if (executed) return;

  const firstAdmin = await db
    .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1")
    .first<{ id: string }>();
  if (!firstAdmin?.id) return;

  await db.batch([
    db
      .prepare("UPDATE projects SET user_id = ? WHERE user_id = '' OR user_id IS NULL")
      .bind(firstAdmin.id),
    db
      .prepare("INSERT OR IGNORE INTO migrations (key, executed_at) VALUES (?, datetime('now'))")
      .bind(BACKFILL_USER_ID_MIGRATION_KEY),
  ]);
}

async function getProjectOwner(db: D1Database, projectId: string) {
  return db
    .prepare("SELECT user_id FROM projects WHERE id = ?")
    .bind(projectId)
    .first<ProjectOwnerRow>();
}

const accessMiddleware: PagesFunction<Env> = (ctx) => {
  if (ctx.request.method === "OPTIONS") return ok();

  const domain = normalizeAccessDomain(ctx.env.CF_ACCESS_TEAM_DOMAIN || "");
  const aud = (ctx.env.CF_ACCESS_AUD || "").trim();

  if (!domain || !aud) {
    console.error("[AUTH] Cloudflare Access 配置缺失：CF_ACCESS_TEAM_DOMAIN 或 CF_ACCESS_AUD");
    return json({ code: "AUTH_REQUIRED", message: "服务端认证配置缺失" }, 500);
  }

  return cloudflareAccessPlugin({
    domain: domain as `https://${string}.cloudflareaccess.com`,
    aud,
  })(ctx);
};

const apiHandler: PagesFunction<Env, string, PluginData> = async (ctx) => {
  const { request, env, data } = ctx;
  await ensureSchema(env.DB);

  const adminEmails = parseAdminEmails(env.ADMIN_EMAIL);
  if (adminEmails.size === 0) {
    console.warn(
      "[AUTH] ADMIN_EMAIL not configured, no admin users will be created",
    );
  }

  const payload = data.cloudflareAccess?.JWT?.payload as AccessPayload | undefined;
  const email = normalizeEmail(payload?.email || "");
  if (!email) {
    return jsonError("AUTH_REQUIRED", "未认证", 403);
  }

  const currentUser = await getOrCreateUser(env.DB, email, adminEmails);
  await runBackfillUserIdMigration(env.DB);

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const segs = path.split("/").filter(Boolean);
  const method = request.method;

  try {
    if (segs[0] === "auth" && segs[1] === "me" && segs.length === 2) {
      if (method === "GET") {
        return json({
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
        });
      }
      return jsonError("NOT_FOUND", "未找到接口", 404);
    }

    // GET/POST /api/projects
    if (segs[0] === "projects" && segs.length === 1) {
      if (method === "GET") {
        const query =
          currentUser.role === "admin"
            ? env.DB.prepare(
                "SELECT p.*, u.email AS owner_email FROM projects p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.updated_at DESC",
              )
            : env.DB
                .prepare(
                  "SELECT p.*, u.email AS owner_email FROM projects p LEFT JOIN users u ON p.user_id = u.id WHERE p.user_id = ? ORDER BY p.updated_at DESC",
                )
                .bind(currentUser.id);
        const { results } = await query.all<ProjectRow>();
        return json(results.map(rowToSummary));
      }

      if (method === "POST") {
        const { project, reportData } = await request.json<any>();
        if (!project?.name || !project?.location || !project?.status || !reportData) {
          return badRequest("缺少必要字段");
        }

        const id = project.id || crypto.randomUUID();
        await env.DB
          .prepare(
            `INSERT INTO projects (
              id,name,location,status,survey_date,surveyors,project_type,report_data,user_id,created_at,updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
          )
          .bind(
            id,
            project.name,
            project.location,
            project.status,
            project.surveyDate || null,
            project.surveyors || null,
            project.projectType || null,
            JSON.stringify(reportData),
            currentUser.id,
          )
          .run();
        return json({ id }, 201);
      }
    }

    // PATCH /api/projects/:id/status
    if (segs[0] === "projects" && segs.length === 3 && segs[2] === "status") {
      if (method === "PATCH") {
        const { status } = await request.json<any>();
        if (!status) return badRequest("缺少 status");

        const owner = await getProjectOwner(env.DB, segs[1]);
        if (!owner) return jsonError("NOT_FOUND", "项目不存在", 404);
        if (owner.user_id !== currentUser.id) {
          return jsonError("FORBIDDEN", "无权限修改该项目", 403);
        }

        await env.DB
          .prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(status, segs[1])
          .run();
        return ok();
      }
    }

    // GET/PUT/DELETE /api/projects/:id
    if (segs[0] === "projects" && segs.length === 2) {
      const projectId = segs[1];

      if (method === "GET") {
        const row = await env.DB
          .prepare("SELECT * FROM projects WHERE id = ?")
          .bind(projectId)
          .first<ProjectRow>();
        if (!row) return jsonError("NOT_FOUND", "项目不存在", 404);

        if (currentUser.role !== "admin" && row.user_id !== currentUser.id) {
          return jsonError("FORBIDDEN", "无权限访问该项目", 403);
        }

        let reportData = null;
        try {
          reportData = JSON.parse(row.report_data);
        } catch {
          reportData = null;
        }
        return json({ project: rowToSummary(row), reportData });
      }

      if (method === "PUT") {
        const owner = await getProjectOwner(env.DB, projectId);
        if (!owner) return jsonError("NOT_FOUND", "项目不存在", 404);
        if (owner.user_id !== currentUser.id) {
          return jsonError("FORBIDDEN", "无权限修改该项目", 403);
        }

        const { project, reportData } = await request.json<any>();
        if (!project && !reportData) return badRequest("没有可更新内容");

        const reportDataJson = reportData ? JSON.stringify(reportData) : null;
        await env.DB
          .prepare(
            `UPDATE projects SET
              name = COALESCE(?, name),
              location = COALESCE(?, location),
              status = COALESCE(?, status),
              survey_date = COALESCE(?, survey_date),
              surveyors = COALESCE(?, surveyors),
              project_type = COALESCE(?, project_type),
              report_data = COALESCE(?, report_data),
              updated_at = datetime('now')
            WHERE id = ?`,
          )
          .bind(
            project?.name ?? null,
            project?.location ?? null,
            project?.status ?? null,
            project?.surveyDate ?? null,
            project?.surveyors ?? null,
            project?.projectType ?? null,
            reportDataJson,
            projectId,
          )
          .run();
        return ok();
      }

      if (method === "DELETE") {
        const owner = await getProjectOwner(env.DB, projectId);
        if (!owner) return jsonError("NOT_FOUND", "项目不存在", 404);
        if (owner.user_id !== currentUser.id) {
          return jsonError("FORBIDDEN", "无权限删除该项目", 403);
        }

        await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(projectId).run();
        return ok();
      }
    }

    // POST /api/upload
    if (segs[0] === "upload" && method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const projectId = formData.get("projectId") as string | null;
      const fieldKey = formData.get("fieldKey") as string | null;
      if (!file || !projectId || !fieldKey) {
        return badRequest("缺少 file/projectId/fieldKey");
      }

      const owner = await getProjectOwner(env.DB, projectId);
      if (!owner) return jsonError("NOT_FOUND", "项目不存在", 404);
      if (owner.user_id !== currentUser.id) {
        return jsonError("FORBIDDEN", "无权限上传到该项目", 403);
      }

      const ext = file.name.split(".").pop() || "bin";
      const key = `${projectId}/${fieldKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      await env.IMAGES.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
      return json({ url: `/api/images/${key}` });
    }

    // GET /api/images/*
    if (segs[0] === "images" && segs.length > 1 && method === "GET") {
      const key = segs.slice(1).join("/");
      const projectId = key.split("/")[0];
      if (!projectId) return jsonError("NOT_FOUND", "图片不存在", 404);

      const owner = await getProjectOwner(env.DB, projectId);
      if (!owner) return jsonError("NOT_FOUND", "项目不存在", 404);
      if (currentUser.role !== "admin" && owner.user_id !== currentUser.id) {
        return jsonError("FORBIDDEN", "无权限访问该图片", 403);
      }

      const obj = await env.IMAGES.get(key);
      if (!obj) return jsonError("NOT_FOUND", "图片不存在", 404);

      const headers = new Headers();
      if (obj.httpMetadata?.contentType) {
        headers.set("Content-Type", obj.httpMetadata.contentType);
      }
      headers.set("Cache-Control", "public, max-age=31536000");
      return withCors(new Response(obj.body, { headers }));
    }

    return jsonError("NOT_FOUND", "未找到接口", 404);
  } catch (error) {
    console.error("API error:", error);
    return json({ message: "服务内部错误" }, 500);
  }
};

export const onRequest = [
  accessMiddleware,
  apiHandler,
] as PagesFunction<Env, string, PluginData>[];
