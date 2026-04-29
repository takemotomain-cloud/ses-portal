-- 020: 退職日の運用化（既存の resign_date カラムを活用）
-- 自動退職処理 + 2ヶ月後ログイン停止 機能のための準備
BEGIN;

-- 既存の退職済み社員に退職日を投入（resign_date が NULL のものに対して）
-- (2ヶ月以上前 → 既にログイン停止対象として扱われる)
UPDATE employees
SET resign_date = '2024-01-01'
WHERE status = 'resigned'
  AND resign_date IS NULL;

-- 自動退職cron用インデックス
CREATE INDEX IF NOT EXISTS idx_employees_resign_date
  ON employees(resign_date)
  WHERE resign_date IS NOT NULL AND deleted_at IS NULL;

COMMIT;
