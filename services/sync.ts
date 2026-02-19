import * as db from "./db";
import type { SyncQueueItem } from "./db";
import {
  createProjectWithReportRemote,
  saveProjectWithReportRemote,
  updateProjectStatusRemoteApi,
  deleteProjectRemoteApi,
} from "./projectApi";
import type { Project } from "../types";

export type SyncStatus = { state: "idle" | "syncing" | "error"; pending: number };

type Listener = (status: SyncStatus) => void;
const listeners = new Set<Listener>();
let currentStatus: SyncStatus = { state: "idle", pending: 0 };

function notify(status: SyncStatus): void {
  currentStatus = status;
  listeners.forEach((cb) => cb(status));
}

export function onSyncStatusChange(cb: Listener): () => void {
  listeners.add(cb);
  cb(currentStatus);
  return () => listeners.delete(cb);
}

let syncing = false;

async function processItem(item: SyncQueueItem): Promise<void> {
  const { action, projectId, data } = item;

  if (action === "delete") {
    await deleteProjectRemoteApi(projectId);
    return;
  }

  if (action === "updateStatus") {
    const { status } = data as { status: Project["status"] };
    await updateProjectStatusRemoteApi(projectId, status);
    return;
  }

  // create or update — need project + reportData from IndexedDB
  const project = await db.getProject(projectId);
  const reportData = await db.getReportData(projectId);
  if (!project || !reportData) return; // data deleted locally, skip

  if (action === "create") {
    await createProjectWithReportRemote(project, reportData);
  } else {
    await saveProjectWithReportRemote(project, reportData);
  }
}

export async function syncToServer(): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;

  try {
    const queue = await db.getSyncQueue();
    notify({ state: "syncing", pending: queue.length });

    for (const item of queue) {
      try {
        await processItem(item);
        await db.clearSyncQueueItem(item.id!);
        notify({ state: "syncing", pending: (await db.getSyncQueue()).length });
      } catch (e) {
        console.error("同步失败，停止队列处理:", e);
        notify({ state: "error", pending: (await db.getSyncQueue()).length });
        return;
      }
    }

    notify({ state: "idle", pending: 0 });
  } finally {
    syncing = false;
  }
}

/** Fire-and-forget sync attempt */
export function trySync(): void {
  syncToServer().catch(() => {});
}

// Auto-sync when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => trySync());
}
