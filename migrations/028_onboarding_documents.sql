-- 028: 入社情報フォームで本人確認書類を社員単位に Drive 管理するためのテーブル
CREATE TABLE IF NOT EXISTS onboarding_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type   VARCHAR(32) NOT NULL, -- 'license_front'|'license_back'|'mynumber_front'|'mynumber_back'|'pension_book'|'health_check'
  file_name       VARCHAR(255) NOT NULL,
  mime_type       VARCHAR(64),
  file_size       INT,
  local_path      VARCHAR(512),
  drive_file_id   VARCHAR(128),
  drive_view_link VARCHAR(512),
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_employee ON onboarding_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_type ON onboarding_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_uploaded_at ON onboarding_documents(uploaded_at DESC);
