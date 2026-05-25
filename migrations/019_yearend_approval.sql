-- 019: 年末調整の承認・差し戻しフロー追加
BEGIN;

-- CHECK制約を更新（approved, rejected 追加）
ALTER TABLE yearend_adjustments
  DROP CONSTRAINT IF EXISTS chk_yearend_status;

ALTER TABLE yearend_adjustments
  ADD CONSTRAINT chk_yearend_status
    CHECK (status IN ('open', 'submitted', 'closed', 'approved', 'rejected'));

-- 承認・差し戻し用カラム追加
ALTER TABLE yearend_adjustments
  ADD COLUMN IF NOT EXISTS approved_by   UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT;

COMMIT;
