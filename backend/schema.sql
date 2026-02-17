-- D1 / SQLite schema for踏勘报告工具

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL,              -- 'editing' | 'completed'
  survey_date TEXT,                  -- YYYY-MM-DD
  surveyors TEXT,                    -- e.g. "张三, 李四"
  project_type TEXT,                 -- 'pv' | 'storage' | 'pv_storage' | 'other'
  report_data TEXT NOT NULL,         -- full ReportData JSON
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
