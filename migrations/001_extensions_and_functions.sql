-- ============================================================
-- Migration 001: Extensions & Utility Functions
-- ============================================================
-- 何をするか: pgcrypto拡張の有効化、updated_at自動更新トリガー関数の作成
-- なぜ: UUID生成(gen_random_uuid)、カラム暗号化(pgp_sym_encrypt)、
--       全テーブル共通のupdated_at自動更新に必要
-- 注意: RDSではCREATE EXTENSIONにrds_superuser権限が必要
-- ============================================================

-- UP
BEGIN;

-- UUID生成 & カラムレベル暗号化用
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- updated_at を自動更新するトリガー関数
-- 全テーブルに適用する。行が更新されるたびにupdated_atを現在時刻に設定。
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- DOWN (ロールバック)
-- BEGIN;
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
-- DROP EXTENSION IF EXISTS "pgcrypto";
-- COMMIT;
