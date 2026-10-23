ALTER TABLE gis_boundary_datasets ADD COLUMN IF NOT EXISTS jurisdiction_id uuid REFERENCES continental_jurisdictions(id) ON DELETE CASCADE;
ALTER TABLE gis_boundary_datasets ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES gis_boundary_sources(id) ON DELETE SET NULL;
ALTER TABLE gis_boundary_datasets ADD COLUMN IF NOT EXISTS effective_from timestamptz;
ALTER TABLE gis_boundary_datasets ADD COLUMN IF NOT EXISTS effective_until timestamptz;
