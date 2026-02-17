export interface Env {
  DB: D1Database;
}

type ProjectStatus = "editing" | "completed";
type ProjectType = "pv" | "storage" | "pv_storage" | "other" | null;

interface ProjectRow {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  survey_date: string | null;
  surveyors: string | null;
  project_type: string | null;
  report_data: string;
  created_at: string;
  updated_at: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  surveyDate?: string;
  surveyors?: string;
  projectType?: ProjectType;
  updatedAt: string;
}

interface ProjectPayload {
  project: {
    id?: string;
    name: string;
    location: string;
    status: ProjectStatus;
    surveyDate?: string;
    surveyors?: string;
    projectType?: ProjectType;
  };
  reportData: any;
}

function rowToSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    status: row.status,
    surveyDate: row.survey_date || undefined,
    surveyors: row.surveyors || undefined,
    projectType: (row.project_type as ProjectType) || null,
    updatedAt: row.updated_at,
  };
}

async function handleListProjects(env: Env): Promise<Response> {
  const stmt = env.DB.prepare(
    `SELECT id, name, location, status, survey_date, surveyors, project_type, report_data, created_at, updated_at
     FROM projects
     ORDER BY updated_at DESC`,
  );
  const { results } = await stmt.all<ProjectRow>();
  return Response.json(results.map(rowToSummary));
}

async function handleGetProject(env: Env, id: string): Promise<Response> {
  const stmt = env.DB.prepare(
    `SELECT id, name, location, status, survey_date, surveyors, project_type, report_data, created_at, updated_at
     FROM projects
     WHERE id = ?`,
  ).bind(id);
  const row = await stmt.first<ProjectRow>();
  if (!row) {
    return new Response("Not found", { status: 404 });
  }
  let reportData: any = null;
  try {
    reportData = JSON.parse(row.report_data);
  } catch {
    reportData = null;
  }
  return Response.json({
    project: rowToSummary(row),
    reportData,
  });
}

async function handleCreateProject(env: Env, req: Request): Promise<Response> {
  const payload = (await req.json()) as ProjectPayload;
  const { project, reportData } = payload;

  if (!project?.name || !project?.location || !project?.status) {
    return new Response("Missing required project fields", { status: 400 });
  }
  if (!reportData) {
    return new Response("Missing reportData", { status: 400 });
  }

  const id = project.id || crypto.randomUUID();
  const reportJson = JSON.stringify(reportData);

  const stmt = env.DB.prepare(
    `INSERT INTO projects
     (id, name, location, status, survey_date, surveyors, project_type, report_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).bind(
    id,
    project.name,
    project.location,
    project.status,
    project.surveyDate || null,
    project.surveyors || null,
    project.projectType || null,
    reportJson,
  );

  await stmt.run();

  return Response.json({ id }, { status: 201 });
}

async function handleUpdateProject(
  env: Env,
  id: string,
  req: Request,
): Promise<Response> {
  const payload = (await req.json()) as ProjectPayload;
  const { project, reportData } = payload;

  if (!project && !reportData) {
    return new Response("Nothing to update", { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT id FROM projects WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) {
    return new Response("Not found", { status: 404 });
  }

  const reportJson = reportData ? JSON.stringify(reportData) : null;

  const stmt = env.DB.prepare(
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
  ).bind(
    project?.name ?? null,
    project?.location ?? null,
    project?.status ?? null,
    project?.surveyDate ?? null,
    project?.surveyors ?? null,
    project?.projectType ?? null,
    reportJson,
    id,
  );

  await stmt.run();

  return new Response(null, { status: 204 });
}

async function handleUpdateStatus(
  env: Env,
  id: string,
  req: Request,
): Promise<Response> {
  const body = (await req.json()) as { status?: ProjectStatus };
  if (!body.status) {
    return new Response("Missing status", { status: 400 });
  }

  const stmt = env.DB.prepare(
    `UPDATE projects
     SET status = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).bind(body.status, id);

  const res = await stmt.run();
  if (!res.success) {
    return new Response("Update failed", { status: 500 });
  }
  if (res.changes === 0) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, { status: 204 });
}

async function handleDeleteProject(env: Env, id: string): Promise<Response> {
  const stmt = env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id);
  const res = await stmt.run();
  if (res.changes === 0) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(null, { status: 204 });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // 处理预检请求
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (!pathname.startsWith("/api")) {
      return new Response("Not found", { status: 404 });
    }

    const path = pathname.replace(/^\/api/, "") || "/";
    const segments = path.split("/").filter(Boolean);

    try {
      // /api/projects
      if (segments.length === 1 && segments[0] === "projects") {
        if (request.method === "GET") {
          return withCors(await handleListProjects(env));
        }
        if (request.method === "POST") {
          return withCors(await handleCreateProject(env, request));
        }
      }

      // /api/projects/:id or /api/projects/:id/status
      if (segments.length >= 2 && segments[0] === "projects") {
        const id = segments[1];

        if (segments.length === 2) {
          if (request.method === "GET") {
            return withCors(await handleGetProject(env, id));
          }
          if (request.method === "PUT") {
            return withCors(await handleUpdateProject(env, id, request));
          }
          if (request.method === "DELETE") {
            return withCors(await handleDeleteProject(env, id));
          }
        }

        if (segments.length === 3 && segments[2] === "status") {
          if (request.method === "PATCH") {
            return withCors(await handleUpdateStatus(env, id, request));
          }
        }
      }

      return withCors(new Response("Not found", { status: 404 }));
    } catch (err: any) {
      console.error("API error", err);
      return withCors(new Response("Internal error", { status: 500 }));
    }
  },
};
