import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];

const q=async(sql,p=[])=>{try{return (await db.query(sql,p)).rows}catch{return []}};

export default async function(req,res){
  const user=req.user||{};
  if(!user.id)return res.status(401).json({ok:false,error:'unauthorized'});
  const email=String(user.email||'').trim().toLowerCase();
  if(email!=='olugbenga1000@gmail.com')return res.status(403).json({ok:false,error:'founder_dashboard_not_authorized'});

  const assets=await q(`SELECT a.id,a.asset_identifier,a.name,a.description,a.status,a.current_state,a.jurisdiction_code,t.name AS asset_type FROM assets a LEFT JOIN asset_types t ON t.id=a.asset_type_id ORDER BY a.created_at DESC LIMIT 50`);
  const verification=await q(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status IN ('open','pending','under_review'))::int AS pending,COUNT(*) FILTER (WHERE status='closed')::int AS closed FROM verification_cases`);
  const verifiedAssets=await q(`SELECT COUNT(DISTINCT a.id)::int AS count FROM assets a JOIN verification_cases v ON v.asset_id=a.id WHERE v.status='closed'`);
  const valuations=await q(`SELECT COUNT(DISTINCT av.asset_id)::int AS valued_assets,COALESCE(SUM(av.value),0)::numeric AS total_value FROM asset_valuations av JOIN assets a ON a.id=av.asset_id WHERE av.value IS NOT NULL`);
  const tokenized=await q(`SELECT COUNT(DISTINCT asset_id)::int AS count FROM asset_investment_vehicles`);
  const evidence=await q(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE verification_status='Verified')::int AS verified FROM asset_evidence`);
  const risks=await q(`SELECT COUNT(DISTINCT asset_id)::int AS assessed FROM asset_risk_assessments`);

  const v=verification[0]||{total:0,pending:0,closed:0};
  const va=verifiedAssets[0]||{count:0};
  const val=valuations[0]||{valued_assets:0,total_value:0};
  const tok=tokenized[0]||{count:0};
  const ev=evidence[0]||{total:0,verified:0};
  const risk=risks[0]||{assessed:0};

  res.json({
    ok:true,
    founder:{authenticated:true,email:user.email||null},
    organization:{name:'ÒsánVault Africa',source:'existing production tenant'},
    kpis:{
      totalAssets:{value:assets.length,available:true,source:'assets'},
      verifiedAssets:{value:Number(va.count||0),available:true,source:'verification_cases:closed'},
      tokenizedAssets:{value:Number(tok.count||0),available:true,source:'asset_investment_vehicles'},
      assetsUnderManagement:{value:Number(val.total_value||0),available:Number(val.valued_assets||0)>0,source:Number(val.valued_assets||0)>0?'asset_valuations':'no_verified_valuation_source'},
      investors:{value:null,available:false,source:'no canonical investor registry'},
      activeVaults:{value:null,available:false,source:'no canonical vault registry'},
      transactions:{value:null,available:false,source:'no canonical transaction registry'},
      verificationQueue:{value:Number(v.pending||0),available:true,source:'verification_cases'}
    },
    portfolio:assets.map(a=>({id:a.id,identifier:a.asset_identifier,name:a.name,description:a.description,type:a.asset_type||'Unclassified',status:a.status,state:a.current_state,jurisdiction:a.jurisdiction_code})),
    verificationHealth:{casesTotal:Number(v.total||0),pending:Number(v.pending||0),closed:Number(v.closed||0),evidenceTotal:Number(ev.total||0),verifiedEvidence:Number(ev.verified||0),riskAssessedAssets:Number(risk.assessed||0),status:Number(v.pending||0)>0?'REVIEW_REQUIRED':Number(v.total||0)>0?'CONTROLLED':'NO_VERIFICATION_RECORDS'},
    footprint:{available:false,reason:'No validated asset coordinates are stored in the canonical asset registry.'},
    integrity:{syntheticData:false,inferenceForCoordinates:false,failClosed:true}
  });
}