-- 027: 発行系書類 (給与明細/内定通知書/労働条件通知書) の発行履歴
-- いつ・誰に・どの書類を発行したか、Drive上のファイルIDとリンクを保存する

CREATE TABLE IF NOT EXISTS document_issuances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type   VARCHAR(32) NOT NULL,  -- 'payslip' | 'offer' | 'notice_fixed' | 'notice_open'
  target_date     DATE NOT NULL,         -- 給与明細は対象月初日、他は発行日
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_name       VARCHAR(255) NOT NULL,
  drive_file_id   VARCHAR(128),
  drive_view_link VARCHAR(512),
  issued_by       UUID REFERENCES users(id),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_issuances_employee
  ON document_issuances(employee_id);
CREATE INDEX IF NOT EXISTS idx_document_issuances_type_target
  ON document_issuances(document_type, target_date);
CREATE INDEX IF NOT EXISTS idx_document_issuances_issued_at
  ON document_issuances(issued_at DESC);
