import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];

async function fetchJson(url, attempts=3){
  let last;
  for(let i=0;i<attempts;i++){
    try{
      const r=await fetch(url);
      const text=await r.text();
      let d;
      try{ d=JSON.parse(text); }catch{ throw new Error(`NON_JSON_UPSTREAM_${r.status}:${text.slice(0,160)}`); }
      if(!r.ok||d.error) throw new Error(d.error?.message||`UPSTREAM_HTTP_${r.status}`);
      return d;
    }catch(e){ last=e; if(i<attempts-1) await new Promise(x=>setTimeout(x,300*(i+1))); }
  }
  throw last;
}

export default async function(req,res){
  const q=await db.query(`SELECT * FROM gis_phase383_ward_ingestion WHERE dataset_key='GRID3_WARD_V3'`);
  if(!q.rows.length)return res.status(409).json({phase:383,status:'NOT_BOOTSTRAPPED'});
  const j=q.rows[0];
  if(j.status==='COMPLETE')return res.json({phase:383,status:'COMPLETE',offset:j.fetch_offset,totalLoaded:j.total_loaded,totalInvalid:j.total_invalid});
  await db.query(`UPDATE gis_phase383_ward_ingestion SET status='RUNNING',last_run_at=now(),updated_at=now() WHERE dataset_key='GRID3_WARD_V3'`);
  try{
    const meta=await fetchJson(j.source_url+'?f=json');
    const oid=meta.objectIdField;
    if(!oid)throw new Error('OBJECT_ID_FIELD_NOT_FOUND');
    const ds=await db.query(`SELECT id FROM gis_phase372_boundary_datasets WHERE dataset_key='GRID3_ADMIN_BOUNDARIES'`);
    if(!ds.rows.length)throw new Error('BOUNDARY_DATASET_NOT_REGISTERED');
    let offset=Number(j.fetch_offset), totalLoaded=0,totalInvalid=0,pages=0,transfer=false;
    const maxPages=20;
    for(;pages<maxPages;pages++){
      const u=new URL(j.source_url+'/query');
      u.searchParams.set('where','1=1');u.searchParams.set('outFields','*');u.searchParams.set('returnGeometry','true');
      u.searchParams.set('resultOffset',String(offset));u.searchParams.set('resultRecordCount',String(Math.min(j.page_size,25)));
      u.searchParams.set('orderByFields',oid);u.searchParams.set('f','json');
      const d=await fetchJson(u.toString()); const fs=d.features||[]; transfer=transfer||!!d.exceededTransferLimit;
      if(!fs.length){
        await db.query(`UPDATE gis_phase383_ward_ingestion SET status='COMPLETE',last_error=NULL,updated_at=now() WHERE dataset_key='GRID3_WARD_V3'`);
        return res.json({phase:383,status:'COMPLETE',offset,totalLoaded:Number(j.total_loaded)+totalLoaded,totalInvalid:Number(j.total_invalid)+totalInvalid,pagesProcessed:pages,transferLimitEncountered:transfer,certificationEnabled:false});
      }
      let loaded=0,invalid=0;
      for(const f of fs){
        const a=f.attributes||{},g=f.geometry||null,id=String(a[oid]??'');
        const valid=!!id&&!!g&&typeof g==='object'&&Object.keys(g).length>0;
        if(!valid){invalid++;continue;}
        await db.query(`INSERT INTO gis_phase372_boundary_features(dataset_id,boundary_level,boundary_id,parent_id,name,state_code,geometry_geojson,geometry_valid,geometry_empty,properties) VALUES($1,'WARD',$2,$3,$4,$5,$6,true,false,$7) ON CONFLICT(dataset_id,boundary_level,boundary_id) DO UPDATE SET parent_id=EXCLUDED.parent_id,name=EXCLUDED.name,state_code=EXCLUDED.state_code,geometry_geojson=EXCLUDED.geometry_geojson,geometry_valid=true,geometry_empty=false,properties=EXCLUDED.properties`,[ds.rows[0].id,id,String(a.LGA_CODE||a.LGA||a.parent_id||'')||null,String(a.WARD_NAME||a.NAME||id),String(a.STATE_CODE||a.STATE||'')||null,JSON.stringify(g),JSON.stringify(a)]);
        loaded++;
      }
      offset+=fs.length; totalLoaded+=loaded; totalInvalid+=invalid;
      await db.query(`UPDATE gis_phase383_ward_ingestion SET fetch_offset=$1,total_loaded=total_loaded+$2,total_invalid=total_invalid+$3,status='RUNNING',last_error=NULL,updated_at=now() WHERE dataset_key='GRID3_WARD_V3'`,[offset,loaded,invalid]);
      if(fs.length<Number(j.page_size) && !d.exceededTransferLimit)break;
    }
    return res.json({phase:383,status:'BATCH_COMPLETE',offset,nextOffset:offset,loaded:totalLoaded,invalid:totalInvalid,pagesProcessed:pages,transferLimitEncountered:transfer,certificationEnabled:false});
  }catch(e){
    await db.query(`UPDATE gis_phase383_ward_ingestion SET status='RUNNING',last_error=$1,updated_at=now() WHERE dataset_key='GRID3_WARD_V3'`,[String(e.message||e)]);
    return res.status(502).json({phase:383,status:'RETRYABLE_ERROR',offset:j.fetch_offset,error:String(e.message||e),certificationEnabled:false});
  }
}