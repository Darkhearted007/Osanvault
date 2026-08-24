import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST'];
export default async function(req,res){
 if(req.method==='GET'){
  const q=await db.query("SELECT m.id,m.source_feature_id,m.target_provider,m.target_provider_feature_id,m.name_score,m.parent_score,m.bbox_score,m.centroid_score,m.area_score,m.composite_score,m.confidence,m.review_required,m.evidence,s.area_code AS source_code,s.area_name AS source_name,s.parent_area_code AS source_parent FROM gis_spatial_identity_matches m JOIN gis_spatial_features s ON s.id=m.source_feature_id LEFT JOIN gis_identity_review_decisions d ON d.match_id=m.id WHERE m.review_required=true AND d.id IS NULL ORDER BY m.composite_score DESC LIMIT 100");
  return res.json({count:q.rows.length,items:q.rows});
 }
 const b=req.body||{}; if(!b.match_id||!b.decision)return res.status(400).json({error:'match_id and decision are required'});
 const allowed=['APPROVE','REJECT','SELECT_ALTERNATIVE','DEFER']; if(!allowed.includes(b.decision))return res.status(400).json({error:'Invalid decision'});
 const r=await db.query('INSERT INTO gis_identity_review_decisions (match_id,decision,selected_target_feature_id,reviewer_id,rationale,evidence) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[b.match_id,b.decision,b.selected_target_feature_id||null,b.reviewer_id||null,b.rationale||null,b.evidence||{}]);
 if(b.decision==='APPROVE'||b.decision==='SELECT_ALTERNATIVE') await db.query('UPDATE gis_spatial_identity_matches SET confidence=$1,review_required=false WHERE id=$2',['Reviewed',b.match_id]);
 return res.json({decisionId:r.rows[0].id,matchId:b.match_id,decision:b.decision,activationContribution:b.decision==='APPROVE'||b.decision==='SELECT_ALTERNATIVE'});
}