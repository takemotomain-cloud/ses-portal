-- 011: 勤怠突合機能（現場勤怠表の自動読取り＋自社勤怠データとの自動突合）
--
-- 新テーブル:
--   attendance_confirmed       — 突合後の確定勤怠データ（請求書・給与の元データ）
--   client_attendance_uploads  — 現場勤怠表のアップロード履歴
--   client_attendance_records  — 構造化された現場勤怠レコード
--   reconciliation_results     — 突合結果（差異の記録）
--   reconciliation_settings    — クライアント別突合設定

-- 確定勤怠データ（突合後）
CREATE TABLE attendance_confirmed (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  work_date     DATE NOT NULL,
  start_time    TIMESTAMPTZ,
  end_time      TIMESTAMPTZ,
  break_minutes INT NOT NULL DEFAULT 60,
  work_minutes  INT,
  overtime_minutes INT,
  source        VARCHAR(30) NOT NULL DEFAULT 'system', -- system / client / manual
  confirmed_at  TIMESTAMPTZ,
  confirmed_by  UUID REFERENCES employees(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

CREATE TRIGGER trg_attendance_confirmed_updated_at
  BEFORE UPDATE ON attendance_confirmed
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 現場勤怠表アップロード履歴
CREATE TABLE client_attendance_uploads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  client_id     UUID REFERENCES clients(id),
  year_month    VARCHAR(7) NOT NULL, -- '2026-03'
  file_name     VARCHAR(300),
  file_path     VARCHAR(500),
  file_type     VARCHAR(20), -- xlsx, pdf, image, csv
  raw_json      JSONB,
  status        VARCHAR(20) NOT NULL DEFAULT 'uploaded', -- uploaded / parsed / reconciled / confirmed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_client_attendance_uploads_updated_at
  BEFORE UPDATE ON client_attendance_uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 構造化された現場勤怠レコード
CREATE TABLE client_attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id     UUID NOT NULL REFERENCES client_attendance_uploads(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  start_time    VARCHAR(5),  -- 'HH:MM'
  end_time      VARCHAR(5),  -- 'HH:MM'
  break_minutes INT,
  work_hours    DECIMAL(5,2),
  day_type      VARCHAR(20) DEFAULT 'normal', -- normal / paid_leave / absent / holiday
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_attendance_records_upload ON client_attendance_records(upload_id);

-- 突合結果
CREATE TABLE reconciliation_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id       UUID NOT NULL REFERENCES client_attendance_uploads(id) ON DELETE CASCADE,
  work_date       DATE NOT NULL,
  match_status    VARCHAR(20) NOT NULL, -- match / mismatch / client_only / system_only
  client_start    VARCHAR(5),
  client_end      VARCHAR(5),
  client_break    INT,
  client_hours    DECIMAL(5,2),
  system_start    VARCHAR(5),
  system_end      VARCHAR(5),
  system_break    INT,
  system_hours    DECIMAL(5,2),
  resolved_by     VARCHAR(20) DEFAULT 'client', -- client / system / manual
  resolved_start  VARCHAR(5),
  resolved_end    VARCHAR(5),
  resolved_break  INT,
  resolved_hours  DECIMAL(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_results_upload ON reconciliation_results(upload_id);

CREATE TRIGGER trg_reconciliation_results_updated_at
  BEFORE UPDATE ON reconciliation_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- クライアント別突合設定
CREATE TABLE reconciliation_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL UNIQUE REFERENCES clients(id),
  time_tolerance_min   INT NOT NULL DEFAULT 15,
  hours_tolerance      DECIMAL(3,1) NOT NULL DEFAULT 0.5,
  break_included       BOOLEAN NOT NULL DEFAULT false,
  rounding_unit_min    INT NOT NULL DEFAULT 15,
  default_start_time   VARCHAR(5) DEFAULT '09:00',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_reconciliation_settings_updated_at
  BEFORE UPDATE ON reconciliation_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE attendance_confirmed IS '突合後の確定勤怠データ。請求書・給与計算の元データ';
COMMENT ON TABLE client_attendance_uploads IS '現場勤怠表のアップロード履歴';
COMMENT ON TABLE client_attendance_records IS 'Claude APIで構造化された現場勤怠レコード';
COMMENT ON TABLE reconciliation_results IS '突合結果（差異の記録）';
COMMENT ON TABLE reconciliation_settings IS 'クライアント別の突合設定';
