-- 案件（Project）テーブル新規作成
CREATE TABLE IF NOT EXISTS projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id),
  name              VARCHAR(200) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active',
  start_date        DATE,
  end_date          DATE,
  work_location     VARCHAR(200),
  area              VARCHAR(20),
  default_start_time VARCHAR(5),
  attendance_format VARCHAR(20) NOT NULL DEFAULT 'none',
  note              TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Assignment に project_id カラム追加
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_assignments_project_id ON assignments(project_id);
