import { db } from 'hatchable';
import { authorizeGraphNode, graphTenantError } from '../../lib/graphTenantAuthority.js';
export const access = 'member';
export const methods = ['GET','POST'];
export default async function(req,res){
 const q=req.query||{},b=req.body||{},type=String(q.type||b.type||'').toLowerCase(),id=String(q.id||b.id||''),organizationId=String(q.organization_id||b.organization_id||'');
 if(!['entity','asset','project','institution'].includes(type)||!id||!organizationId)return res.status(400).json({error:'type, id and organization_id are required'});
 const auth=await authorizeGraphNode(req,organizationId,type,id); if(!auth.allowed)return graphTenantError(res,auth);
 if(req.method==='GET'){
  const r=await db.query('SELECT id,node_type AS "nodeType",node_id AS "nodeId",state,score,strengths,dependencies,risks,opportunities,next_actions AS "nextActions",relationship_count AS "relationshipCount",trusted_relationship_count AS "trustedRelationshipCount",created_at AS "createdAt" FROM graph_assessments WHERE organization_id=$1 AND node_type=$2 AND node_id=$3 ORDER BY created_at DESC LIMIT 1',[organizationId,type,id]);
  return res.json(r.rows[0]||null);
 }
 const rel=await db.query('SELECT relationship_type,status,confidence,evidence_ref FROM economic_graph_relationships WHERE organization_id=$1 AND ((from_type=$2 AND from_id=$3) OR (to_type=$2 AND to_id=$3))',[organizationId,type,id]);
 const rows=rel.rows,trusted=rows.filter(x=>x.status==='verified'||Number(x.confidence||0)>=80),strengths=[],dependencies=[],risks=[],opportunities=[],nextActions=[],counts={};
 for(const x of rows)counts[x.relationship_type]=(counts[x.relationship_type]||0)+1;
 for(const [k,n] of Object.entries(counts)){if(['owns','operates','supports','produces','partners_with','benefits_from'].includes(k))strengths.push(`${n} ${k.replaceAll('_',' ')} relationship${n>1?'s':''}`);if(['depends_on','supplied_by','finances'].includes(k))dependencies.push(`${n} ${k.replaceAll('_',' ')} relationship${n>1?'s':''}`);if(['leases','depends_on'].includes(k))risks.push(`Review ${k.replaceAll('_',' ')} exposure`);if(['partners_with','produces','benefits_from','supports'].includes(k))opportunities.push(`Assess ${k.replaceAll('_',' ')} for project expansion`)}
 if(!rows.length){risks.push('Insufficient graph context');nextActions.push('Add verified relationships to build a meaningful graph assessment')}
 if(rows.length&&trusted.length<rows.length)nextActions.push('Verify reported relationships before relying on the graph for institutional decisions');
 if(rows.length>=3)opportunities.push('Assess the connected network for aggregation or project-finance potential');
 const score=rows.length?Math.min(100,Math.round((trusted.length/rows.length)*70+Math.min(30,rows.length*5))):0,state=score>=80?'strong':score>=50?'developing':'insufficient_context';if(!strengths.length)strengths.push('No verified network strength established yet');
 const a=await db.query('INSERT INTO graph_assessments(organization_id,node_type,node_id,state,score,strengths,dependencies,risks,opportunities,next_actions,relationship_count,trusted_relationship_count,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,node_type AS "nodeType",node_id AS "nodeId",state,score,strengths,dependencies,risks,opportunities,next_actions AS "nextActions",relationship_count AS "relationshipCount",trusted_relationship_count AS "trustedRelationshipCount",created_at AS "createdAt",organization_id AS "organizationId"',[organizationId,type,id,state,score,JSON.stringify(strengths),JSON.stringify(dependencies),JSON.stringify(risks),JSON.stringify(opportunities),JSON.stringify(nextActions),rows.length,trusted.length,req.member.id]);
 res.status(201).json(a.rows[0]);
}