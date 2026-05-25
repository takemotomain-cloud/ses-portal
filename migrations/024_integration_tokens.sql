-- 外部サービス連携トークン（OAuth 2.0）
CREATE TABLE integration_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      VARCHAR(50) NOT NULL UNIQUE,  -- 'google_drive'
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  email         VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
