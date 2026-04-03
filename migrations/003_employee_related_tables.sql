-- ============================================================
-- Migration 003: Employee Related Tables
--   (emergency_contacts, dependents, users)
-- ============================================================
-- 何をするか: 緊急連絡先・扶養家族・認証ユーザーテーブルを作成
-- なぜ: employeesに1:Nで紐づく付随情報。usersは認証基盤
-- セキュリティ: emergency_contactsのname/phoneは暗号化対象
--              users.password_hashはbcrypt（cost 12+）で生成
-- ============================================================

BEGIN;

-- ----------------------------------------
-- emergency_contacts: 緊急連絡先（社員ごとに最大2件）
-- ----------------------------------------
CREATE TABLE emergency_contacts (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID          NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  sort_order    INTEGER       NOT NULL DEFAULT 1,
  name          VARCHAR(100)  NOT NULL,    -- 暗号化対象
  relationship  VARCHAR(30)   NOT NULL,
  phone         VARCHAR(20)   NOT NULL,    -- 暗号化対象
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_emergency_sort CHECK (sort_order IN (1, 2))
);

CREATE INDEX idx_emergency_employee ON emergency_contacts(employee_id);

CREATE TRIGGER trg_emergency_updated_at
  BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE emergency_contacts IS '緊急連絡先。社員ごとに最大2件。name/phoneは暗号化対象';

-- ----------------------------------------
-- dependents: 扶養家族
-- ----------------------------------------
CREATE TABLE dependents (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID          NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name            VARCHAR(100)  NOT NULL,
  relationship    VARCHAR(30)   NOT NULL,
  birth_date      DATE          NOT NULL,
  annual_income   INTEGER,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dependents_employee ON dependents(employee_id);

CREATE TRIGGER trg_dependents_updated_at
  BEFORE UPDATE ON dependents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE dependents IS '扶養家族。年末調整・社会保険で参照。論理削除あり';

-- ----------------------------------------
-- users: 認証ユーザー（NextAuth.js + JWT）
-- ----------------------------------------
-- employees と 1:1。ログイン認証に特化したテーブル。
-- 個人情報はemployeesに持ち、認証に必要な情報のみここに保持。
CREATE TABLE users (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID          NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  password_hash         VARCHAR(255)  NOT NULL,
  role                  VARCHAR(20)   NOT NULL DEFAULT 'employee',
  is_locked             BOOLEAN       NOT NULL DEFAULT FALSE,
  failed_login_count    INTEGER       NOT NULL DEFAULT 0,
  last_login_at         TIMESTAMPTZ,
  password_changed_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_users_employee UNIQUE (employee_id),
  CONSTRAINT chk_users_role
    CHECK (role IN ('admin', 'sales', 'accounting', 'employee'))
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS '認証ユーザー。employeesと1:1。bcrypt(cost 12+)でパスワード保存';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash。平文/MD5/SHA単体は禁止';
COMMENT ON COLUMN users.is_locked IS '5回連続ログイン失敗でTRUE。管理者が手動解除';
COMMENT ON COLUMN users.role IS 'admin=全権限, sales=営業系, accounting=経理系, employee=マイページのみ';

COMMIT;

-- DOWN (ロールバック)
-- BEGIN;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS dependents CASCADE;
-- DROP TABLE IF EXISTS emergency_contacts CASCADE;
-- COMMIT;
