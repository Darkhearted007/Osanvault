import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
  const layers=(await db.query("SELECT gl.layer_key,gl.name,gl.authority_name,gl.verification_status,gl.confidence_score,gl.visibility,gl.status,r.publication_status FROM gis_layers gl LEFT JOIN gis_layer_publication_rules r ON r.layer_id=gl.id ORDER BY gl.name")).rows;
  const features=(await db.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE geometry_json IS NOT NULL)::int AS with_geometry FROM gis_spatial_features")).rows[0];
  res.json({mode:'READ_ONLY',authority_policy:'Do not represent secondary/reference geometry as INEC-authoritative',layers,spatial_features:features,inec_authoritative_artifacts:0,production_certification:'BLOCKED_PENDING_AUTHORITATIVE_INEC_EVIDENCE'});
}