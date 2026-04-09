-- 018: 休職届（Leave of Absence）
--
-- 新テーブル:
--   leave_of_absence — 社員の休職届・復職届を管理
--
-- ステータスフロー:
--   pending → on_leave (承認) → return_pending (復職届) → returned (復職承認)
--   pending → rejected (却下)

CREATE TABLE leave_of_absence (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  absence_type          VARCHAR(20) NOT NULL,
  start_date            DATE NOT NULL,
  expected_return_date  DATE NOT NULL,
  actual_return_date    DATE,
  reason                TEXT,
  file_path             VARCHAR(500),
  file_name             VARCHAR(300),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by           UUID REFERENCES employees(id),
  approved_at           TIMESTAMPTZ,
  reject_reason         TEXT,
  return_submitted_at   TIMESTAMPTZ,
  return_approved_by    UUID REFERENCES employees(id),
  return_approved_at    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_absence_type
    CHECK (absence_type IN ('injury', 'childcare', 'nursing', 'other')),
  CONSTRAINT chk_loa_status
    CHECK (status IN ('pending', 'on_leave', 'return_pending', 'returned', 'rejected')),
  CONSTRAINT chk_loa_dates
    CHECK (expected_return_date >= start_date)
);

CREATE INDEX idx_leave_of_absence_employee ON leave_of_absence(employee_id);
CREATE INDEX idx_leave_of_absence_status ON leave_of_absence(status);

CREATE TRIGGER trg_leave_of_absence_updated_at
  BEFORE UPDATE ON leave_of_absence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE leave_of_absence IS '社員の休職届・復職届。承認時に社員ステータスを自動更新。';
