import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
export default async function(req,res){
 const version=req.body?.crosswalk_version||"phase323-current";
 const limit=Math.min(Number(req.body?.limit||1000),1000);
 const q=await db.query(`SELECT c.id,c.source_feature_id,c.target_feature_id,c.source_name,c.target_name,c.source_state_code,c.target_state_code,c.name_similarity,c.state_match,c.candidate_score,s.geometry_geojson sg,t.geometry_geojson tg FROM gis_phase338_spatial_candidates c JOIN gis_geometry_features s ON s.id=c.source_feature_id JOIN gis_geometry_features t ON t.id=c.target_feature_id WHERE c.crosswalk_version=$1 ORDER BY c.candidate_score DESC LIMIT $2`,[version,limit]);
 const rows=q.rows.map(r=>{const sameFeature=String(r.source_feature_id)===String(r.target_feature_id);const sameName=String(r.source_name||'').trim().toLowerCase()===String(r.target_name||'').trim().toLowerCase();const sameState=!!r.state_code&&r.source_state_code===r.target_state_code;return {...r,identity_issue:sameFeature?'SELF_MATCH':sameName&&sameState?'DUPLICATE_NAME_STATE':'CANDIDATE',sameFeature,sameName,sameState};});
 const stats={self:rows.filter(x=>x.sameFeature).length,exactNameState:rows.filter(x=>x.sameName&&x.sameState&&!x.sameFeature).length,candidates:rows.filter(x=>!x.sameFeature).length};
 return res.json({phase:342,crosswalk_version:version,candidatesAudited:rows.length,stats,zeroIntersectionDiagnosis:'Candidate generation currently uses name/state similarity, not geometry-derived containment. Exact IoU is therefore expected to be sparse until source and target identities represent distinct boundary datasets.',recommendation:'Build a source-to-target dataset crosswalk before spatial certification.',certifications:0});
}