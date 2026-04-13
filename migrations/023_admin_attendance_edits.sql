-- 023: 管理者による勤怠修正履歴 + 社員異議申し立てフロー
-- admin_attendance_edits テーブルと notifications.metadata カラムを追加

BEGIN;

CREATE TABLE admin_attendance_edits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id     UUID NOT NULL REFERENCES attendances(id),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  admin_user_id     UUID NOT NULL REFERENCES users(id),
  work_date         DATE NOT NULL,
  old_clock_in      TIMESTAMPTZ,
  old_clock_out     TIMESTAMPTZ,
  old_break_minutes INT,
  new_clock_in      TIMESTAMPTZ,
  new_clock_out     TIMESTAMPTZ,
  new_break_minutes INT,
  modified_fields   TEXT[] NOT NULL DEFAULT '{}',
  reason            TEXT NOT NULL,
  objection_status  VARCHAR(20) NOT NULL DEFAULT 'none',
  objection_reason  TEXT,
  objection_at      TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_edits_employee ON admin_attendance_edits(employee_id);
CREATE INDEX idx_admin_edits_attendance ON admin_attendance_edits(attendance_id);
CREATE INDEX idx_admin_edits_objection ON admin_attendance_edits(employee_id, objection_status)
  WHERE objection_status = 'objected';

-- notifications テーブルに metadata カラム追加
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMIT;
