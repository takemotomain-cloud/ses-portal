-- 039: Performance indexes for common page-load queries
--
-- These indexes keep frequently used counts and notification lists fast as data grows.

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_employee_category_unread
  ON notifications(tenant_id, employee_id, category, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_category_created_at
  ON notifications(tenant_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delay_certificates_tenant_status
  ON delay_certificates(tenant_id, status)
  WHERE status = 'submitted';
