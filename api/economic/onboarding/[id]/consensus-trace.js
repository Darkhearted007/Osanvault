import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];

async function profileFor(id,memberId){
 const q=await db.query('SELECT id,owner_id,display_name FROM economic_onboarding_profiles WHERE id=$1',[id]);
 if(!q.rows.length)return {status:404,body:{error:'economic_profile_not_found'}};
 if(q.rows[0].owner_id!==memberId)return {status:403,body:{error:'forbidden'}};
 return q.rows[0];
}

async function inputs(id){
 const e=await db.query(`SELECT id,evidence_category,title,source_type,verification_status,metadata FROM economic_evidence_vault WHERE profile_id=$1 ORDER BY created_at DESC`,[id]);
 const r=await db.query(`SELECT id,relationship_type,to_type,to_id,status,confidence,evidence_ref,notes FROM economic_graph_relationships WHERE from_type='economic_business' AND from_id=$1 ORDER BY created_at DESC`,[id]);
 const verifiedEvidence=e.rows.filter(x=>x.verification_status==='verified');
 const reviewedEvidence=e.rows.filter(x=>['reviewed','verified'].includes(x.verification_status));
 const verifiedRelationships=r.rows.filter(x=>x.status==='verified');
 const evidencedRelationships=r.rows.filter(x=>x.status==='verified'||x.status==='evidenced'||x.evidence_ref);
 const highConfidence=r.rows.filter(x=>Number(x.confidence||0)>=0.8);
 const pct=(a,b)=>b?Math.round(a/b*100):0;
 const evidenceScore=pct(verifiedEvidence.length,e.rows.length);
 const verificationScore=pct(verifiedRelationships.length,r.rows.length);
 const evidenceNetworkScore=pct(evidencedRelationships.length,r.length);
 const confidenceScore=pct(highConfidence.length,r.length);
 const networkScore=Math.round(evidenceNetworkScore*.35+verificationScore*.35+confidenceScore*.30);
 const agreementScore=Math.round((Math.min(evidenceScore,evidenceNetworkScore)+Math.min(evidenceScore,verificationScore))/2);
 const consensusScore=Math.round(evidenceScore*.30+verificationScore*.25+networkScore*.30+agreementScore*.15);
 return {e,r,verifiedEvidence,reviewedEvidence,verifiedRelationships,evidencedRelationships,highConfidence,evidenceScore,verificationScore,evidenceNetworkScore,confidenceScore,networkScore,agreementScore,consensusScore};
}

export default async function(req,res){
 const id=req.params.id; const p=await profileFor(id,req.member.id); if(p.status)return res.status(p.status).json(p.body);
 const m=await inputs(id);
 const latest=await db.query(`SELECT id,consensus_score AS "consensusScore",created_at AS "createdAt" FROM economic_consensus_reconciliation_runs WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[id]);
 const rec=latest.rows[0];
 if(req.method==='GET'){
  const trace=await db.query(`SELECT component,score,source_count AS "sourceCount",verified_source_count AS "verifiedSourceCount",evidence_refs AS "evidenceRefs",relationship_refs AS "relationshipRefs",explanation,created_at AS "createdAt" FROM economic_consensus_provenance WHERE profile_id=$1 ORDER BY created_at DESC,component`,[id]);
  const conflicts=await db.query(`SELECT conflict_type AS "conflictType",subject,supporting_refs AS "supportingRefs",opposing_refs AS "opposingRefs",resolution_state AS "resolutionState",explanation,created_at AS "createdAt" FROM economic_consensus_conflicts WHERE profile_id=$1 ORDER BY created_at DESC`,[id]);
  return res.json({profileId:id,consensus:{score:m.consensusScore,components:{evidenceScore:m.evidenceScore,verificationScore:m.verificationScore,networkScore:m.networkScore,agreementScore:m.agreementScore}},trace:trace.rows,conflicts:conflicts.rows,latestReconciliation:rec||null,principle:'The trace explains how recorded evidence and relationship verification contributed to the consensus signal. It is an audit aid, not an independent statement of truth or an automatic financing decision.'});
 }
 if(!rec)return res.status(409).json({error:'consensus_reconciliation_required',message:'Run consensus reconciliation before creating a provenance trace.'});
 const evidenceRefs=m.verifiedEvidence.map(x=>({id:x.id,title:x.title,category:x.evidence_category,status:x.verification_status}));
 const relationshipRefs=m.verifiedRelationships.map(x=>({id:x.id,type:x.relationship_type,toType:x.to_type,toId:x.to_id,status:x.status,confidence:x.confidence,evidenceRef:x.evidence_ref}));
 const components=[
  {name:'evidence',score:m.evidenceScore,sourceCount:m.e.length,verifiedCount:m.verifiedEvidence.length,explanation:`${m.verifiedEvidence.length} of ${m.e.length} evidence records are verified.`},
  {name:'verification',score:m.verificationScore,sourceCount:m.r.length,verifiedCount:m.verifiedRelationships.length,explanation:`${m.verifiedRelationships.length} of ${m.r.length} economic relationships are verified.`},
  {name:'network',score:m.networkScore,sourceCount:m.r.length,verifiedCount:m.verifiedRelationships.length,explanation:`Network score combines evidenced relationships (${m.evidenceNetworkScore}%), verified relationships (${m.verificationScore}%) and high-confidence relationships (${m.confidenceScore}%).`},
  {name:'agreement',score:m.agreementScore,sourceCount:m.e.length+m.r.length,verifiedCount:m.verifiedEvidence.length+m.verifiedRelationships.length,explanation:`Agreement is conservative: it uses the lower of evidence coverage versus network evidence coverage and verification coverage.`}
 ];
 for(const c of components){await db.query(`INSERT INTO economic_consensus_provenance(reconciliation_id,profile_id,component,score,source_count,verified_source_count,evidence_refs,relationship_refs,explanation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[rec.id,id,c.name,c.score,c.sourceCount,c.verifiedCount,JSON.stringify(evidenceRefs),JSON.stringify(relationshipRefs),c.explanation]);}
 const conflicts=[];
 const relByType={}; for(const x of m.r){const k=x.relationship_type||'unknown';(relByType[k]??=[]).push(x);}
 for(const [type,items] of Object.entries(relByType)){const verified=items.filter(x=>x.status==='verified');const rejected=items.filter(x=>x.status==='rejected');if(verified.length&&rejected.length){conflicts.push({type:'relationship_status_conflict',subject:type,supporting:verified.map(x=>({id:x.id,evidenceRef:x.evidence_ref})),opposing:rejected.map(x=>({id:x.id,evidenceRef:x.evidence_ref})),explanation:`The same relationship type contains both verified and rejected assertions; human review is required.`});}}
 for(const c of conflicts){await db.query(`INSERT INTO economic_consensus_conflicts(reconciliation_id,profile_id,conflict_type,subject,supporting_refs,opposing_refs,resolution_state,explanation) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[rec.id,id,c.type,c.subject,JSON.stringify(c.supporting),JSON.stringify(c.opposing),'pending_review',c.explanation]);}
 res.status(201).json({profileId:id,reconciliationId:rec.id,trace:{consensusScore:m.consensusScore,components,conflictsCreated:conflicts.length,conflicts},principle:'Consensus provenance is now persisted at component level with direct evidence and relationship references. Conflicting assertions remain pending review rather than being silently averaged.'});
}