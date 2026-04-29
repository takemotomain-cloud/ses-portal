-- ============================================================
-- Migration 006: Request & Approval Tables
-- ============================================================
-- 何をするか: 有給申請・有給残管理・交通費申請・個人情報変更申請テーブルを作成
-- なぜ: 社員→申請→管理者承認の承認フロー基盤
-- 注意: leave_balancesは付与ロット単位で先入先出消化
--       change_requestsは承認後にemployeesテーブルへ反映する
-- ============================================================

BEGIN;

-- ----------------------------------------
-- leave_balances: 有給残日数（付与ロット管理）
-- ----------------------------------------
-- 有給休暇の付与・消化を付与単位で管理。
-- 消化は付与日が古い順（先入先出 = FIFO）で行う。
CREATE TABLE leave_balances (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID          NOT NULL REFERENCES employees(id),
  granted_date    DATE          NOT NULL,
  expiry_date     DATE          NOT NULL,
  granted_days    DECIMAL(4,1)  NOT NULL,
  used_days       DECIMAL(4,1)  NOT NULL DEFAULT 0,
  remaining_days  DECIMAL(4,1)  GENERATED ALWAYS AS (granted_days - used_days) STORED,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_leave_bal_days CHECK (used_days >= 0 AND used_days <= granted_days),
  CONSTRAINT chk_leave_bal_granted CHECK (granted_days > 0)
);

CREATE INDEX idx_leave_bal_employee ON leave_balances(employee_id);
CREATE INDEX idx_leave_bal_expiry   ON leave_balances(expiry_date);

CREATE TRIGGER trg_leave_bal_updated_at
  BEFORE UPDATE ON leave_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE leave_balances IS '有給残日数。付与ロット単位管理。先入先出で消化';
COMMENT ON COLUMN leave_balances.remaining_days IS '残日数。generated columnで自動計算';
COMMENT ON COLUMN leave_balances.expiry_date IS '消滅日。労基法に基づき付与日から2年';

-- ----------------------------------------
-- leave_requests: 有給休暇申請
-- ----------------------------------------
CREATE TABLE leave_requests (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID          NOT NULL REFERENCES employees(id),
  leave_type    VARCHAR(20)   NOT NULL,
  start_date    DATE          NOT NULL,
  end_date      DATE          NOT NULL,
  days          DECIMAL(3,1)  NOT NULL,
  reason        TEXT,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
  approver_id   UUID          REFERENCES employees(id),
  approved_at   TIMESTAMPTZ,
  reject_reason TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_leave_req_type
    CHECK (leave_type IN ('full_day', 'am_half', 'pm_half', 'special')),
  CONSTRAINT chk_leave_req_status
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT chk_leave_req_dates
    CHECK (end_date >= start_date),
  CONSTRAINT chk_leave_req_days
    CHECK (days > 0)
);

CREATE INDEX idx_leave_req_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_req_status   ON leave_requests(status) WHERE status = 'pending';

CREATE TRIGGER trg_leave_req_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE leave_requests IS '有給休暇申請。承認時にleave_balancesのused_daysを加算（FIFO）';

-- ----------------------------------------
-- expense_requests: 交通費・経費申請（ヘッダー）
-- ----------------------------------------
CREATE TABLE expense_requests (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID          NOT NULL REFERENCES employees(id),
  target_month  VARCHAR(7)    NOT NULL,
  total_amount  INTEGER       NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
  approver_id   UUID          REFERENCES employees(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_expense_req_status
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT chk_expense_req_month
    CHECK (target_month ~ '^\d{4}-\d{2}$'),
  CONSTRAINT chk_expense_req_amount
    CHECK (total_amount >= 0)
);

CREATE INDEX idx_expense_req_employee ON expense_requests(employee_id);
CREATE INDEX idx_expense_req_status   ON expense_requests(status) WHERE status = 'pending';

CREATE TRIGGER trg_expense_req_updated_at
  BEFORE UPDATE ON expense_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE expense_requests IS '交通費・経費申請ヘッダー。明細はexpense_itemsに格納';

-- ----------------------------------------
-- expense_items: 経費明細行
-- ----------------------------------------
CREATE TABLE expense_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_request_id  UUID          NOT NULL REFERENCES expense_requests(id) ON DELETE CASCADE,
  expense_date        DATE          NOT NULL,
  departure           VARCHAR(100)  NOT NULL,
  destination         VARCHAR(100)  NOT NULL,
  amount              INTEGER       NOT NULL,
  sort_order          INTEGER       NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_expense_item_amount CHECK (amount > 0)
);

CREATE INDEX idx_expense_items_request ON expense_items(expense_request_id);

CREATE TRIGGER trg_expense_items_updated_at
  BEFORE UPDATE ON expense_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE expense_items IS '経費明細行。expense_requestsに紐づく。親削除時にCASCADE';

-- ----------------------------------------
-- change_requests: 個人情報変更申請
-- ----------------------------------------
-- 住所・口座・扶養・緊急連絡先の変更を申請。
-- 承認後にアプリ層でold_value/new_valueの差分をemployeesに反映する。
CREATE TABLE change_requests (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID          NOT NULL REFERENCES employees(id),
  change_type   VARCHAR(30)   NOT NULL,
  old_value     JSONB         NOT NULL,
  new_value     JSONB         NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
  approver_id   UUID          REFERENCES employees(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_change_req_type
    CHECK (change_type IN ('address', 'bank', 'dependent', 'emergency')),
  CONSTRAINT chk_change_req_status
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_change_req_employee ON change_requests(employee_id);
CREATE INDEX idx_change_req_status   ON change_requests(status) WHERE status = 'pending';

CREATE TRIGGER trg_change_req_updated_at
  BEFORE UPDATE ON change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE change_requests IS '個人情報変更申請。承認後にemployeesテーブルへ差分反映';
COMMENT ON COLUMN change_requests.old_value IS '変更前の値。JSONB形式で変更対象フィールドを保持';
COMMENT ON COLUMN change_requests.new_value IS '変更後の値。承認時にアプリ層でemployeesに適用';

COMMIT;

-- DOWN (ロールバック)
-- BEGIN;
-- DROP TABLE IF EXISTS change_requests CASCADE;
-- DROP TABLE IF EXISTS expense_items CASCADE;
-- DROP TABLE IF EXISTS expense_requests CASCADE;
-- DROP TABLE IF EXISTS leave_requests CASCADE;
-- DROP TABLE IF EXISTS leave_balances CASCADE;
-- COMMIT;
