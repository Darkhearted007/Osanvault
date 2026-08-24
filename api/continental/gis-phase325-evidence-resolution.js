import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST'];
function norm(v){return String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/&/g,' AND ').replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function tokens(v){return new Set(norm(v).split(' ').filter(Boolean))}
function sim(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i)}
export default async function(req,res){
 const v=String(req.body?.crosswalk_version||'phase323-current');
 if(req.method==='GET'){const q=await db.query("SELECT category,status,count(*)::int count FROM gis_current_exception_queue WHERE crosswalk_version=$1 GROUP BY category,status ORDER BY category,status",[v]);return res.json({crosswalkVersion:v,summary:q.rows});}
 const limit=Math.min(Math.max(Number(req.body?.limit||30),1),30),offset=Math.max(Number(req.body?.offset||0),0);
 const rows=(await db.query("SELECT q.id,q.source_feature_id,q.state_code,q.category,q.status,s.area_name source_name,s.area_code source_code FROM gis_current_exception_queue q JOIN gis_spatial_features s ON s.id=q.source_feature_id WHERE q.crosswalk_version=$1 AND q.status='OPEN' ORDER BY q.created_at LIMIT $2 OFFSET $3",[v,limit,offset])).rows;
 const targets=(await db.query("SELECT id,area_name,area_code,parent_area_code FROM gis_spatial_features WHERE provider='GRID3' AND area_name IS NOT NULL")).rows;
 let auto=0,review=0; for(const r of rows){let best=null;for(const t of targets){const score=sim(r.source_name,t.area_name);if(!best||score>best.score)best={t,score};}
 const exact=best&&best.score>=0.92;const strong=best&&best.score>=0.75;let status='OPEN',category='STATE_AWARE_REVIEW',reason='Best candidate identified by normalized name similarity but independent geometry evidence is required before certification.';
 if(exact){status='CANDIDATE_VALIDATED';category='NAME_STRONG_REVIEW';reason='Near-exact administrative name match identified; candidate still requires independent State/geometry confirmation.';}
 if(strong)review++;else review++;
 await db.query("UPDATE gis_current_exception_queue SET target_feature_id=$1,category=$2,status=$3,evidence=$4 WHERE id=$5",[best?.t.id||null,category,status,{source:r.source_name,sourceCode:r.source_code,stateCode:r.state_code,candidate:best?.t.area_name||null,candidateCode:best?.t.area_code,nameSimilarity:best?.score||0,geometryRequired:true,automaticCertification:false},r.id]);}
 const summary=(await db.query("SELECT status,count(*)::int count FROM gis_current_exception_queue WHERE crosswalk_version=$1 GROUP BY status",[v])).rows;return res.json({crosswalkVersion:v,processed:rows.length,candidatesScored:targets.length,autoResolved:auto,reviewRequired:review,summary,certificationEligible:false,nextOffset:rows.length===limit?offset+limit:null});}