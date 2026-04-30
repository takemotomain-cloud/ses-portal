-- 031: Client / Project の支払サイクル設定
-- 締め日 + 支払タイミング（月末 / N日 / N日サイト）+ 銀行休業日対応
-- 案件側はすべて nullable で、未設定ならクライアント既定を継承する
-- 既存データは全て NULL のまま（自動計算しない状態）

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS closing_day       INT,                    -- 0=月末, 10/15/20/25 等
  ADD COLUMN IF NOT EXISTS payment_mode      VARCHAR(32),            -- 'NEXT_MONTH_EOM' | 'NTH_MONTH_DAY' | 'DAYS'
  ADD COLUMN IF NOT EXISTS payment_months    INT,                    -- 締めから N か月後
  ADD COLUMN IF NOT EXISTS payment_day       INT,                    -- 0=月末, 1-31 (NTH_MONTH_DAY)
  ADD COLUMN IF NOT EXISTS payment_days      INT,                    -- 締めから N 日後 (DAYS)
  ADD COLUMN IF NOT EXISTS bank_holiday_adj  VARCHAR(32) DEFAULT 'PREV_BUSINESS_DAY';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS closing_day       INT,
  ADD COLUMN IF NOT EXISTS payment_mode      VARCHAR(32),
  ADD COLUMN IF NOT EXISTS payment_months    INT,
  ADD COLUMN IF NOT EXISTS payment_day       INT,
  ADD COLUMN IF NOT EXISTS payment_days      INT,
  ADD COLUMN IF NOT EXISTS bank_holiday_adj  VARCHAR(32);
