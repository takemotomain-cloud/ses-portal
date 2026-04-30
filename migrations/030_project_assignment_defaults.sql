-- 030: Project に Assignment 既定値カラムを追加
-- 案件編集ポップアップを新規アサイン登録と同等の項目に揃える対応。
-- Assignment 側の同名カラムは維持（個別上書き用）。

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_attendance_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS overtime_rate INT,
  ADD COLUMN IF NOT EXISTS deduction_rate INT;
