ALTER TABLE gis_controlled_imports ADD COLUMN IF NOT EXISTS inline_payload text;
ALTER TABLE gis_controlled_imports ADD COLUMN IF NOT EXISTS inline_payload_encoding text;