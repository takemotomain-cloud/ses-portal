ALTER TABLE integration_tokens
  ADD COLUMN IF NOT EXISTS root_folder_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS root_folder_path VARCHAR(500);

COMMENT ON COLUMN integration_tokens.root_folder_id IS 'Google Drive 保存ルートフォルダID';
COMMENT ON COLUMN integration_tokens.root_folder_path IS 'Google Drive 保存ルートフォルダパス';
