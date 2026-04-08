-- 016: Projectに契約関連フィールドを追加
-- 案件を「契約条件の箱」として扱うため、デフォルト契約条件を保持する

ALTER TABLE projects ADD COLUMN contract_price INTEGER;
ALTER TABLE projects ADD COLUMN reward_rate VARCHAR(10);
ALTER TABLE projects ADD COLUMN settlement_lower INTEGER;
ALTER TABLE projects ADD COLUMN settlement_upper INTEGER;
ALTER TABLE projects ADD COLUMN supply_chain VARCHAR(20);

COMMENT ON COLUMN projects.contract_price IS 'デフォルト契約単価（月額）';
COMMENT ON COLUMN projects.reward_rate IS '還元率';
COMMENT ON COLUMN projects.settlement_lower IS '精算幅（下限）';
COMMENT ON COLUMN projects.settlement_upper IS '精算幅（上限）';
COMMENT ON COLUMN projects.supply_chain IS '商流（一次請け/二次請け等）';
