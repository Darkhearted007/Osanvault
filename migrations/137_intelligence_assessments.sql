ALTER TABLE graph_assessments ADD COLUMN IF NOT EXISTS network_score numeric(5,2);
ALTER TABLE graph_assessments ADD COLUMN IF NOT EXISTS risk_level text;
ALTER TABLE graph_assessments ADD COLUMN IF NOT EXISTS generated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_graph_assessments_node_created ON graph_assessments(node_type,node_id,created_at DESC);