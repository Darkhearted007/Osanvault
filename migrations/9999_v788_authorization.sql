CREATE OR REPLACE FUNCTION ov_authorize_project(p_user_id text, p_project_id uuid, p_action text)
RETURNS TABLE(allowed boolean, organization_id uuid, role text)
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN m.status <> 'ACTIVE' OR o.status <> 'ACTIVE' THEN false
      WHEN p_action = 'project_read' THEN true
      WHEN p_action = 'project_write' THEN m.role IN ('OWNER','ADMIN','DEVELOPER_ADMIN','PROJECT_MANAGER')
      WHEN p_action = 'finance_write' THEN m.role IN ('OWNER','ADMIN','DEVELOPER_ADMIN','FINANCE')
      WHEN p_action = 'compliance_write' THEN m.role IN ('OWNER','ADMIN','DEVELOPER_ADMIN','COMPLIANCE')
      WHEN p_action = 'opportunity_publish' THEN m.role IN ('OWNER','ADMIN','DEVELOPER_ADMIN','COMPLIANCE')
      ELSE false
    END,
    p.organization_id,
    m.role
  FROM projects p
  JOIN gis_organization_members m ON m.organization_id=p.organization_id
  JOIN gis_organizations o ON o.id=p.organization_id
  WHERE p.id=p_project_id AND m.member_id=p_user_id;
$$