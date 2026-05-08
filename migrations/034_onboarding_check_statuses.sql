CREATE TABLE IF NOT EXISTS onboarding_check_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  item_key VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'done',
  method VARCHAR(30),
  confirmed_at DATE,
  memo TEXT,
  confirmed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_check_statuses_employee
  ON onboarding_check_statuses(employee_id);
