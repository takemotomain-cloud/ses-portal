-- 案件に「現場勤怠の要否」カラムを追加
ALTER TABLE assignments ADD COLUMN client_attendance_required BOOLEAN NOT NULL DEFAULT true;
