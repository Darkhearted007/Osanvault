import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['GET','POST'];

function points(g){
  if(!g)return [];
  if(g.type==='Point') return [g.coordinates];
  if(g.type==='Polygon') return (g.coordinates||[]).flat();
  if(g.type==='MultiPolygon') return (g.coordinates||[]).flat(2);
  if(g.rings) return g.rings.flat();
  return [];
}
function bbox(g){const p=points(g).filter(x=>Array.isArray(x)&&x.length>=2);if(!p.length)return null;const xs=p.map(x=>+x[0]),ys=p.map(x=>+x[1]);return {x1:Math.min(...xs),x2:Math.max(...xs),y1:Math.min(...ys),y2:Math.max(...ys)};}
function centroid(g){const b=bbox(g);return b?[(b.x1+b.x2)/2,(b.y1+b.y2)/2]:null;}
function overlap(a,b){if(!a||!b)return 0;const ix=Math.max(0,Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1));const iy=Math.max(0,Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1));const inter=ix*iy;const aa=Math.max(0,(a.x2-a.x1)*(a.y2-a.y1));const bb=Math.max(0,(b.x2-b.x1)*(b.y2-b.y1));return Math.min(1,inter/Math.max(Math.min(aa,bb),1e-12));}
function centroidScore(a,b){if(!a||!b)return 0;const dx=a[0]-b[0],dy=a[1]-b[1];const d=Math.sqrt(dx*dx+dy*dy);return Math.max(0,1-Math.min(d/0.5,1));}

export default async function(req,res){
  const offset=Math.max(0,Number(req.body?.offset ?? req.query?.offset ?? 0));
  const limit=Math.min(100,Math.max(1,Number(req.body?.limit ?? req.query?.limit ?? 100)));
  const version='phase386.3-grid3-v1';
  const rows=(await db.query("SELECT m.source_feature_id,m.target_feature_id,m.target_lga_code,m.score composite_score,s.area_name source_name,s.geometry_json source_geometry,s.geometry_valid source_valid,t.feature_name target_name,t.geometry_geojson target_geometry,t.geometry_valid target_valid FROM gis_final_identity_crosswalk m JOIN gis_spatial_features s ON s.id=m.source_feature_id JOIN gis_geometry_features t ON t.validation_metadata->>'lgacode'=m.target_lga_code AND t.provider='GRID3' WHERE m.status='LOCKED' ORDER BY m.source_feature_id LIMIT $1 OFFSET $2",[limit,offset])).rows;
  let processed=0,valid=0,fail=0;
  for(const r of rows){
    const sb=bbox(r.source_geometry),tb=bbox(r.target_geometry),sc=centroid(r.source_geometry),tc=centroid(r.target_geometry);
    const ov=overlap(sb,tb),cs=centroidScore(sc,tc);
    const geometryValid=!!r.source_valid && !!r.target_valid && !!sb && !!tb;
    const pass=geometryValid && ov>=0.70 && cs>=0.70;
    await db.query("INSERT INTO gis_geometry_evidence(crosswalk_version,source_feature_id,target_feature_id,source_geometry,target_geometry,overlap_score,centroid_distance_score,containment_score,geometry_method,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(crosswalk_version,source_feature_id,target_feature_id) DO UPDATE SET source_geometry=EXCLUDED.source_geometry,target_geometry=EXCLUDED.target_geometry,overlap_score=EXCLUDED.overlap_score,centroid_distance_score=EXCLUDED.centroid_distance_score,containment_score=EXCLUDED.containment_score,geometry_method=EXCLUDED.geometry_method,evidence=EXCLUDED.evidence",[version,r.source_feature_id,r.target_feature_id,r.source_geometry,r.target_geometry,ov,cs,pass?1:0,'PHASE386_3_INDEPENDENT_PROVIDER_GEOMETRY',{source:r.source_name,target:r.target_name,geometryValid,pass,compositeScore:r.composite_score,offset,algorithm:'bbox-overlap-plus-centroid-v1'}]);
    processed++; if(pass)valid++; else fail++;
  }
  const total=(await db.query("SELECT COUNT(*)::int n FROM gis_final_identity_crosswalk WHERE status='LOCKED'")).rows[0].n;
  const done=offset+rows.length>=total;
  return res.json({phase:'386.3',version,offset,processed,valid,fail,total,done,nextOffset:done?null:offset+rows.length,certificationEligible:false});
}