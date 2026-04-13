-- ============================================================
-- 022: 月次勤怠確定テーブル（attendance_monthly_closures）
--
-- 給与計算の前提条件として使用。
-- 管理者が月の勤怠を一括確定し、確定後に給与計算を実行可能にする。
-- admin（役員）は勤怠免除。
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS attendance_monthly_closures (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month              VARCHAR(7)    NOT NULL UNIQUE,
  status                  VARCHAR(20)   NOT NULL DEFAULT 'open',
  closed_at               TIMESTAMPTZ,
  closed_by               UUID          REFERENCES employees(id) ON DELETE SET NULL,
  reopened_at             TIMESTAMPTZ,
  reopened_by             UUID          REFERENCES employees(id) ON DELETE SET NULL,
  has_post_close_changes  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_closure_status
    CHECK (status IN ('open', 'closed'))
);

-- updated_at 自動更新トリガー
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attendance_monthly_closures_updated_at'
  ) THEN
    CREATE TRIGGER trg_attendance_monthly_closures_updated_at
      BEFORE UPDATE ON attendance_monthly_closures
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

COMMENT ON TABLE attendance_monthly_closures IS '月次勤怠確定。給与計算の前提条件。year_month でユニーク管理';
COMMENT ON COLUMN attendance_monthly_closures.has_post_close_changes IS '確定後に修正申請が承認された場合 true。給与計算画面で警告表示に使用';

COMMIT;
