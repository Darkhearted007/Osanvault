import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];

function normalize(s){return String(s||'').replace(/\\s+/g,' ').trim();}
function extractStructured(text){
  const out=[]; const seen=new Set();
  const patterns=[
    /State\s*[:\-]\s*([^<|\n]{2,80}).{0,180}?LGA\s*[:\-]\s*([^<|\n]{2,100}).{0,180}?Ward\s*[:\-]\s*([^<|\n]{2,100})/gi,
    /(?:state|StateName)["'\s:=]+([^"'&,}]{2,80}).{0,250}?(?:lga|LGAName)["'\s:=]+([^"'&,}]{2,100}).{0,250}?(?:ward|WardName)["'\s:=]+([^"'&,}]{2,100})/gi
  ];
  for(const re of patterns){let m;while((m=re.exec(text))){const state=normalize(m[1]),lga=normalize(m[2]),ward=normalize(m[3]);const key=`${state}|${lga}|${ward}`.toLowerCase();if(state&&lga&&ward&&!seen.has(key)){seen.add(key);out.push({state,lga,ward});}}}
  return out;
}
export default async function(req,res){
  const b=req.body||{}; if(!b.artifact_id)return res.status(400).json({error:'artifact_id is required'});
  const a=(await db.query("SELECT id,source_reference,content_hash,verification_status,provenance_status FROM ward_evidence_artifacts WHERE id=$1",[b.artifact_id])).rows[0];
  if(!a)return res.status(404).json({error:'artifact not found'});
  if(a.verification_status!=='VERIFIED'||!['VERIFIED','SOURCE_VERIFIED'].includes(a.provenance_status))return res.status(409).json({error:'artifact must be verified before extraction'});
  const r=await fetch(a.source_reference); if(!r.ok)return res.status(502).json({error:'source retrieval failed',http_status:r.status});
  const text=await r.text(); const rows=extractStructured(text);
  const {rows:ins}=await db.query("INSERT INTO ward_evidence_extractions (artifact_id,extracted_count,extraction_method,extraction_status,extracted_payload) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id,extracted_count,extraction_status",[a.id,rows.length,'deterministic_state_lga_ward_pattern_scan',rows.length?'EXTRACTED':'NO_STRUCTURED_MATCH',JSON.stringify(rows)]);
  res.json({artifact_id:a.id,source_hash:a.content_hash,extraction:ins[0],records:rows,policy:'Extraction reports only data actually present in the retrieved source; no inferred or synthetic ward records are created.'});
}