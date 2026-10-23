-- v815 migration replay hardening.
-- Resolve source IDs from the registered source catalogue; never invent IDs.
-- Source registration is not proof of geometry ingestion or certification.
UPDATE gis_layers AS l
SET source_id = s.id,
    source_url = s.source_url,
    authority_name = s.authority_name,
    data_license = s.license_text,
    verification_status = 'SOURCE_REGISTERED',
    authority_status = 'SOURCE_DECLARED',
    provenance_status = 'SOURCE_BOUND'
FROM gis_data_sources AS s
WHERE l.layer_code = 'EK-ADMIN'
  AND s.source_url = 'https://ekitigeospatial.com/';

UPDATE gis_layers AS l
SET source_id = s.id,
    source_url = s.source_url,
    authority_name = s.authority_name,
    data_license = s.license_text,
    verification_status = 'SOURCE_REGISTERED',
    authority_status = 'SOURCE_DECLARED',
    provenance_status = 'SOURCE_BOUND'
FROM gis_data_sources AS s
WHERE l.layer_code = 'OSM-EK-INFRA'
  AND s.source_url = 'https://www.openstreetmap.org/';

-- Fail closed: a seed migration cannot certify production readiness or E2E success.
UPDATE production_certification_baseline
SET status = 'BLOCKED',
    position_count = (SELECT COUNT(*) FROM gis_organization_positions),
    dashboard_count = (SELECT COUNT(*) FROM gis_organization_dashboards),
    gis_dataset_status = 'NOT_LOADED',
    e2e_status = 'NOT_RUN',
    updated_at = now()
WHERE baseline_key = 'osanvault-africa-production';
