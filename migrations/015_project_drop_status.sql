-- 案件テーブルから status カラムを削除（稼働状態はAssignment側で管理）
ALTER TABLE projects DROP COLUMN IF EXISTS status;
