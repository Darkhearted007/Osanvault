-- ÒsánVault Africa: canonicalize organization asset links to UUID.
-- Safe conversion: production preflight established the bridge currently has zero rows.
-- Fail closed if any non-UUID legacy values ever exist before this migration runs.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM gis_organization_assets
    WHERE asset_id IS NULL
       OR asset_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'gis_organization_assets contains non-UUID asset_id values; aborting UUID normalization';
  END IF;
END $$;

ALTER TABLE gis_organization_assets
  ALTER COLUMN asset_id TYPE uuid USING asset_id::uuid;

ALTER TABLE gis_organization_assets
  DROP CONSTRAINT IF EXISTS gis_organization_assets_asset_id_fkey;

ALTER TABLE gis_organization_assets
  ADD CONSTRAINT gis_organization_assets_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_gis_org_assets_asset_id
  ON gis_organization_assets(asset_id);

CREATE INDEX IF NOT EXISTS idx_gis_org_assets_org_asset
  ON gis_organization_assets(organization_id, asset_id);