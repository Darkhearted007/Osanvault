import 'lib/vendor/polygon-clipping-standalone.js';
import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['POST'];

function bbox(g){const pts=[];const walk=x=>{if(Array.isArray(x)&&typeof x[0]==='number')pts.push(x);else if(Array.isArray(x))for(const y of x)walk(y)};walk(g?.coordinates);if(!pts.length)return null;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of pts){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])}return {minX,minY,maxX,maxY}}
function bboxIntersects(a,b){return !!(a&&b&&a.maxX>=b.minX&&b.maxX>=a.minX&&a.maxY>=b.minY&&b.maxY>=a.minY)}
function ringArea(r){let s=0;for(let i=0,j=r.length-1;i<r.length;j=i++)s+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return Math.abs(s)/2}
function geomArea(g){if(!Array.isArray(g)||!g.length)return 0;let total=0;for(const p of g){if(!p?.length)continue;total+=ringArea(p[0]||[]);for(let i=1;i<p.length;i++)total-=ringArea(p[i]||[])}return Math.abs(total)}
function toMultiPolygon(g){if(g?.type==='Polygon')return [g.coordinates];if(g?.type==='MultiPolygon')return g.coordinates;return null}

export default async function(req,res){
 const b=req.body||{}; const version=b.crosswalk_version||'phase323-current';
 const sourceProvider=b.source_provider||'UN SALB'; const targetProvider=b.target_provider||'GRID3';
 const limit=Math.min(Math.max(Number(b.limit||25),1),100); const offset=Math.max(Number(b.offset||0),0);
 const src=(await db.query("SELECT id,provider_feature_id,area_code,area_name,geometry_json FROM gis_spatial_features WHERE provider=$1 ORDER BY id LIMIT $2 OFFSET $3",[sourceProvider,limit,offset])).rows;
 const tgt=(await db.query("SELECT id,provider_feature_id,area_code,area_name,geometry_json FROM gis_spatial_features WHERE provider=$1 ORDER BY id",[targetProvider])).rows;
 if(!src.length||!tgt.length)return res.status(409).json({error:'Both geometry sets are required',sourceCount:src.length,targetCount:tgt.length});
 const pc=globalThis.polygonClipping;
 if(!pc?.intersection)return res.status(503).json({error:'Polygon clipping engine is unavailable; no spatial evidence was generated'});
 let measured=0,skipped=0,failed=0;
 for(const s of src){const sb=bbox(s.geometry_json);if(!sb){skipped++;continue}const candidates=[];for(const t of tgt){const tb=bbox(t.geometry_json);if(bboxIntersects(sb,tb))candidates.push(t)}for(const t of candidates.slice(0,Math.min(candidates.length,Number(b.candidate_limit||10)))){try{const a=toMultiPolygon(s.geometry_json),c=toMultiPolygon(t.geometry_json);if(!a||!c){skipped++;continue}const inter=pc.intersection(a,c),ia=geomArea(inter),sa=geomArea(a),ta=geomArea(c),sr=sa?ia/sa:0,tr=ta?ia/ta:0,iou=sa+ta-ia>0?ia/(sa+ta-ia):0;await db.query(`INSERT INTO gis_spatial_intersection_evidence (crosswalk_version,source_feature_id,target_feature_id,source_provider,target_provider,source_geometry_available,target_geometry_available,intersection_area,source_area,target_area,source_overlap_ratio,target_overlap_ratio,iou,geometry_method,geometry_crs,evidence_status,confidence,evidence) VALUES ($1,$2,$3,$4,$5,true,true,$6,$7,$8,$9,$10,$11,'polygon-clipping','EPSG:4326','MEASURED',$12,$13) ON CONFLICT(crosswalk_version,source_feature_id,target_feature_id) DO UPDATE SET intersection_area=EXCLUDED.intersection_area,source_area=EXCLUDED.source_area,target_area=EXCLUDED.target_area,source_overlap_ratio=EXCLUDED.source_overlap_ratio,target_overlap_ratio=EXCLUDED.target_overlap_ratio,iou=EXCLUDED.iou,geometry_method='polygon-clipping',geometry_crs='EPSG:4326',evidence_status='MEASURED',confidence=EXCLUDED.confidence,evidence=EXCLUDED.evidence,created_at=now()`,[version,s.id,t.id,sourceProvider,targetProvider,ia,sa,ta,sr,tr,iou,iou>=.5?'HIGH':iou>=.2?'MEDIUM':'LOW',{sourceFeatureId:s.provider_feature_id,targetFeatureId:t.provider_feature_id,sourceName:s.area_name,targetName:t.area_name,method:'polygon-clipping'}]);measured++}catch(e){failed++}}}
 return res.json({phase:331,crosswalk_version:version,offset,processed:src.length,measured,skipped,failed,status:failed?'PARTIAL':'COMPLETED',note:'Only explicit polygon-clipping intersection measurements are persisted; this endpoint does not certify identities.'});
}