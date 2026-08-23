CREATE TABLE IF NOT EXISTS compliance_obligations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), jurisdiction text NOT NULL, entity_scope text NOT NULL, regulator text NOT NULL, obligation_type text NOT NULL, title text NOT NULL, description text NOT NULL, recurrence text NOT NULL DEFAULT 'As required', due_rule text, priority text NOT NULL DEFAULT 'Medium', risk_level text NOT NULL DEFAULT 'Medium', status text NOT NULL DEFAULT 'Not assessed', responsible_role text, evidence_id uuid REFERENCES jurisdiction_evidence(id) ON DELETE SET NULL, source_url text, source_reference text, effective_date date, next_due_date date, last_reviewed date, next_review_date date, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS compliance_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES compliance_obligations(id) ON DELETE CASCADE, task_title text NOT NULL, assigned_role text, due_date date, status text NOT NULL DEFAULT 'Open', completion_date date, evidence_url text, notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS compliance_evidence_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES compliance_obligations(id) ON DELETE CASCADE, source_name text NOT NULL, source_url text NOT NULL, source_type text NOT NULL DEFAULT 'Primary source', citation_note text, checked_at date NOT NULL DEFAULT CURRENT_DATE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS compliance_escalations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES compliance_obligations(id) ON DELETE CASCADE, trigger_type text NOT NULL, severity text NOT NULL DEFAULT 'Medium', escalation_role text NOT NULL, escalation_status text NOT NULL DEFAULT 'Open', triggered_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, resolution_note text);
-- seed data is maintained in the live database after validation
-- PSC seed data is maintained in the validated database
-- tax seed data is maintained in the validated database
-- NDPA seed data is maintained in the validated database
-- SEC seed data is maintained in the validated database
-- NIPC seed data is maintained in the validated database
-- CAC evidence link is maintained in the validated database
-- PSC evidence link is maintained in the validated database
-- tax evidence link is maintained in the validated database
-- NDPA evidence link is maintained in the validated database
-- SEC evidence link is maintained in the validated database
-- NIPC evidence link is maintained in the validated database