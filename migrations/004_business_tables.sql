-- ============================================================
-- Migration 004: Business Tables (clients, assignments)
-- ============================================================
-- 何をするか: クライアント・アサイン（稼働案件）テーブルを作成
-- なぜ: SES事業の中核データ。単価・精算幅・エリアで売上・稼働率を管理
-- 注意: assignments.areaはwork_locationからの非正規化（検索性のため）
-- ============================================================

BEGIN;

-- ----------------------------------------
-- clients: 取引先マスタ
-- ----------------------------------------
CREATE TABLE clients (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(200)  NOT NULL,
  industry          VARCHAR(50),
  contact_person    VARCHAR(100),
  contact_email     VARCHAR(255),
  contact_phone     VARCHAR(20),
  address           TEXT,
  trade_flow        VARCHAR(50),
  billing_email     VARCHAR(255),
  trade_start_date  DATE,
  freee_partner_id  VARCHAR(50),
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE clients IS '取引先マスタ。論理削除あり。freee_partner_idでfreee会計と連携';
COMMENT ON COLUMN clients.trade_flow IS '商流。例: エンド→自社, エンド→1社→自社';

-- ----------------------------------------
-- assignments: アサイン（稼働案件）
-- ----------------------------------------
-- SES事業のコア。1社員が時期をずらして複数アサインを持てる。
-- 契約終了日の接近で色付きアラートを表示（30日以内=アンバー、7日以内=赤）
CREATE TABLE assignments (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID          NOT NULL REFERENCES employees(id),
  client_id         UUID          NOT NULL REFERENCES clients(id),
  project_name      VARCHAR(200)  NOT NULL,
  contract_price    INTEGER       NOT NULL,
  settlement_lower  INTEGER       NOT NULL,
  settlement_upper  INTEGER       NOT NULL,
  work_location     VARCHAR(200),
  area              VARCHAR(20),
  start_date        DATE          NOT NULL,
  end_date          DATE,
  status            VARCHAR(20)   NOT NULL DEFAULT 'active',
  end_reason        VARCHAR(30),
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_assignments_area
    CHECK (area IS NULL OR area IN ('tokyo', 'osaka', 'nagoya')),
  CONSTRAINT chk_assignments_status
    CHECK (status IN ('active', 'next_confirmed', 'ended', 'standby')),
  CONSTRAINT chk_assignments_end_reason
    CHECK (end_reason IS NULL OR end_reason IN (
      'term_end', 'client_reason', 'self_reason', 'other'
    )),
  CONSTRAINT chk_assignments_settlement
    CHECK (settlement_lower <= settlement_upper)
);

CREATE INDEX idx_assignments_employee  ON assignments(employee_id);
CREATE INDEX idx_assignments_client    ON assignments(client_id);
CREATE INDEX idx_assignments_status    ON assignments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_end_date  ON assignments(end_date) WHERE status = 'active';

CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE assignments IS 'アサイン（稼働案件）。SES事業の中核。1社員が複数アサインを持てる';
COMMENT ON COLUMN assignments.contract_price IS '契約単価（円/月）。employees.reward_rateを乗じて月額給与を算定';
COMMENT ON COLUMN assignments.settlement_lower IS '精算幅 下限（時間）。例: 140h';
COMMENT ON COLUMN assignments.settlement_upper IS '精算幅 上限（時間）。例: 180h';
COMMENT ON COLUMN assignments.area IS 'エリア。work_locationから自動判定も可能だが、検索性のため非正規化して保持';
COMMENT ON COLUMN assignments.end_reason IS '終了理由。稼働終了時に選択必須';

COMMIT;

-- DOWN (ロールバック)
-- BEGIN;
-- DROP TABLE IF EXISTS assignments CASCADE;
-- DROP TABLE IF EXISTS clients CASCADE;
-- COMMIT;
