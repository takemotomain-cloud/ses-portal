-- 案件に勤怠表添付形式と稼働開始時刻を追加
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS default_start_time VARCHAR(5),
  ADD COLUMN IF NOT EXISTS attendance_format VARCHAR(20) NOT NULL DEFAULT 'none';

ALTER TABLE assignments
  ADD CONSTRAINT chk_assignments_attendance_format
  CHECK (attendance_format IN ('company', 'client_original', 'none'));
