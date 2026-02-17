interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
}

type ProjectStatus = "editing" | "completed";
type ProjectType = "pv" | "storage" | "pv_storage" | "other" | null;

interface ProjectRow {
  id: string; name: string; location: string; status: ProjectStatus;
  survey_date: string | null; surveyors: string | null; project_type: string | null;
  report_data: string; created_at: string; updated_at: string;
}

function rowToSummary(row: ProjectRow) {
  return {
    id: row.id, name: row.name, location: row.location, status: row.status,
    surveyDate: row.survey_date || undefined, surveyors: row.surveyors || undefined,
    projectType: (row.project_type as ProjectType) || null, updatedAt: row.updated_at,
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

function err(msg: string, status: number) {
  return withCors(new Response(msg, { status }));
}

function ok() {
  return withCors(new Response(null, { status: 204 }));
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  if (request.method === "OPTIONS") return ok();

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const segs = path.split("/").filter(Boolean);
  const method = request.method;

  try {
    // GET/POST /api/projects
    if (segs[0] === "projects" && segs.length === 1) {
      if (method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM projects ORDER BY updated_at DESC"
        ).all<ProjectRow>();
        return json(results.map(rowToSummary));
      }
      if (method === "POST") {
        const { project, reportData } = await request.json<any>();
        if (!project?.name || !project?.location || !project?.status || !reportData)
          return err("Missing fields", 400);
        const id = project.id || crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO projects (id,name,location,status,survey_date,surveyors,project_type,report_data,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`
        ).bind(id, project.name, project.location, project.status,
          project.surveyDate||null, project.surveyors||null, project.projectType||null,
          JSON.stringify(reportData)).run();
        return json({ id }, 201);
      }
    }

    // /api/projects/:id/status
    if (segs[0] === "projects" && segs.length === 3 && segs[2] === "status") {
      if (method === "PATCH") {
        const { status } = await request.json<any>();
        if (!status) return err("Missing status", 400);
        const r = await env.DB.prepare(
          "UPDATE projects SET status=?, updated_at=datetime('now') WHERE id=?"
        ).bind(status, segs[1]).run();
        return r.meta.changes === 0 ? err("Not found", 404) : ok();
      }
    }

    // GET/PUT/DELETE /api/projects/:id
    if (segs[0] === "projects" && segs.length === 2) {
      const id = segs[1];
      if (method === "GET") {
        const row = await env.DB.prepare("SELECT * FROM projects WHERE id=?").bind(id).first<ProjectRow>();
        if (!row) return err("Not found", 404);
        let reportData = null;
        try { reportData = JSON.parse(row.report_data); } catch {}
        return json({ project: rowToSummary(row), reportData });
      }
      if (method === "PUT") {
        const { project, reportData } = await request.json<any>();
        if (!project && !reportData) return err("Nothing to update", 400);
        const existing = await env.DB.prepare("SELECT id FROM projects WHERE id=?").bind(id).first();
        if (!existing) return err("Not found", 404);
        const rj = reportData ? JSON.stringify(reportData) : null;
        await env.DB.prepare(
          `UPDATE projects SET name=COALESCE(?,name),location=COALESCE(?,location),status=COALESCE(?,status),
           survey_date=COALESCE(?,survey_date),surveyors=COALESCE(?,surveyors),project_type=COALESCE(?,project_type),
           report_data=COALESCE(?,report_data),updated_at=datetime('now') WHERE id=?`
        ).bind(project?.name??null, project?.location??null, project?.status??null,
          project?.surveyDate??null, project?.surveyors??null, project?.projectType??null, rj, id).run();
        return ok();
      }
      if (method === "DELETE") {
        const r = await env.DB.prepare("DELETE FROM projects WHERE id=?").bind(id).run();
        return r.meta.changes === 0 ? err("Not found", 404) : ok();
      }
    }

    // POST /api/upload
    if (segs[0] === "upload" && method === "POST") {
      const fd = await request.formData();
      const file = fd.get("file") as File | null;
      const projectId = fd.get("projectId") as string | null;
      const fieldKey = fd.get("fieldKey") as string | null;
      if (!file || !projectId || !fieldKey) return err("Missing file/projectId/fieldKey", 400);
      const ext = file.name.split(".").pop() || "bin";
      const key = `${projectId}/${fieldKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      await env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      return json({ url: `/api/images/${key}` });
    }

    // GET /api/images/*
    if (segs[0] === "images" && segs.length > 1 && method === "GET") {
      const key = segs.slice(1).join("/");
      const obj = await env.IMAGES.get(key);
      if (!obj) return err("Not found", 404);
      const headers = new Headers();
      if (obj.httpMetadata?.contentType) headers.set("Content-Type", obj.httpMetadata.contentType);
      headers.set("Cache-Control", "public, max-age=31536000");
      return withCors(new Response(obj.body, { headers }));
    }

    return err("Not found", 404);
  } catch (e: any) {
    console.error("API error:", e);
    return err("Internal error", 500);
  }
};
