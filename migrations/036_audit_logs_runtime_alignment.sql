-- Align audit_logs with current runtime usage.
-- The app records semantic action names such as auth.login_success / payroll.view,
-- and sometimes omits target_id for view/login failure events.

ALTER TABLE audit_logs
  ALTER COLUMN action TYPE VARCHAR(50),
  ALTER COLUMN target_id DROP NOT NULL;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS chk_audit_action;
