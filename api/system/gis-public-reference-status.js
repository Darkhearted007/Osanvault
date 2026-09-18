import { db } from 'hatchable';
export const access='public';
export const methods=['GET'];
export default async function(req,res){
 const rows=(await db.query("SELECT gl.layer_key,gl.name,gl.authority_name,gl.verification_status,gl.confidence_score FROM gis_layers gl JOIN gis_layer_publication_rules r ON r.layer_id=gl.id WHERE gl.status='Active' AND gl.visibility='Public' AND r.publication_status='Published' AND (r.expires_at IS NULL OR r.expires_at>now()) ORDER BY gl.name")).rows;
 res.json({layers:rows.map(x=>({...x,authority_policy:x.authority_name||'REFERENCE_SOURCE',inec_authoritative:false})),note:'Public GIS layers are reference data unless independently certified as authoritative.'});
}