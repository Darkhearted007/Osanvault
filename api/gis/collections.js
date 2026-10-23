import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];

export default async function(req,res) {
  const {rows} = await db.query(
    "SELECT gl.layer_code AS id, gl.layer_name AS title, gl.description, gl.authority_reference, gl.source_url, gl.layer_status, gl.sensitivity FROM gis_layers gl JOIN gis_layer_publication_rules r ON r.layer_id=gl.id WHERE gl.status='Active' AND gl.visibility='Public' AND r.publication_status='Published' AND (r.expires_at IS NULL OR r.expires_at>now()) AND gl.sensitivity NOT IN ('SENSITIVE','PRIVATE','DISPUTED') ORDER BY gl.layer_name"
  );
  const collections = [{
    id:'assets',
    title:'ÒsánVault Asset Features',
    description:'Public map-ready asset geometries with provenance and confidence metadata.',
    crs:['http://www.opengis.net/def/crs/OGC/1.3/CRS84']
  }, ...rows];
  return res.json({collections});
}
