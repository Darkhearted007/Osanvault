import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];

const q=async(sql,p=[])=>{try{return {rows:(await db.query(sql,p)).rows,available:true}}catch(error){console.error('executive_dashboard_query_error',String(error));return {rows:[],available:false,error:'query_unavailable'}}};

export default async function(req,res){
  const user=req.user||{};
  if(!user.id)return res.status(401).json({ok:false,error:'unauthorized'});
  const requestedOrgId=String(req.query?.organization_id||'').trim();
  const membership=await db.query(`SELECT m.organization_id,m.role FROM gis_organization_members m JOIN gis_organizations o ON o.id=m.organization_id WHERE m.member_id=$1 AND m.status='ACTIVE' AND o.status='ACTIVE' AND ($2='' OR m.organization_id::text=$2) ORDER BY o.created_at ASC LIMIT 1`,[String(user.id),requestedOrgId]);
  if(!membership.rows[0])return res.status(403).json({ok:false,error:'organization_access_denied'});
  const orgId=membership.rows[0].organization_id;
  if(membership.rows[0].role!=='ADMIN')return res.status(403).json({ok:false,error:'executive_role_not_authorized'});
  const position=await db.query(`SELECT position_code,position_name,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 AND position_code='CEO' LIMIT 1`,[orgId]);
  if(!position.rows[0])return res.status(403).json({ok:false,error:'executive_position_not_configured'});

  const assetCount=await q(`SELECT COUNT(*)::int AS count FROM gis_organization_assets WHERE organization_id=$1`,[orgId]);
  const assets=await q(`SELECT a.id,a.asset_identifier,a.name,a.description,a.status,a.current_state,a.jurisdiction_code,t.name AS asset_type
    FROM gis_organization_assets oa
    JOIN assets a ON a.id=oa.asset_id
    LEFT JOIN asset_types t ON t.id=a.asset_type_id
    WHERE oa.organization_id=$1
    ORDER BY a.created_at DESC LIMIT 50`,[orgId]);
  const verification=await q(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status IN ('open','pending','under_review'))::int AS pending,COUNT(*) FILTER (WHERE status='closed')::int AS closed
    FROM verification_cases v JOIN gis_organization_assets oa ON oa.asset_id::text=v.asset_id::text WHERE oa.organization_id=$1`,[orgId]);
  const verifiedAssets=await q(`SELECT COUNT(DISTINCT a.id)::int AS count FROM gis_organization_assets oa JOIN assets a ON a.id=oa.asset_id JOIN verification_cases v ON v.asset_id=a.id WHERE oa.organization_id=$1 AND v.status='closed'`,[orgId]);
  const valuations=await q(`SELECT COUNT(DISTINCT av.asset_id)::int AS valued_assets,COALESCE(SUM(av.value),0)::numeric AS total_value
    FROM gis_organization_assets oa JOIN asset_valuations av ON av.asset_id::text=oa.asset_id::text WHERE oa.organization_id=$1 AND av.value IS NOT NULL`,[orgId]);
  const tokenized=await q(`SELECT COUNT(DISTINCT v.asset_id)::int AS count FROM gis_organization_assets oa JOIN asset_investment_vehicles v ON v.asset_id::text=oa.asset_id::text WHERE oa.organization_id=$1`,[orgId]);
  const evidence=await q(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status='Verified')::int AS verified
    FROM asset_evidence e JOIN gis_organization_assets oa ON oa.asset_id::text=e.asset_id::text WHERE oa.organization_id=$1`,[orgId]);
  const risks=await q(`SELECT COUNT(DISTINCT r.asset_id)::int AS assessed FROM asset_risk_assessments r JOIN gis_organization_assets oa ON oa.asset_id::text=r.asset_id::text WHERE oa.organization_id=$1`,[orgId]);

  const v=verification.rows[0]||{total:0,pending:0,closed:0};
  const va=verifiedAssets.rows[0]||{count:0};
  const val=valuations.rows[0]||{valued_assets:0,total_value:0};
  const tok=tokenized.rows[0]||{count:0};
  const ev=evidence.rows[0]||{total:0,verified:0};
  const risk=risks.rows[0]||{assessed:0};

  res.json({
    ok:true,
    authenticatedUser:{authenticated:true,email:user.email||null,authorization:'organization_membership_and_role'},
    organization:{id:orgId,name:'ÒsánVault Africa Ltd',source:'existing production tenant',role:membership.rows[0].role,positionCode:position.rows[0].position_code,positionTitle:position.rows[0].position_name,dashboardKey:position.rows[0].dashboard_key},
    kpis:{
      totalAssets:{value:Number(assetCount.rows[0]?.count||0),available:assetCount.available,source:'gis_organization_assets'},
      verifiedAssets:{value:Number(va.count||0),available:verifiedAssets.available,source:'verification_cases:closed'},
      tokenizedAssets:{value:Number(tok.count||0),available:tokenized.available,source:'asset_investment_vehicles'},
      assetsUnderManagement:{value:Number(val.total_value||0),available:valuations.available&&Number(val.valued_assets||0)>0,source:Number(val.valued_assets||0)>0?'asset_valuations':'no_verified_valuation_source'},
      investors:{value:null,available:false,source:'no canonical investor registry'},
      activeVaults:{value:null,available:false,source:'no canonical vault registry'},
      transactions:{value:null,available:false,source:'no canonical transaction registry'},
      verificationQueue:{value:Number(v.pending||0),available:true,source:'verification_cases'}
    },
    portfolio:assets.rows.map(a=>({id:a.id,identifier:a.asset_identifier,name:a.name,description:a.description,type:a.asset_type||'Unclassified',status:a.status,state:a.current_state,jurisdiction:a.jurisdiction_code})),
    verificationHealth:{casesTotal:Number(v.total||0),pending:Number(v.pending||0),closed:Number(v.closed||0),evidenceTotal:Number(ev.total||0),verifiedEvidence:Number(ev.verified||0),riskAssessedAssets:Number(risk.assessed||0),status:Number(v.pending||0)>0?'REVIEW_REQUIRED':Number(v.total||0)>0?'CONTROLLED':'NO_VERIFICATION_RECORDS'},
    footprint:{available:false,reason:'No validated asset coordinates are stored in the canonical asset registry.'},
    integrity:{syntheticData:false,inferenceForCoordinates:false,failClosed:true}
  });
}