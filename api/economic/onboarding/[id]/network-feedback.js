import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];

async function loadProfile(id, memberId){
  const p=await db.query('SELECT id,owner_id,display_name FROM economic_onboarding_profiles WHERE id=$1',[id]);
  if(!p.rows.length)return {error:{status:404,body:{error:'economic_profile_not_found'}}};
  if(p.rows[0].owner_id!==memberId)return {error:{status:403,body:{error:'forbidden'}}};
  return {profile:p.rows[0]};
}

async function calculate(id){
  const r=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status IN ('evidenced','verified') OR evidence_ref IS NOT NULL)::int AS evidenced,COUNT(*) FILTER (WHERE status='verified')::int AS verified,COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,COUNT(*) FILTER (WHERE confidence IS NOT NULL AND confidence>=0.8)::int AS high_confidence,COUNT(DISTINCT to_type)::int AS node_types,COUNT(DISTINCT to_id)::int AS distinct_targets FROM economic_graph_relationships WHERE from_type='economic_business' AND from_id=$1`,[id]);
  const x=r.rows[0];
  const total=Number(x.total||0), evidenced=Number(x.evidenced||0), verified=Number(x.verified||0), highConfidence=Number(x.high_confidence||0), nodeTypes=Number(x.node_types||0), distinctTargets=Number(x.distinct_targets||0);
  const pct=(n,d=total)=>d?Math.round(n/d*100):0;
  const evidenceCoverage=pct(evidenced), verificationCoverage=pct(verified), confidenceCoverage=pct(highConfidence);
  const diversity=total?Math.min(100,Math.round(distinctTargets/total*100)):0;
  const typeRows=await db.query(`SELECT relationship_type,COUNT(*)::int AS count FROM economic_graph_relationships WHERE from_type='economic_business' AND from_id=$1 GROUP BY relationship_type`,[id]);
  const counts=typeRows.rows.map(x=>Number(x.count));
  const concentration=total?Math.round(Math.max(...counts,0)/total*100):0;
  const connectivityScore=Math.round((diversity+Math.min(100,100-concentration)+verificationCoverage+confidenceCoverage)/4);
  const trustedNetworkScore=Math.round(verificationCoverage*.45+evidenceCoverage*.25+confidenceCoverage*.15+connectivityScore*.15);
  const state=trustedNetworkScore>=75?'strengthening':trustedNetworkScore>=50?'developing':'insufficient_evidence';
  return {total,evidenced,verified,rejected:Number(x.rejected||0),highConfidence,nodeTypes,distinctTargets,evidenceCoverage,verificationCoverage,confidenceCoverage,diversity,concentration,connectivityScore,trustedNetworkScore,state};
}

export default async function(req,res){
  const id=req.params.id;
  const loaded=await loadProfile(id,req.member.id);
  if(loaded.error)return res.status(loaded.error.status).json(loaded.error.body);
  const metrics=await calculate(id);
  const latest=await db.query(`SELECT changes,created_at AS "createdAt" FROM economic_network_feedback_runs WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[id]);
  if(req.method==='GET'){
    const actions=[];
    if(!metrics.total)actions.push('Record your first supplier, customer, market or institutional relationship.');
    else if(metrics.evidenceCoverage<60)actions.push('Attach evidence to recorded relationships.');
    else if(metrics.verificationCoverage<60)actions.push('Review and verify more evidenced relationships.');
    if(metrics.confidenceCoverage<50&&metrics.total)actions.push('Improve confidence on low-confidence relationships with stronger evidence.');
    if(!actions.length)actions.push('Keep network evidence and verification current as relationships change.');
    return res.json({profileId:id,network:{totalRelationships:metrics.total,evidenced:metrics.evidenced,verified:metrics.verified,rejected:metrics.rejected,highConfidence:metrics.highConfidence,nodeTypes:metrics.nodeTypes,distinctTargets:metrics.distinctTargets,evidenceCoverage:metrics.evidenceCoverage,verificationCoverage:metrics.verificationCoverage,confidenceCoverage:metrics.confidenceCoverage,connectivityScore:metrics.connectivityScore,trustedNetworkScore:metrics.trustedNetworkScore,state:metrics.state},feedback:{actions,lastRun:latest.rows[0]||null},principle:'Relationship changes are reflected in network evidence and verification coverage; these signals describe recorded evidence and do not independently establish truth, creditworthiness, fraud, valuation or financing approval.'});
  }
  const previous=latest.rows[0]?.changes||[];
  const changes=[];
  const previousMetrics=await db.query(`SELECT relationship_count,evidenced_relationship_count,verified_relationship_count,connectivity_score,trusted_network_score FROM economic_network_feedback_runs WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[id]);
  if(previousMetrics.rows.length){const p=previousMetrics.rows[0];if(Number(p.relationship_count)!==metrics.total)changes.push({field:'relationshipCount',from:Number(p.relationship_count),to:metrics.total});if(Number(p.evidenced_relationship_count)!==metrics.evidenced)changes.push({field:'evidencedRelationships',from:Number(p.evidenced_relationship_count),to:metrics.evidenced});if(Number(p.verified_relationship_count)!==metrics.verified)changes.push({field:'verifiedRelationships',from:Number(p.verified_relationship_count),to:metrics.verified});if(Number(p.connectivity_score)!==metrics.connectivityScore)changes.push({field:'connectivityScore',from:Number(p.connectivity_score),to:metrics.connectivityScore});if(Number(p.trusted_network_score)!==metrics.trustedNetworkScore)changes.push({field:'trustedNetworkScore',from:Number(p.trusted_network_score),to:metrics.trustedNetworkScore});}
  await db.query(`INSERT INTO economic_network_feedback_runs(profile_id,relationship_count,evidenced_relationship_count,verified_relationship_count,high_confidence_relationship_count,evidence_coverage,verification_coverage,confidence_coverage,connectivity_score,trusted_network_score,state,changes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,metrics.total,metrics.evidenced,metrics.verified,metrics.highConfidence,metrics.evidenceCoverage,metrics.verificationCoverage,metrics.confidenceCoverage,metrics.connectivityScore,metrics.trustedNetworkScore,metrics.state,JSON.stringify(changes)]);
  await db.query(`INSERT INTO graph_assessments(node_type,node_id,state,score,strengths,dependencies,risks,opportunities,next_actions,relationship_count,trusted_relationship_count,created_by) VALUES('economic_business',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[id,metrics.state,metrics.trustedNetworkScore,JSON.stringify([`${metrics.verified} verified relationship${metrics.verified===1?'':'s'}`,`${metrics.evidenced} evidenced relationship${metrics.evidenced===1?'':'s'}`]),JSON.stringify(metrics.total?['Network evidence should be maintained as relationships change.']:['No network context yet']),JSON.stringify(metrics.verificationCoverage<60?['Limited relationship verification coverage']:[]),JSON.stringify(metrics.total>=3?['Assess connected suppliers, customers, markets and institutions for aggregation opportunities']:[]),JSON.stringify(metrics.verificationCoverage<60?['Verify more evidenced relationships']:['Keep evidence current']),metrics.total,metrics.verified,req.member.id]);
  res.status(201).json({profileId:id,feedbackRun:{network:metrics,changes,priorRunChanged:changes.length>0},principle:'The feedback loop recalculates network evidence quality after relationship-state changes and writes the resulting assessment back into the graph assessment layer.'});
}