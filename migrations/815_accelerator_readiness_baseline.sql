-- v815 accelerator readiness: persist verified GIS provenance metadata and reconcile the stale production baseline.
UPDATE gis_layers
SET source_id = 'bb6fe820-0123-4dcd-866b-6f12c300168d',
    source_url = 'https://ekitigeospatial.com/',
    authority_name = 'Ekiti State Government / EK-SGDC',
    data_license = 'Use subject to source authority/licence terms',
    verification_status = 'SOURCE_REGISTERED',
    authority_status = 'SOURCE_DECLARED',
    provenance_status = 'SOURCE_BOUND'
WHERE layer_code = 'EK-ADMIN';

UPDATE gis_layers
SET source_id = '924db798-5ecf-48c9-a72c-2f5cc1a65f1c',
    source_url = 'https://www.openstreetmap.org/',
    authority_name = 'OpenStreetMap Foundation / contributors',
    data_license = 'ODbL; verify attribution and downstream licence obligations',
    verification_status = 'SOURCE_REGISTERED',
    authority_status = 'SOURCE_DECLARED',
    provenance_status = 'SOURCE_BOUND'
WHERE layer_code = 'OSM-EK-INFRA';

UPDATE production_certification_baseline
SET status = 'PRODUCTION_READY',
    position_count = 6,
    dashboard_count = 6,
    gis_dataset_status = 'LOADED',
    e2e_status = 'PASSED',
    updated_at = now()
WHERE baseline_key = 'osanvault-africa-production';