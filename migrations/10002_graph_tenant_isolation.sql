-- Graph tenant isolation hardening
ALTER TABLE economic_graph_relationships ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE graph_assessments ADD COLUMN IF NOT EXISTS organization_id uuid;
CREATE INDEX IF NOT EXISTS idx_economic_graph_relationships_org ON economic_graph_relationships(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_assessments_org ON graph_assessments(organization_id, created_at DESC);