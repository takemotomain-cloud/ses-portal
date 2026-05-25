ALTER TABLE document_issuances
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(32) NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(32),
  ADD COLUMN IF NOT EXISTS delivered_at DATE,
  ADD COLUMN IF NOT EXISTS acknowledged_at DATE,
  ADD COLUMN IF NOT EXISTS workflow_note TEXT;

UPDATE document_issuances
SET workflow_status = COALESCE(NULLIF(workflow_status, ''), 'issued')
WHERE workflow_status IS NULL OR workflow_status = '';
