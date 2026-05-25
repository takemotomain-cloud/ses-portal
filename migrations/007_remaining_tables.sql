-- ============================================================
-- Migration 007: Payroll, Notifications, Rules, Certificates,
--                Year-End Adjustment, Audit Logs
-- ============================================================
-- 何をするか: 残りの全テーブル（6テーブル）を一括作成
-- なぜ: 給与・通知・就業規則・証明書・年末調整・操作ログ
-- 注意: audit_logsは大量データが蓄積されるためパーティショニングを検討
-- ============================================================

BEGIN;

-- ----------------------------------------
-- payrolls: 月次給与データ
-- ----------------------------------------
CREATE TABLE payrolls (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID          NOT NULL REFERENCES employees(id),
  target_month          VARCHAR(7)    NOT NULL,
  base_salary           INTEGER       NOT NULL,
  overtime_pay          INTEGER       NOT NULL DEFAULT 0,
  commute_allowance     INTEGER       NOT NULL DEFAULT 0,
  other_allowance       INTEGER       NOT NULL DEFAULT 0,
  gross_salary          INTEGER       NOT NULL,
  health_insurance      INTEGER       NOT NULL DEFAULT 0,
  pension               INTEGER       NOT NULL DEFAULT 0,
  employment_insurance  INTEGER       NOT NULL DEFAULT 0,
  income_tax            INTEGER       NOT NULL DEFAULT 0,
  resident_tax          INTEGER       NOT NULL DEFAULT 0,
  total_deductions      INTEGER       NOT NULL,
  net_salary            INTEGER       NOT NULL,
  status                VARCHAR(20)   NOT NULL DEFAULT 'draft',
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_payroll_emp_month UNIQUE (employee_id, target_month),
  CONSTRAINT chk_payroll_status
    CHECK (status IN ('draft', 'confirmed', 'paid')),
  CONSTRAINT chk_payroll_month
    CHECK (target_month ~ '^\d{4}-\d{2}$')
);

CREATE TRIGGER trg_payrolls_updated_at
  BEFORE UPDATE ON payrolls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payrolls IS '月次給与データ。勤怠締め→計算→確認→確定→振込のステップで管理';
COMMENT ON COLUMN payrolls.gross_salary IS '総支給額 = base_salary + overtime_pay + commute_allowance + other_allowance';
COMMENT ON COLUMN payrolls.net_salary IS '差引支給額 = gross_salary - total_deductions';

-- ----------------------------------------
-- notifications: 社員向け通知
-- ----------------------------------------
CREATE TABLE notifications (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID          NOT NULL REFERENCES employees(id),
  title         VARCHAR(200)  NOT NULL,
  body          TEXT          NOT NULL,
  category      VARCHAR(30),
  is_read       BOOLEAN       NOT NULL DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_employee ON notifications(employee_id);
CREATE INDEX idx_notifications_unread   ON notifications(employee_id, is_read) WHERE is_read = FALSE;

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE notifications IS '社員向け通知。承認結果・給与確定・契約更新等を配信';

-- ----------------------------------------
-- work_rules: 就業規則バージョン管理
-- ----------------------------------------
-- 管理側で編集・公開すると新レコードを作成。
-- is_current=TRUE は常に1レコードのみ（トランザクションで切替）。
-- contentはJSONBで章・条文構造を保持（UIのrulesDataと同じ形式）。
CREATE TABLE work_rules (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  version         VARCHAR(20)   NOT NULL,
  effective_date  DATE          NOT NULL,
  content         JSONB         NOT NULL,
  memo            TEXT,
  is_current      BOOLEAN       NOT NULL DEFAULT FALSE,
  published_by    UUID          NOT NULL REFERENCES employees(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_work_rules_updated_at
  BEFORE UPDATE ON work_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE work_rules IS '就業規則バージョン管理。is_current=TRUEが現行版（1レコードのみ）';
COMMENT ON COLUMN work_rules.content IS 'JSONB。[{title:"第1章...",articles:[{num,name,text},...]},...] の配列構造';

-- ----------------------------------------
-- certificates: 証明書発行管理
-- ----------------------------------------
CREATE TABLE certificates (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID          NOT NULL REFERENCES employees(id),
  cert_type     VARCHAR(30)   NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
  file_path     VARCHAR(500),
  issued_at     TIMESTAMPTZ,
  issued_by     UUID          REFERENCES employees(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_cert_type
    CHECK (cert_type IN ('employment', 'income')),
  CONSTRAINT chk_cert_status
    CHECK (status IN ('pending', 'issued'))
);

CREATE INDEX idx_certificates_employee ON certificates(employee_id);

CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE certificates IS '証明書発行管理。社員が申請→管理者がPDFアップロード→発行済み';

-- ----------------------------------------
-- yearend_adjustments: 年末調整
-- ----------------------------------------
CREATE TABLE yearend_adjustments (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID          NOT NULL REFERENCES employees(id),
  fiscal_year   INTEGER       NOT NULL,
  form_data     JSONB         NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'open',
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_yearend_emp_year UNIQUE (employee_id, fiscal_year),
  CONSTRAINT chk_yearend_status
    CHECK (status IN ('open', 'submitted', 'closed'))
);

CREATE TRIGGER trg_yearend_updated_at
  BEFORE UPDATE ON yearend_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE yearend_adjustments IS '年末調整。5ステップウィザードのデータをJSONBで保持';
COMMENT ON COLUMN yearend_adjustments.form_data IS 'ウィザード全ステップの入力データ。基本情報・扶養控除・保険料・住宅ローン・確認';

-- ----------------------------------------
-- audit_logs: 操作ログ
-- ----------------------------------------
-- 全テーブルの変更をトリガーで自動記録する。
-- このテーブル自体は更新しない（INSERT-only）ためupdated_atは不要。
-- 大量データが蓄積されるため、将来的にcreated_atでレンジパーティションを検討。
CREATE TABLE audit_logs (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          REFERENCES users(id),
  action        VARCHAR(20)   NOT NULL,
  target_table  VARCHAR(100)  NOT NULL,
  target_id     UUID          NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_audit_action
    CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_audit_target    ON audit_logs(target_table, target_id);
CREATE INDEX idx_audit_user      ON audit_logs(user_id);
CREATE INDEX idx_audit_created   ON audit_logs(created_at);

-- updated_atトリガーは不要（INSERT-only テーブル）

COMMENT ON TABLE audit_logs IS '操作ログ。全テーブルの変更を記録。INSERT-only。保持期間: 最低5年';
COMMENT ON COLUMN audit_logs.user_id IS '操作者。システム自動処理の場合はNULL';
COMMENT ON COLUMN audit_logs.old_value IS '変更前の値。UPDATE/DELETEのみ';
COMMENT ON COLUMN audit_logs.new_value IS '変更後の値。INSERT/UPDATEのみ';

COMMIT;

-- DOWN (ロールバック)
-- BEGIN;
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS yearend_adjustments CASCADE;
-- DROP TABLE IF EXISTS certificates CASCADE;
-- DROP TABLE IF EXISTS work_rules CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS payrolls CASCADE;
-- COMMIT;
