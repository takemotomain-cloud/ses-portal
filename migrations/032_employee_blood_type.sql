-- 032: employees に血液型カラムを追加
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10);

COMMENT ON COLUMN employees.blood_type IS '血液型';
