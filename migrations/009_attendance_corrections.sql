-- ============================================================
-- Migration 009: Attendance Corrections (勤怠修正申請)
-- ============================================================
-- 何をするか: 社員が勤怠データの修正を申請し、管理者承認で確定する仕組み
-- なぜ: 打刻ミスや休憩時間の修正を承認フローで管理する
-- パターン: leave_requests / expense_requests と同じ pending → approved/rejected フロー
-- ============================================================

BEGIN;

CREATE TABLE attendance_corrections (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id          UUID          NOT NULL REFERENCES attendances(id),
  employee_id            UUID          NOT NULL REFERENCES employees(id),

  -- 修正前の値（差分比較用）
  original_clock_in      TIMESTAMPTZ,
  original_clock_out     TIMESTAMPTZ,
  original_break_minutes INTEGER,

  -- 修正後の値
  new_clock_in           TIMESTAMPTZ,
  new_clock_out          TIMESTAMPTZ,
  new_break_minutes      INTEGER,

  -- 申請情報
  reason                 TEXT          NOT NULL,
  status                 VARCHAR(20)   NOT NULL DEFAULT 'pending',

  -- 承認情報
  approver_id            UUID          REFERENCES employees(id),
  approved_at            TIMESTAMPTZ,
  reject_reason          TEXT,

  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_correction_status
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT chk_correction_break
    CHECK (new_break_minutes IS NULL OR (new_break_minutes >= 0 AND new_break_minutes <= 480))
);

-- 社員ごとの修正申請一覧（自分の申請履歴）
CREATE INDEX idx_correction_employee ON attendance_corrections (employee_id, created_at DESC);

-- 管理者用：未処理一覧
CREATE INDEX idx_correction_pending ON attendance_corrections (status) WHERE status = 'pending';

-- updated_at 自動更新トリガー
CREATE TRIGGER trg_attendance_corrections_updated
  BEFORE UPDATE ON attendance_corrections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
