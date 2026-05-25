ALTER TABLE candidates
  ALTER COLUMN status TYPE VARCHAR(50);

UPDATE candidates
SET status = CASE status
  WHEN 'new' THEN '応募'
  WHEN 'screening' THEN '書類選考'
  WHEN 'first_interview' THEN '一次面接設定'
  WHEN 'final_interview' THEN '最終面接設定'
  WHEN 'offer' THEN '内定打診中'
  WHEN 'accepted' THEN '内定承諾'
  ELSE status
END
WHERE status IN ('new', 'screening', 'first_interview', 'final_interview', 'offer', 'accepted');
