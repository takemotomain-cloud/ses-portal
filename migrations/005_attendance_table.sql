-- ============================================================
-- Migration 005: Attendance Table
-- ============================================================
-- 何をするか: 日次勤怠テーブルを作成
-- なぜ: 出退勤打刻・稼働時間・残業の記録。給与計算と請求の基礎データ
-- 注意: (employee_id, work_date)でユニーク。1人1日1レコード
-- ============================================================

BEGIN;

CREATE TABLE attendances (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID          NOT NULL REFERENCES employees(id),
  work_date         DATE          NOT NULL,
  clock_in          TIMESTAMPTZ,
  clock_out         TIMESTAMPTZ,
  break_minutes     INTEGER       NOT NULL DEFAULT 60,
  work_minutes      INTEGER,
  overtime_minutes  INTEGER,
  status            VARCHAR(20)   NOT NULL DEFAULT 'normal',
  is_missed_clock   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- 1社員・1日に1レコードのみ
  CONSTRAINT uq_attendance_emp_date UNIQUE (employee_id, work_date),

  CONSTRAINT chk_attendance_status
    CHECK (status IN ('normal', 'absent', 'paid_leave', 'special_leave', 'missed', 'confirmed')),
  CONSTRAINT chk_attendance_break
    CHECK (break_minutes >= 0 AND break_minutes <= 480),
  CONSTRAINT chk_attendance_clock_order
    CHECK (clock_out IS NULL OR clock_in IS NULL OR clock_out > clock_in)
);

CREATE INDEX idx_attendance_date    ON attendances(work_date);
CREATE INDEX idx_attendance_missed  ON attendances(is_missed_clock) WHERE is_missed_clock = TRUE;

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE attendances IS '日次勤怠レコード。出退勤打刻時に作成。休憩変更で稼働・残業を再計算';
COMMENT ON COLUMN attendances.work_minutes IS '実働時間（分）。退勤打刻時に自動計算: (clock_out - clock_in) - break_minutes';
COMMENT ON COLUMN attendances.overtime_minutes IS '残業時間（分）。work_minutes - 480（所定8時間）の超過分';
COMMENT ON COLUMN attendances.is_missed_clock IS '打刻漏れフラグ。ホーム画面のアラートに使用';

COMMIT;

-- DOWN (ロールバック)
-- BEGIN;
-- DROP TABLE IF EXISTS attendances CASCADE;
-- COMMIT;
