-- ====================================================================
-- 026: アサインに超過/控除の1時間あたり単価を追加
-- ====================================================================
-- 案件によって超過・控除の単価が contract_price / settlement_upper(lower)
-- では決まらないケースがあるため、案件別に明示設定可能にする。
-- NULL の場合は従来通り自動計算（後方互換）。
-- ====================================================================

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS overtime_rate  INTEGER NULL,
  ADD COLUMN IF NOT EXISTS deduction_rate INTEGER NULL;

COMMENT ON COLUMN assignments.overtime_rate  IS '超過時の1時間あたり請求単価（円）。NULLなら contract_price / settlement_upper で自動計算';
COMMENT ON COLUMN assignments.deduction_rate IS '控除時の1時間あたり控除単価（円）。NULLなら contract_price / settlement_lower で自動計算';

ALTER TABLE assignment_rate_history
  ADD COLUMN IF NOT EXISTS overtime_rate  INTEGER NULL,
  ADD COLUMN IF NOT EXISTS deduction_rate INTEGER NULL;
