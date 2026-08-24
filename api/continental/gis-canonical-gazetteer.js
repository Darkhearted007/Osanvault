import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST'];
function norm(v){return String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/&/g,' AND ').replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
export default async function(req,res){
 if(req.method==='GET'){
  const states=(await db.query("SELECT * FROM gis_canonical_admin_identities WHERE country_code='NG' AND admin_level='STATE' ORDER BY canonical_name")).rows;
  const lgas=(await db.query("SELECT * FROM gis_canonical_admin_identities WHERE country_code='NG' AND admin_level='LGA' ORDER BY canonical_name")).rows;
  return res.json({stateCount:states.length,lgaCount:lgas.length,states,lgas});
 }
 const src=(await db.query("SELECT area_code,area_name,parent_area_code,geometry_json FROM gis_spatial_features WHERE provider='UN SALB' ORDER BY area_code")).rows;
 if(!src.length)return res.status(409).json({error:'SALB feature store is empty'});
 let inserted=0; const seen=new Set();
 for(const s of src){const code=String(s.area_code||'').trim();const name=String(s.area_name||'').trim();if(!code||!name)continue;const parts=code.match(/^NGA(\d{3})(\d{3})$/i);const stateCode=parts?`NG-${parts[1]}`:String(s.parent_area_code||'').trim()||null;const stateName=String(s.parent_area_code||'').trim()||null;const key=`NG|LGA|${code}`;if(!seen.has(key)){await db.query("INSERT INTO gis_canonical_admin_identities (country_code,admin_level,canonical_code,canonical_name,parent_canonical_code,source_authority,source_version,status,evidence) VALUES ('NG','LGA',$1,$2,$3,'UN SALB','2024-08-08','Proposed',$4) ON CONFLICT (country_code,admin_level,canonical_code) DO UPDATE SET canonical_name=EXCLUDED.canonical_name,parent_canonical_code=EXCLUDED.parent_canonical_code,evidence=EXCLUDED.evidence",[code,name,stateCode,{source:'UN SALB',sourceAreaCode:code,sourceParentAreaCode:s.parent_area_code}]);seen.add(key);inserted++;}}
 const states=(await db.query("SELECT DISTINCT parent_canonical_code AS code FROM gis_canonical_admin_identities WHERE country_code='NG' AND admin_level='LGA' AND parent_canonical_code IS NOT NULL")).rows;for(const st of states){await db.query("INSERT INTO gis_canonical_admin_identities (country_code,admin_level,canonical_code,canonical_name,parent_canonical_code,source_authority,source_version,status,evidence) VALUES ('NG','STATE',$1,$2,NULL,'UN SALB','2024-08-08','Proposed',$3) ON CONFLICT (country_code,admin_level,canonical_code) DO NOTHING",[st.code,st.code,{derivedFrom:'SALB LGA parent hierarchy'}]);}
 const counts=(await db.query("SELECT admin_level,count(*)::int AS count FROM gis_canonical_admin_identities WHERE country_code='NG' GROUP BY admin_level ORDER BY admin_level")).rows;res.json({inserted,counts,sourceFeatureCount:src.length,status:'Populated',note:'State names remain Proposed where SALB parent labels are not directly available; no jurisdiction activation is implied.'});
}