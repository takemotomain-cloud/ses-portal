-- ============================================================
-- Migration 002: Core Master Tables (departments, positions, employees)
-- ============================================================
-- 何をするか: 部署・役職・社員マスタテーブルを作成
-- なぜ: システム全体の基盤。他の全テーブルがemployeesを参照する
-- 注意: employees.my_numberは最重要個人情報。本番ではpgcrypto暗号化を適用
-- セキュリティ: 暗号化対象カラムにコメントで明示
-- ============================================================

BEGIN;

-- ----------------------------------------
-- departments: 部署マスタ（階層構造）
-- ----------------------------------------
CREATE TABLE departments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  parent_id     UUID        REFERENCES departments(id) ON DELETE SET NULL,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_departments_code UNIQUE (code)
);

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE departments IS '部署マスタ。parent_idによる自己参照で階層構造を表現';
COMMENT ON COLUMN departments.parent_id IS '親部署。NULLはトップレベル部署';

-- ----------------------------------------
-- positions: 役職マスタ
-- ----------------------------------------
CREATE TABLE positions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(50) NOT NULL,
  rank          INTEGER     NOT NULL,
  has_approval  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE positions IS '役職マスタ。rankが小さいほど上位。has_approvalで承認権限を管理';

-- ----------------------------------------
-- employees: 社員マスタ（システム中核）
-- ----------------------------------------
CREATE TABLE employees (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code         VARCHAR(20)   NOT NULL,
  last_name             VARCHAR(50)   NOT NULL,
  first_name            VARCHAR(50)   NOT NULL,
  last_name_kana        VARCHAR(50)   NOT NULL,
  first_name_kana       VARCHAR(50)   NOT NULL,
  birth_date            DATE          NOT NULL,
  gender                VARCHAR(10)   NOT NULL,
  hire_date             DATE          NOT NULL,
  resign_date           DATE,
  employment_type       VARCHAR(20)   NOT NULL,
  contract_type         VARCHAR(20)   NOT NULL DEFAULT 'fixed_term',
  status                VARCHAR(20)   NOT NULL DEFAULT 'active',
  department_id         UUID          NOT NULL REFERENCES departments(id),
  position_id           UUID          REFERENCES positions(id),
  email                 VARCHAR(255)  NOT NULL,
  phone                 VARCHAR(20),               -- 暗号化対象
  address               TEXT,                      -- 暗号化対象
  postal_code           VARCHAR(10),
  education             VARCHAR(30),
  school_name           VARCHAR(100),
  base_salary           INTEGER,                   -- 暗号化検討
  reward_rate           DECIMAL(5,2),
  bank_name             VARCHAR(100),              -- 暗号化対象
  bank_branch           VARCHAR(100),              -- 暗号化対象
  bank_account_type     VARCHAR(10),
  bank_account_number   VARCHAR(20),               -- 暗号化対象
  bank_account_holder   VARCHAR(100),              -- 暗号化対象
  my_number             VARCHAR(12),               -- 必ず暗号化。アクセスログ必須
  has_bonus             BOOLEAN       NOT NULL DEFAULT FALSE,
  profile_image_path    VARCHAR(500),
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- 一意制約
  CONSTRAINT uq_employees_code  UNIQUE (employee_code),
  CONSTRAINT uq_employees_email UNIQUE (email),

  -- CHECK制約: ENUM値をDB側で担保
  CONSTRAINT chk_employees_gender
    CHECK (gender IN ('male', 'female', 'other')),
  CONSTRAINT chk_employees_employment_type
    CHECK (employment_type IN ('regular', 'contract', 'part_time')),
  CONSTRAINT chk_employees_contract_type
    CHECK (contract_type IN ('fixed_term', 'indefinite')),
  CONSTRAINT chk_employees_status
    CHECK (status IN ('active', 'leave', 'resigned')),
  CONSTRAINT chk_employees_education
    CHECK (education IS NULL OR education IN (
      'university', 'grad_school', 'vocational', 'junior_college',
      'technical_college', 'high_school'
    )),
  CONSTRAINT chk_employees_bank_account_type
    CHECK (bank_account_type IS NULL OR bank_account_type IN ('ordinary', 'current'))
);

-- インデックス
CREATE INDEX idx_employees_department  ON employees(department_id);
CREATE INDEX idx_employees_status      ON employees(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_code        ON employees(employee_code);

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE employees IS '社員マスタ。システム全体の中核テーブル。論理削除(deleted_at)を採用';
COMMENT ON COLUMN employees.employee_code IS '社員番号。EMP-001形式。全システム共通ID';
COMMENT ON COLUMN employees.contract_type IS '雇用区分。無期転換通知書送付後にfixed_term→indefiniteに変更';
COMMENT ON COLUMN employees.reward_rate IS '還元率(%)。契約単価×還元率=月額給与の基礎';
COMMENT ON COLUMN employees.my_number IS 'マイナンバー。必ずpgcrypto暗号化。アクセスはaudit_logsに記録必須';
COMMENT ON COLUMN employees.phone IS '暗号化対象';
COMMENT ON COLUMN employees.address IS '暗号化対象';
COMMENT ON COLUMN employees.bank_name IS '暗号化対象';
COMMENT ON COLUMN employees.bank_branch IS '暗号化対象';
COMMENT ON COLUMN employees.bank_account_number IS '暗号化対象';
COMMENT ON COLUMN employees.bank_account_holder IS '暗号化対象';

COMMIT;

-- DOWN (ロールバック)
-- BEGIN;
-- DROP TABLE IF EXISTS employees CASCADE;
-- DROP TABLE IF EXISTS positions CASCADE;
-- DROP TABLE IF EXISTS departments CASCADE;
-- COMMIT;
