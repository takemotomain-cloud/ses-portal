-- 012: 遅延証明書の提出機能
--
-- 新テーブル:
--   delay_certificates — 社員が提出する遅延証明書

CREATE TABLE delay_certificates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  target_date   DATE NOT NULL,
  route         VARCHAR(200),
  reason        TEXT,
  file_path     VARCHAR(500),
  file_name     VARCHAR(300),
  status        VARCHAR(20) NOT NULL DEFAULT 'submitted',  -- submitted / confirmed
  confirmed_by  UUID REFERENCES employees(id),
  confirmed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delay_certificates_employee ON delay_certificates(employee_id);

CREATE TRIGGER trg_delay_certificates_updated_at
  BEFORE UPDATE ON delay_certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE delay_certificates IS '社員が提出する遅延証明書';
