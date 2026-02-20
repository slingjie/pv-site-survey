import type { Project, ReportData } from "../types";

const DB_NAME = "tk-report-db";
const DB_VERSION = 1;

export interface SyncQueueItem {
  id?: number;
  action: "create" | "update" | "updateStatus" | "delete";
  projectId: string;
  data?: unknown;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects"))
        db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("reportData"))
        db.createObjectStore("reportData", { keyPath: "projectId" });
      if (!db.objectStoreNames.contains("syncQueue"))
        db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// ---- Projects ----

export async function getAllProjects(): Promise<Project[]> {
  const store = await tx("projects", "readonly");
  return req(store.getAll());
}

export async function getProject(id: string): Promise<Project | undefined> {
  const store = await tx("projects", "readonly");
  return req(store.get(id));
}

export async function saveProject(project: Project): Promise<void> {
  const store = await tx("projects", "readwrite");
  await req(store.put(project));
}

export async function deleteProject(id: string): Promise<void> {
  const store = await tx("projects", "readwrite");
  await req(store.delete(id));
}

// ---- ReportData ----

export async function getReportData(projectId: string): Promise<ReportData | undefined> {
  const store = await tx("reportData", "readonly");
  const row = await req(store.get(projectId));
  return row ? (row as { projectId: string } & ReportData) : undefined;
}

export async function saveReportData(projectId: string, data: ReportData): Promise<void> {
  const store = await tx("reportData", "readwrite");
  await req(store.put({ ...data, projectId }));
}

export async function deleteReportData(projectId: string): Promise<void> {
  const store = await tx("reportData", "readwrite");
  await req(store.delete(projectId));
}

// ---- User switch ----

const LAST_USER_KEY = "tk-last-user-id";

export function getLastUserId(): string | null {
  return localStorage.getItem(LAST_USER_KEY);
}

export function setLastUserId(userId: string): void {
  localStorage.setItem(LAST_USER_KEY, userId);
}

export async function clearAllData(): Promise<void> {
  const database = await openDB();
  const txn = database.transaction(["projects", "reportData", "syncQueue"], "readwrite");
  txn.objectStore("projects").clear();
  txn.objectStore("reportData").clear();
  txn.objectStore("syncQueue").clear();
  await new Promise<void>((resolve, reject) => {
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

// ---- Sync Queue ----

export async function addToSyncQueue(item: Omit<SyncQueueItem, "id">): Promise<void> {
  const store = await tx("syncQueue", "readwrite");
  await req(store.add(item));
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const store = await tx("syncQueue", "readonly");
  return req(store.getAll());
}

export async function clearSyncQueueItem(id: number): Promise<void> {
  const store = await tx("syncQueue", "readwrite");
  await req(store.delete(id));
}
