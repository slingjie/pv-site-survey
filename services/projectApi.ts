import type { Project, ReportData } from "../types";
import * as db from "./db";
import { trySync } from "./sync";
import { parseApiError } from "./apiError";

const fetchApi = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, credentials: "include" });

const isDataUrl = (value: string | null): value is string =>
  !!value && value.startsWith("data:");

const uploadImageDataUrl = async (
  projectId: string,
  fieldKey: string,
  dataUrl: string,
): Promise<string> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = (blob.type || "application/octet-stream").split("/")[1] || "bin";

  const formData = new FormData();
  formData.append("file", new File([blob], `image.${ext}`, { type: blob.type }));
  formData.append("projectId", projectId);
  formData.append("fieldKey", fieldKey);

  const uploadRes = await fetchApi("/api/upload", { method: "POST", body: formData });
  if (!uploadRes.ok) throw await parseApiError(uploadRes, "图片上传失败");
  const { url } = (await uploadRes.json()) as { url: string };
  return url;
};

/**
 * 遍历 ReportData 中所有图片字段：
 * - 若为 data:URL，则上传到 Storage，并替换为公开 URL
 * - 若已为 URL，则保持不变
 */
export const prepareReportDataWithUploadedImages = async (
  projectId: string,
  data: ReportData,
): Promise<ReportData> => {
  const cloned: ReportData = JSON.parse(JSON.stringify(data));

  // 厂区概况中的图片字段
  if (isDataUrl(cloned.plantOverview.layoutMap)) {
    cloned.plantOverview.layoutMap = await uploadImageDataUrl(
      projectId,
      "plantOverview-layoutMap",
      cloned.plantOverview.layoutMap,
    );
  }
  cloned.plantOverview.overviewPhotos = await Promise.all(
    cloned.plantOverview.overviewPhotos.map((p, index) =>
      isDataUrl(p)
        ? uploadImageDataUrl(
            projectId,
            `plantOverview-overviewPhotos-${index}`,
            p,
          )
        : p,
    ),
  );
  if (isDataUrl(cloned.plantOverview.satelliteImage)) {
    cloned.plantOverview.satelliteImage = await uploadImageDataUrl(
      projectId,
      "plantOverview-satelliteImage",
      cloned.plantOverview.satelliteImage,
    );
  }
  if (isDataUrl(cloned.plantOverview.traffic.map)) {
    cloned.plantOverview.traffic.map = await uploadImageDataUrl(
      projectId,
      "plantOverview-traffic-map",
      cloned.plantOverview.traffic.map,
    );
  }
  cloned.plantOverview.riskZone.photos = await Promise.all(
    cloned.plantOverview.riskZone.photos.map((p, index) =>
      isDataUrl(p)
        ? uploadImageDataUrl(
            projectId,
            `plantOverview-riskZone-photos-${index}`,
            p,
          )
        : p,
    ),
  );

  // 屋面相关图片
  cloned.buildingRoofs = await Promise.all(
    cloned.buildingRoofs.map(async (roof, roofIndex) => {
      const patched = { ...roof };
      if (isDataUrl(patched.birdView)) {
        patched.birdView = await uploadImageDataUrl(
          projectId,
          `roof-${roof.id || roofIndex}-birdView`,
          patched.birdView,
        );
      }
      if (isDataUrl(patched.obstacleImage)) {
        patched.obstacleImage = await uploadImageDataUrl(
          projectId,
          `roof-${roof.id || roofIndex}-obstacleImage`,
          patched.obstacleImage,
        );
      }
      if (isDataUrl(patched.pollutionImage)) {
        patched.pollutionImage = await uploadImageDataUrl(
          projectId,
          `roof-${roof.id || roofIndex}-pollutionImage`,
          patched.pollutionImage,
        );
      }
      if (isDataUrl(patched.structureImage)) {
        patched.structureImage = await uploadImageDataUrl(
          projectId,
          `roof-${roof.id || roofIndex}-structureImage`,
          patched.structureImage,
        );
      }
      if (isDataUrl(patched.abnormalImage)) {
        patched.abnormalImage = await uploadImageDataUrl(
          projectId,
          `roof-${roof.id || roofIndex}-abnormalImage`,
          patched.abnormalImage,
        );
      }
      if (isDataUrl(patched.surroundingImage)) {
        patched.surroundingImage = await uploadImageDataUrl(
          projectId,
          `roof-${roof.id || roofIndex}-surroundingImage`,
          patched.surroundingImage,
        );
      }
      return patched;
    }),
  );

  // 电气设施中的图片字段
  const ef = cloned.electricalFacilities;
  if (isDataUrl(ef.siteRoomImage)) {
    ef.siteRoomImage = await uploadImageDataUrl(
      projectId,
      "electrical-siteRoomImage",
      ef.siteRoomImage,
    );
  }
  if (isDataUrl(ef.siteTransformerImage)) {
    ef.siteTransformerImage = await uploadImageDataUrl(
      projectId,
      "electrical-siteTransformerImage",
      ef.siteTransformerImage,
    );
  }
  if (isDataUrl(ef.siteSingleLineImage)) {
    ef.siteSingleLineImage = await uploadImageDataUrl(
      projectId,
      "electrical-siteSingleLineImage",
      ef.siteSingleLineImage,
    );
  }
  if (isDataUrl(ef.siteEnvImage)) {
    ef.siteEnvImage = await uploadImageDataUrl(
      projectId,
      "electrical-siteEnvImage",
      ef.siteEnvImage,
    );
  }
  if (isDataUrl(ef.transformerDistImage)) {
    ef.transformerDistImage = await uploadImageDataUrl(
      projectId,
      "electrical-transformerDistImage",
      ef.transformerDistImage,
    );
  }

  ef.subFacilities = await Promise.all(
    ef.subFacilities.map(async (sf, index) => {
      const patched = { ...sf };
      const baseKey = `electrical-sub-${sf.id || index}`;
      if (isDataUrl(patched.roomImage)) {
        patched.roomImage = await uploadImageDataUrl(
          projectId,
          `${baseKey}-roomImage`,
          patched.roomImage,
        );
      }
      if (isDataUrl(patched.transformerImage)) {
        patched.transformerImage = await uploadImageDataUrl(
          projectId,
          `${baseKey}-transformerImage`,
          patched.transformerImage,
        );
      }
      if (isDataUrl(patched.singleLineImage)) {
        patched.singleLineImage = await uploadImageDataUrl(
          projectId,
          `${baseKey}-singleLineImage`,
          patched.singleLineImage,
        );
      }
      if (isDataUrl(patched.panelImage)) {
        patched.panelImage = await uploadImageDataUrl(
          projectId,
          `${baseKey}-panelImage`,
          patched.panelImage,
        );
      }
      if (isDataUrl(patched.meterImage)) {
        patched.meterImage = await uploadImageDataUrl(
          projectId,
          `${baseKey}-meterImage`,
          patched.meterImage,
        );
      }
      if (isDataUrl(patched.envImage)) {
        patched.envImage = await uploadImageDataUrl(
          projectId,
          `${baseKey}-envImage`,
          patched.envImage,
        );
      }
      return patched;
    }),
  );

  return cloned;
};

// -------------------- Remote API (供 sync.ts 使用) --------------------

export const listProjectsRemote = async (): Promise<Project[]> => {
  const res = await fetchApi("/api/projects");
  if (!res.ok) throw await parseApiError(res, "加载项目列表失败");
  return res.json();
};

export const getProjectWithReportRemote = async (id: string) => {
  const res = await fetchApi(`/api/projects/${id}`);
  if (!res.ok) throw await parseApiError(res, "加载项目失败");
  return res.json() as Promise<{ project: Project; reportData: ReportData }>;
};

export const createProjectWithReportRemote = async (
  project: Project,
  reportData: ReportData,
): Promise<ReportData> => {
  const payloadReport = await prepareReportDataWithUploadedImages(project.id, reportData);
  const res = await fetchApi("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, reportData: payloadReport }),
  });
  if (!res.ok) throw await parseApiError(res, "创建项目失败");
  return payloadReport;
};

export const saveProjectWithReportRemote = async (
  project: Project,
  reportData: ReportData,
): Promise<ReportData> => {
  const payloadReport = await prepareReportDataWithUploadedImages(project.id, reportData);
  const res = await fetchApi(`/api/projects/${project.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, reportData: payloadReport }),
  });
  if (!res.ok) throw await parseApiError(res, "保存项目失败");
  return payloadReport;
};

export const updateProjectStatusRemoteApi = async (
  projectId: string,
  status: Project["status"],
) => {
  const res = await fetchApi(`/api/projects/${projectId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw await parseApiError(res, "更新状态失败");
};

export const deleteProjectRemoteApi = async (projectId: string) => {
  const res = await fetchApi(`/api/projects/${projectId}`, { method: "DELETE" });
  if (!res.ok) throw await parseApiError(res, "删除项目失败");
};

// -------------------- Local-first CRUD --------------------

export const listProjects = async (): Promise<Project[]> => {
  if (!navigator.onLine) {
    return db.getAllProjects();
  }
  try {
    const remote = await listProjectsRemote();
    for (const p of remote) await db.saveProject(p);
    return remote;
  } catch {
    return db.getAllProjects();
  }
};

export const getProjectWithReport = async (
  id: string,
): Promise<{ project: Project; reportData: ReportData }> => {
  const project = await db.getProject(id);
  const reportData = await db.getReportData(id);
  if (project && reportData) return { project, reportData };
  const remote = await getProjectWithReportRemote(id);
  await db.saveProject(remote.project);
  await db.saveReportData(id, remote.reportData);
  return remote;
};

export const createProjectWithReport = async (
  project: Project,
  reportData: ReportData,
): Promise<ReportData> => {
  await db.saveProject(project);
  await db.saveReportData(project.id, reportData);
  await db.addToSyncQueue({
    action: "create",
    projectId: project.id,
    timestamp: Date.now(),
  });
  trySync();
  return reportData;
};

export const saveProjectWithReport = async (
  project: Project,
  reportData: ReportData,
): Promise<ReportData> => {
  await db.saveProject(project);
  await db.saveReportData(project.id, reportData);
  await db.addToSyncQueue({
    action: "update",
    projectId: project.id,
    timestamp: Date.now(),
  });
  trySync();
  return reportData;
};

export const updateProjectStatusRemote = async (
  projectId: string,
  status: Project["status"],
): Promise<void> => {
  const project = await db.getProject(projectId);
  if (project) await db.saveProject({ ...project, status });
  await db.addToSyncQueue({
    action: "updateStatus",
    projectId,
    data: { status },
    timestamp: Date.now(),
  });
  trySync();
};

export const deleteProjectRemote = async (projectId: string): Promise<void> => {
  await db.deleteProject(projectId);
  await db.deleteReportData(projectId);
  await db.addToSyncQueue({
    action: "delete",
    projectId,
    timestamp: Date.now(),
  });
  trySync();
};

