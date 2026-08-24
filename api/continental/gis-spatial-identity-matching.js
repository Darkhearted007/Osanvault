import { db } from 'hatchable';
export const access='admin'; export const methods=['POST','GET'];
function norm(v){return String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/&/g,' AND ').replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function tokenScore(a,b){const A=new Set(norm(a).split(' ').filter(Boolean)),B=new Set(norm(b).split(' ').filter(Boolean));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i)}
function bbox(g){const pts=[];const walk=x=>{if(Array.isArray(x)&&typeof x[0]==='number')pts.push(x);else if(Array.isArray(x))x.forEach(walk)};walk(g?.coordinates);if(!pts.length)return null;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of pts){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])}return {minX,minY,maxX,maxY}}
function overlap(a,b){if(!a||!b)return 0;const ix=Math.max(0,Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX));const iy=Math.max(0,Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY));const inter=ix*iy;const aa=Math.max(0,(a.maxX-a.minX)*(a.maxY-a.minY));const ab=Math.max(0,(b.maxX-b.minX)*(b.maxY-b.minY));return inter/Math.max(1e-12,aa+ab-inter)}
function centroid(b){return b?[(b.minX+b.maxX)/2,(b.minY+b.maxY)/2]:null}
function cscore(a,b){if(!a||!b)return 0;const d=Math.hypot(a[0]-b[0],a[1]-b[1]);return Math.max(0,1-d/5)}
function areaScore(a,b){if(!a||!b)return 0;const aa=Math.max(1e-12,(a.maxX-a.minX)*(a.maxY-a.minY)),ab=Math.max(1e-12,(b.maxX-b.minX)*(b.maxY-b.minY));return Math.min(aa,ab)/Math.max(aa,ab)}
export default async function(req,res){
 if(req.method==='GET'){const q=await db.query('SELECT confidence,count(*)::int AS count FROM gis_spatial_identity_matches GROUP BY confidence ORDER BY confidence');return res.json({results:q.rows})}
 const body=req.body||{},country=body.country_code||'NG',source=body.source_provider||'UN SALB',target=body.target_provider||'GRID3';
 const src=(await db.query("SELECT id,provider_feature_id,external_feature_id,area_code,area_name,parent_area_code,geometry_json FROM gis_spatial_features WHERE provider=$1 ORDER BY area_code",[source])).rows;
 const tgt=(await db.query("SELECT id,provider_feature_id,external_feature_id,area_code,area_name,parent_area_code,geometry_json FROM gis_spatial_features WHERE provider=$1 ORDER BY area_code",[target])).rows;
 if(!src.length||!tgt.length)return res.status(409).json({error:'Both normalized spatial feature sets are required',sourceCount:src.length,targetCount:tgt.length});
 const run=(await db.query('INSERT INTO gis_identity_resolution_runs (country_code,source_provider,target_provider,source_feature_count,target_feature_count,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[country,source,target,src.length,tgt.length,'SpatialRunning'])).rows[0];
 let high=0,amb=0,unres=0;
 for(const s of src){
  const sb=bbox(s.geometry_json);
  const cand=tgt.map(t=>{const tb=bbox(t.geometry_json),ns=tokenScore(s.area_name,t.area_name),ps=tokenScore(s.parent_area_code,t.parent_area_code),bs=overlap(sb,tb),cs=cscore(centroid(sb),centroid(tb)),as=areaScore(sb,tb),exact=!!(s.area_code&&t.area_code&&norm(s.area_code)===norm(t.area_code));const score=exact?1:(0.25*ns+0.15*ps+0.30*bs+0.15*cs+0.15*as);return {...t,score,ns,ps,bs,cs,as,exact}}).sort((a,b)=>b.score-a.score);
  const best=cand[0],second=cand[1],gap=best.score-(second?.score||0);let conf='Unresolved',review=true;if(best.score>=0.90&&gap>=0.10){conf='High';review=false;high++}else if(best.score>=0.65){conf='Ambiguous';amb++}else{unres++}
  await db.query('INSERT INTO gis_spatial_identity_matches (run_id,source_feature_id,target_provider,target_provider_feature_id,name_score,parent_score,bbox_score,centroid_score,area_score,composite_score,confidence,review_required,evidence) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[run.id,s.id,target,best?.provider_feature_id||null,best?.ns||0,best?.ps||0,best?.bs||0,best?.cs||0,best?.as||0,best?.score||0,conf,review,{best:best?{providerFeatureId:best.provider_feature_id,name:best.area_name,code:best.area_code,score:Number(best.score.toFixed(5))}:null,second:second?{providerFeatureId:second.provider_feature_id,name:second.area_name,code:second.area_code,score:Number(second.score.toFixed(5))}:null,method:'code + name + parent + bounding-box overlap + centroid proximity + area similarity'}]);
 }
 await db.query('UPDATE gis_identity_resolution_runs SET matched_count=$1,ambiguous_count=$2,unresolved_count=$3,status=$4,completed_at=now() WHERE id=$5',[high,amb,unres,'SpatialCompleted',run.id]);
 res.json({runId:run.id,sourceCount:src.length,targetCount:tgt.length,highConfidence:high,ambiguous:amb,unresolved:unres,activationEligible:high===src.length,reviewRequired:amb+unres});
}