-- ============================================================
-- Migration 021: Role 階層刷新 + 検証用テストユーザー投入
-- ============================================================
-- 何をするか:
--   (1) users.role の CHECK 制約を admin/sales/accounting/employee から
--       admin/manager/member/employee に差し替える
--   (2) 既存データの 'sales' / 'accounting' を 'manager' に移行（保険。通常 no-op）
--   (3) E2E 検証用のテストユーザー 3 人を追加
--       - manager@example.com  (role=manager, 管理部)
--       - member@example.com   (role=member,  管理部)
--       - ses-staff@example.com (role=employee, SES事業部)
--
-- なぜ:
--   E（権限・ロール定義）で admin/manager/member/employee の 4 階層に刷新。
--   旧スキーマの CHECK 制約が残っていると manager/member の INSERT/UPDATE が
--   CHECK 違反で失敗するため、本 migration で差し替える。
--   テストユーザーは 4 ロール全ての動作検証に必要。
--
-- 注意:
--   ★ dev / staging 環境専用 ★
--   本 migration の (3) は検証用テストユーザーの投入であり、
--   本番環境には決して流さないこと。
--   (1) の CHECK 制約差し替えは本番にも適用必須。
--   本番デプロイ時はこのファイルを CHECK 制約部分のみに分割するか、
--   テストユーザー INSERT をコメントアウトすること。
--
--   パスワードは全員 "ChangeMe123!" (008_seed_data.sql と同じ bcrypt ハッシュ)。
--   初回ログイン時に変更すること。
-- ============================================================

BEGIN;

-- ----------------------------------------
-- (1) users.role の CHECK 制約を差し替え
-- ----------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role
  CHECK (role::text = ANY (ARRAY['admin','manager','member','employee']::varchar[]));

-- ----------------------------------------
-- (2) 既存データの sales/accounting を manager に移行（保険）
-- ----------------------------------------
UPDATE users SET role = 'manager' WHERE role IN ('sales', 'accounting');

-- ----------------------------------------
-- (3) 検証用テストユーザー投入（dev / staging 専用）
-- ----------------------------------------
-- パスワードハッシュは "ChangeMe123!" の bcrypt(cost=12) 値（008_seed_data.sql と同一）
-- 既存に同じ id / employee_code / email がある場合はスキップ（冪等化）

-- manager: 田中 太郎 (管理部)
INSERT INTO employees (
  id, employee_code, last_name, first_name,
  last_name_kana, first_name_kana,
  birth_date, gender, hire_date,
  employment_type, contract_type, status,
  department_id, position_id, email
) VALUES (
  'eeee0001-0000-0000-0000-000000000001',
  'EMP-T01', '田中', '太郎',
  'タナカ', 'タロウ',
  '1985-06-20', 'male', '2021-04-01',
  'regular', 'indefinite', 'active',
  'd0000001-0000-0000-0000-000000000005',  -- 管理部
  'a0000001-0000-0000-0000-000000000002',  -- 課長
  'manager@example.com'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, employee_id, password_hash, role) VALUES (
  'bbbb0001-0000-0000-0000-000000000001',
  'eeee0001-0000-0000-0000-000000000001',
  '$2b$12$hqj2Cl7eIiYtaiheS.HyKOtean3ufWa/a2Lo7A5XbQNHGeXcklFWi',
  'manager'
)
ON CONFLICT (id) DO NOTHING;

-- member: 鈴木 花子 (管理部)
INSERT INTO employees (
  id, employee_code, last_name, first_name,
  last_name_kana, first_name_kana,
  birth_date, gender, hire_date,
  employment_type, contract_type, status,
  department_id, position_id, email
) VALUES (
  'eeee0001-0000-0000-0000-000000000002',
  'EMP-T02', '鈴木', '花子',
  'スズキ', 'ハナコ',
  '1990-09-10', 'female', '2022-04-01',
  'regular', 'indefinite', 'active',
  'd0000001-0000-0000-0000-000000000005',  -- 管理部
  'a0000001-0000-0000-0000-000000000004',  -- 一般
  'member@example.com'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, employee_id, password_hash, role) VALUES (
  'bbbb0001-0000-0000-0000-000000000002',
  'eeee0001-0000-0000-0000-000000000002',
  '$2b$12$hqj2Cl7eIiYtaiheS.HyKOtean3ufWa/a2Lo7A5XbQNHGeXcklFWi',
  'member'
)
ON CONFLICT (id) DO NOTHING;

-- employee (SES 事業部): 佐藤 次郎
INSERT INTO employees (
  id, employee_code, last_name, first_name,
  last_name_kana, first_name_kana,
  birth_date, gender, hire_date,
  employment_type, contract_type, status,
  department_id, position_id, email
) VALUES (
  'eeee0001-0000-0000-0000-000000000003',
  'EMP-T03', '佐藤', '次郎',
  'サトウ', 'ジロウ',
  '1992-03-25', 'male', '2023-04-01',
  'regular', 'indefinite', 'active',
  'd0000001-0000-0000-0000-000000000001',  -- SES事業部
  'a0000001-0000-0000-0000-000000000004',  -- 一般
  'ses-staff@example.com'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, employee_id, password_hash, role) VALUES (
  'bbbb0001-0000-0000-0000-000000000003',
  'eeee0001-0000-0000-0000-000000000003',
  '$2b$12$hqj2Cl7eIiYtaiheS.HyKOtean3ufWa/a2Lo7A5XbQNHGeXcklFWi',
  'employee'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================
-- DOWN (ロールバック)
-- ============================================================
-- BEGIN;
-- DELETE FROM users WHERE id IN (
--   'bbbb0001-0000-0000-0000-000000000001',
--   'bbbb0001-0000-0000-0000-000000000002',
--   'bbbb0001-0000-0000-0000-000000000003'
-- );
-- DELETE FROM employees WHERE id IN (
--   'eeee0001-0000-0000-0000-000000000001',
--   'eeee0001-0000-0000-0000-000000000002',
--   'eeee0001-0000-0000-0000-000000000003'
-- );
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
-- ALTER TABLE users ADD CONSTRAINT chk_users_role
--   CHECK (role::text = ANY (ARRAY['admin','sales','accounting','employee']::varchar[]));
-- COMMIT;
