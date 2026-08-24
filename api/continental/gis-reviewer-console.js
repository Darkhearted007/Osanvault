import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST'];
export default async function(req,res){
 if(req.method==='GET'){
  const q=await db.query("SELECT c.id,c.source_feature_id,c.target_feature_id,c.resolution_type,c.confidence,c.auto_resolved,c.rationale,c.evidence,s.area_code AS source_code,s.area_name AS source_name,t.area_code AS target_code,t.area_name AS target_name FROM gis_identity_exception_resolutions c JOIN gis_spatial_features s ON s.id=c.source_feature_id LEFT JOIN gis_spatial_features t ON t.id=c.target_feature_id WHERE c.auto_resolved=false ORDER BY CASE c.confidence WHEN 'HighRisk' THEN 1 WHEN 'Review' THEN 2 ELSE 3 END,c.created_at");
  return res.json({count:q.rows.length,items:q.rows});
 }
 const b=req.body||{}; if(!b.resolution_id||!b.decision)return res.status(400).json({error:'resolution_id and decision are required'});
 const allowed=['APPROVE','REJECT','DEFER','SELECT_TARGET'];if(!allowed.includes(b.decision))return res.status(400).json({error:'Invalid decision'});
 const r=await db.query("SELECT * FROM gis_identity_exception_resolutions WHERE id=$1 LIMIT 1",[b.resolution_id]);if(!r.rows.length)return res.status(404).json({error:'Resolution not found'});const x=r.rows[0];
 if(b.decision==='APPROVE'||b.decision==='SELECT_TARGET'){const target=b.selected_target_feature_id||x.target_feature_id;if(!target)return res.status(400).json({error:'A target feature is required'});await db.query("UPDATE gis_identity_exception_resolutions SET target_feature_id=$1,confidence='Reviewed',auto_resolved=true,rationale=$2,evidence=$3 WHERE id=$4",[target,b.rationale||'Approved by reviewer',JSON.stringify({...x.evidence,review:{decision:b.decision,reviewer:b.reviewer_id||null}}),b.resolution_id]);}
 else if(b.decision==='REJECT') await db.query("UPDATE gis_identity_exception_resolutions SET confidence='Rejected',auto_resolved=true,rationale=$1,evidence=$2 WHERE id=$3",[b.rationale||'Rejected by reviewer',JSON.stringify({...x.evidence,review:{decision:'REJECT',reviewer:b.reviewer_id||null}}),b.resolution_id]);
 else await db.query("UPDATE gis_identity_exception_resolutions SET rationale=$1,evidence=$2 WHERE id=$3",[b.rationale||'Deferred for further evidence',JSON.stringify({...x.evidence,review:{decision:'DEFER',reviewer:b.reviewer_id||null}}),b.resolution_id]);
 return res.json({resolutionId:b.resolution_id,decision:b.decision,completed:b.decision!=='DEFER'});
}