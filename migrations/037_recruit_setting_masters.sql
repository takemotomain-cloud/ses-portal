CREATE TABLE IF NOT EXISTS recruit_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  flag_label VARCHAR(50),
  flag_type VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recruit_job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recruit_interviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255),
  role_label VARCHAR(50),
  memo TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO recruit_statuses (code, name, flag_label, flag_type, sort_order)
VALUES
  ('応募', '応募', NULL, NULL, 1),
  ('書類選考', '書類選考', NULL, NULL, 2),
  ('書類選考通過', '書類選考通過', NULL, NULL, 3),
  ('一次面接設定', '一次面接設定', '面接ステージ', 'info', 4),
  ('一次面接通過', '一次面接通過', '面接ステージ', 'info', 5),
  ('最終面接設定', '最終面接設定', '面接ステージ', 'info', 6),
  ('最終面接通過', '最終面接通過', '面接ステージ', 'info', 7),
  ('内定打診中', '内定打診中', '内定出し', 'warn', 8),
  ('内定承諾', '内定承諾', '内定承諾', 'ok', 9),
  ('不採用', '不採用', '不採用', 'danger', 10),
  ('辞退', '辞退', '辞退', 'wait', 11)
ON CONFLICT (code) DO NOTHING;

INSERT INTO recruit_job_postings (name, sort_order)
SELECT name, row_number() OVER (ORDER BY name)
FROM (
  SELECT DISTINCT trim(job_posting) AS name
  FROM candidates
  WHERE job_posting IS NOT NULL
    AND trim(job_posting) <> ''
  UNION
  SELECT 'SESエンジニア'
  UNION
  SELECT 'インフラエンジニア'
) t
ON CONFLICT (name) DO NOTHING;

INSERT INTO recruit_interviewers (name, email, role_label, sort_order)
SELECT name, email, role_label, row_number() OVER (ORDER BY name)
FROM (
  SELECT DISTINCT
    trim(concat_ws(' ', e.last_name, e.first_name)) AS name,
    e.email AS email,
    CASE
      WHEN u.role = 'admin' THEN 'admin'
      WHEN u.role = 'manager' THEN 'manager'
      ELSE 'member'
    END AS role_label
  FROM users u
  JOIN employees e ON e.id = u.employee_id
  WHERE u.role IN ('admin', 'manager', 'member')
    AND e.deleted_at IS NULL
    AND trim(concat_ws(' ', e.last_name, e.first_name)) <> ''
  UNION
  SELECT DISTINCT
    trim(interviewer) AS name,
    NULL AS email,
    NULL AS role_label
  FROM candidates
  WHERE interviewer IS NOT NULL
    AND trim(interviewer) <> ''
) t
ON CONFLICT (name) DO NOTHING;
