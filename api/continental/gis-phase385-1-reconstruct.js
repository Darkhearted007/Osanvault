import { db } from "hatchable";
export const access = "public";
export const methods = ["GET"];
const SOURCE='https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_operational_wards_v3_0/FeatureServer/0';
export default async function(req,res){
  const d=(await db.query("SELECT id FROM gis_phase372_boundary_datasets WHERE dataset_key='GRID3_ADMIN_BOUNDARIES' LIMIT 1")).rows[0];
  if(!d)return res.status(404).json({phase:'385.1',status:'DATASET_MISSING'});
  const existing=(await db.query("SELECT COUNT(*)::int AS n FROM gis_phase372_boundary_features WHERE dataset_id=$1 AND boundary_level='WARD' AND COALESCE((properties->>'hierarchy_reconstructed')::boolean,false)=true",[d.id])).rows[0]?.n||0;
  let offset=existing,pages=0,reconciled=0;
  for(;pages<25;pages++){
    const u=new URL(SOURCE+'/query');
    for(const [k,v] of Object.entries({where:'1=1',outFields:'OBJECTID,state,statecode,lga,ward',returnGeometry:'false',resultOffset:String(offset),resultRecordCount:'300',orderByFields:'OBJECTID',f:'json'}))u.searchParams.set(k,v);
    const r=await fetch(u);const data=await r.json();
    if(data.error)return res.status(502).json({phase:'385.1',status:'SOURCE_ERROR',offset,error:data.error});
    const fs=data.features||[];if(!fs.length)break;
    const rows=fs.map(f=>{const a=f.attributes||{};return {boundary_id:String(a.OBJECTID||''),parent_id:String(a.lga||'').trim()||null,name:String(a.ward||'').trim()||null,state_code:String(a.statecode||'').trim()||null,state_name:String(a.state||'').trim()||null}}).filter(x=>x.boundary_id);
    await db.query("WITH x AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS r(boundary_id text,parent_id text,name text,state_code text,state_name text)) UPDATE gis_phase372_boundary_features f SET parent_id=x.parent_id,name=x.name,state_code=x.state_code,properties=f.properties || jsonb_build_object('state',x.state_name,'statecode',x.state_code,'lga',x.parent_id,'ward',x.name,'hierarchy_reconstructed',true,'hierarchy_source','GRID3_NGA_operational_wards_v3_0') FROM x WHERE f.dataset_id=$1 AND f.boundary_level='WARD' AND f.boundary_id=x.boundary_id",[d.id,JSON.stringify(rows)]);
    reconciled+=rows.length;offset+=fs.length;if(fs.length<300)break;
  }
  const q=await db.query("SELECT COUNT(*)::int wards,COUNT(*) FILTER(WHERE parent_id IS NOT NULL AND parent_id<>'')::int with_lga,COUNT(*) FILTER(WHERE state_code IS NOT NULL AND state_code<>'')::int with_state,COUNT(DISTINCT parent_id)::int lgas,COUNT(DISTINCT state_code)::int states FROM gis_phase372_boundary_features WHERE dataset_id=$1 AND boundary_level='WARD'",[d.id]);
  const x=q.rows[0];
  return res.json({phase:'385.1',status:'RECONSTRUCTED',pages,reconciled,finalOffset:offset,verification:x,complete:x.wards===5872&&x.with_lga===5872&&x.with_state===5872});
}