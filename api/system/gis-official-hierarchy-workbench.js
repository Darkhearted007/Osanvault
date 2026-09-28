import { db } from 'hatchable';

export const access='admin';
export const methods=['GET'];

const q=async(sql,p=[]) => (await db.query(sql,p)).rows;

export default async function(req,res){
  const candidateId=String(req.query?.candidate_id||'').trim();
  const wardName=String(req.query?.ward||'').trim();

  if(!candidateId){
    return res.status(400).json({
      phase:'391.22',
      status:'INVALID_REQUEST',
      error:'candidate_id is required',
      policy:'Read-only official INEC hierarchy workbench. No candidate, geometry, or certification mutation is performed.'
    });
  }

  const candidates=await q(`SELECT id,state_name,lga_name,candidate_area_code,status,confidence,evidence_reference
    FROM gis_exception_candidate_matches WHERE id=$1 LIMIT 1`,[candidateId]);
  if(!candidates.length) return res.status(404).json({phase:'391.22',status:'NOT_FOUND'});

  const c=candidates[0];
  const base=[c.state_name,c.lga_name];

  const wards=await q(`SELECT ward_name,ward_code,count(*)::int AS polling_unit_count
    FROM gis_official_artifact_rows
    WHERE lower(state_name)=lower($1) AND lower(lga_name)=lower($2)
    GROUP BY ward_name,ward_code
    ORDER BY ward_name,ward_code`,base);

  let pollingUnits=[];
  if(wardName){
    pollingUnits=await q(`SELECT state_name,lga_name,ward_name,ward_code,polling_unit_code,polling_unit_name,delimitation_code,source_page,row_hash,artifact_id
      FROM gis_official_artifact_rows
      WHERE lower(state_name)=lower($1) AND lower(lga_name)=lower($2) AND lower(ward_name)=lower($3)
      ORDER BY polling_unit_code,polling_unit_name`,[c.state_name,c.lga_name,wardName]);
  }

  res.status(200).json({
    phase:'391.22',
    algorithm_version:'391.22.1',
    status:'OBSERVATION_ONLY',
    source:'STORED_PRIMARY_OFFICIAL_INEC_ARTIFACT_ROWS',
    candidate:{
      id:c.id,state:c.state_name,lga:c.lga_name,area_code:c.candidate_area_code,
      status:c.status,confidence:c.confidence,evidence_reference:c.evidence_reference
    },
    official_hierarchy:{
      state:c.state_name,
      lga:c.lga_name,
      ward_count:wards.length,
      wards,
      selected_ward:wardName||null,
      polling_unit_count:pollingUnits.length,
      polling_units:pollingUnits
    },
    assertions:{
      exact_candidate_ward:false,
      exact_candidate_polling_unit:false,
      geometry_promoted:false,
      candidate_mutation:false,
      certification_mutation:false
    },
    policy:'The endpoint enumerates authoritative INEC hierarchy evidence only. It does not infer which Ward or Polling Unit belongs to the candidate and does not promote coordinates or geometry.'
  });
}