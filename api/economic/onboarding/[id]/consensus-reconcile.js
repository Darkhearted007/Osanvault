import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];

async function owner(id,memberId){
 const p=await db.query('SELECT id,owner_id,display_name FROM economic_onboarding_profiles WHERE id=$1',[id]);
 if(!p.rows.length)return {status:404,body:{error:'economic_profile_not_found'}};
 if(p.rows[0].owner_id!==memberId)return {status:403,body:{error:'forbidden'}};
 return {profile:p.rows[0]};
}

async function metrics(id){
 const evidence=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE verification_status IN ('reviewed','verified'))::int AS reviewed,COUNT(*) FILTER (WHERE verification_status='verified')::int AS verified FROM economic_evidence_vault WHERE profile_id=$1`,[id]);
 const graph=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status IN ('evidenced','verified') OR evidence_ref IS NOT NULL)::int AS evidenced,COUNT(*) FILTER (WHERE status='verified')::int AS verified,COUNT(*) FILTER (WHERE confidence IS NOT NULL AND confidence>=0.8)::int AS high_confidence FROM economic_graph_relationships WHERE from_type='economic_business' AND from_id=$1`,[id]);
 const x=evidence.rows[0],g=graph.rows[0];
 const eTotal=Number(x.total||0),eReviewed=Number(x.reviewed||0),eVerified=Number(x.verified||0),gTotal=Number(g.total||0),gEvidence=Number(g.evidenced||0),gVerified=Number(g.verified||0),gHigh=Number(g.high_confidence||0);
 const pct=(n,d)=>d?Math.round(n/d*100):0;
 const evidenceScore=pct(eVerified,eTotal);
 const verificationScore=pct(gVerified,gTotal);
 const networkEvidenceScore=pct(gEvidence,gTotal);
 const networkConfidenceScore=pct(gHigh,gTotal);
 const networkScore=Math.round((networkEvidenceScore*.35)+(verificationScore*.35)+(networkConfidenceScore*.30));
 const agreementScore=Math.round((Math.min(evidenceScore,networkEvidenceScore)*.5)+(Math.min(evidenceScore,verificationScore)*.5));
 const consensusScore=Math.round(evidenceScore*.30+verificationScore*.25+networkScore*.30+agreementScore*.15);
 const state=consensusScore>=80?'high_consensus':consensusScore>=60?'moderate_consensus':consensusScore>=40?'developing_consensus':'insufficient_evidence';
 const reasons=[];
 if(eTotal===0)reasons.push('No evidence records are available yet.');
 else if(evidenceScore>=70)reasons.push(`Evidence vault verification coverage is ${evidenceScore}%.`); else reasons.push(`Evidence vault verification coverage is ${evidenceScore}%; additional verified evidence is needed.`);
 if(gTotal===0)reasons.push('No economic relationships are recorded yet.');
 else if(verificationScore>=60)reasons.push(`Verified relationship coverage is ${verificationScore}%.`); else reasons.push(`Verified relationship coverage is ${verificationScore}%; network assertions remain partly unverified.`);
 if(agreementScore>=70)reasons.push('Evidence and network verification signals are broadly aligned.'); else reasons.push('Evidence and network signals are not yet strongly aligned, so consensus remains conservative.');
 if(networkConfidenceScore<50&&gTotal)reasons.push('A large share of network relationships lacks high-confidence support.');
 const next=[];
 if(evidenceScore<70)next.push('Verify more evidence-vault records.');
 if(verificationScore<60)next.push('Verify more economic relationships.');
 if(networkConfidenceScore<50&&gTotal)next.push('Strengthen supporting evidence for low-confidence relationships.');
 if(!next.length)next.push('Maintain current evidence and verification quality as the network evolves.');
 return {evidenceScore,verificationScore,networkEvidenceScore,networkConfidenceScore,networkScore,agreementScore,consensusScore,state,reasons,next,evidenceCount:eTotal,relationshipCount:gTotal};
}

export default async function(req,res){
 const id=req.params.id; const auth=await owner(id,req.member.id); if(auth.status)return res.status(auth.status).json(auth.body);
 const m=await metrics(id);
 const prior=await db.query(`SELECT consensus_score AS "consensusScore",created_at AS "createdAt" FROM economic_consensus_reconciliation_runs WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[id]);
 if(req.method==='GET')return res.json({profileId:id,consensus:{score:m.consensusScore,state:m.state,components:{evidenceScore:m.evidenceScore,verificationScore:m.verificationScore,networkScore:m.networkScore,agreementScore:m.agreementScore},reasons:m.reasons,nextActions:m.next},previous:prior.rows[0]||null,principle:'Consensus is a conservative synthesis of recorded evidence, relationship verification and network agreement. It does not independently establish truth, creditworthiness, valuation, fraud or financing approval.'});
 const previousScore=prior.rows.length?Number(prior.rows[0].consensusScore):null;
 const changes=[];
 if(previousScore!==null&&previousScore!==m.consensusScore)changes.push({field:'consensusScore',from:previousScore,to:m.consensusScore,delta:m.consensusScore-previousScore});
 const delta=m.consensusScore-(previousScore===null?m.consensusScore:previousScore);
 if(m.agreementScore<70)changes.push({field:'agreement',reason:'Evidence and network verification are not yet strongly aligned'});
 await db.query(`INSERT INTO economic_consensus_reconciliation_runs(profile_id,previous_score,consensus_score,evidence_score,verification_score,network_score,agreement_score,state,reasons,changes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,previousScore,m.consensusScore,m.evidenceScore,m.verificationScore,m.networkScore,m.agreementScore,m.state,JSON.stringify(m.reasons),JSON.stringify(changes)]);
 await db.query(`INSERT INTO graph_assessments(node_type,node_id,state,score,strengths,dependencies,risks,opportunities,next_actions,relationship_count,trusted_relationship_count,created_by) VALUES('economic_business',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[id,m.state,m.consensusScore,JSON.stringify(m.reasons.filter(x=>x.includes('coverage is'))),JSON.stringify(m.next),JSON.stringify(m.agreementScore<70?['Evidence/network disagreement requires review']:[]),JSON.stringify(m.consensusScore>=60?['Consensus may support deeper institutional review when independently validated']:[]),JSON.stringify(m.next),m.relationshipCount,Math.round(m.verificationScore/100*m.relationshipCount),req.member.id]);
 res.status(201).json({profileId:id,reconciliation:{consensusScore:m.consensusScore,state:m.state,delta:previousScore===null?null:delta,components:{evidenceScore:m.evidenceScore,verificationScore:m.verificationScore,networkScore:m.networkScore,agreementScore:m.agreementScore},reasons:m.reasons,nextActions:m.next,changed:changes.length>0},principle:'The reconciliation feeds the conservative consensus result back into the graph assessment layer; it never converts evidence signals into an automatic financial decision.'});
}