-- 017: ProposalEmailにprojectNameとresultカラムを追加
ALTER TABLE proposal_emails
  ADD COLUMN IF NOT EXISTS project_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS result VARCHAR(20);

-- 既存データのproject_nameをsubjectから推定（'提案: xxx' → 'xxx'）
UPDATE proposal_emails
SET project_name = SUBSTRING(subject FROM 5)
WHERE subject LIKE '提案: %' AND project_name IS NULL;
