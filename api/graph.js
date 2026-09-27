import { db } from 'hatchable';
import { authorizeGraphNode, graphTenantError } from '../lib/graphTenantAuthority.js';
export const access = 'member';
export const methods = ['GET','POST'];
export default async function(req,res){
 const m=req.member,b=req.body||{},q=req.query||{};
 const organizationId=String(q.organization_id||b.organization_id||'');
 if(!organizationId)return res.status(400).json({error:'organization_id is required'});
 if(req.method==='GET'){
  const type=String(q.type||'').toLowerCase(),id=String(q.id||'');
  if(!type||!id)return res.status(400).json({error:'type and id are required'});
  const auth=await authorizeGraphNode(req,organizationId,type,id); if(!auth.allowed)return graphTenantError(res,auth);
  const r=await db.query('SELECT id,from_type AS "fromType",from_id AS "fromId",relationship_type AS "relationshipType",to_type AS "toType",to_id AS "toId",status,confidence,evidence_ref AS "evidenceRef",notes,created_at AS "createdAt" FROM economic_graph_relationships WHERE organization_id=$1 AND ((from_type=$2 AND from_id=$3) OR (to_type=$2 AND to_id=$3)) ORDER BY created_at DESC',[organizationId,type,id]);
  return res.json(r.rows);
 }
 for(const k of ['fromType','fromId','relationshipType','toType','toId'])if(!b[k])return res.status(400).json({error:`${k} is required`});
 const allowed=['entity','asset','project','institution'];
 if(!allowed.includes(String(b.fromType).toLowerCase())||!allowed.includes(String(b.toType).toLowerCase()))return res.status(400).json({error:'Unsupported graph node type'});
 const fromAuth=await authorizeGraphNode(req,organizationId,b.fromType,b.fromId); if(!fromAuth.allowed)return graphTenantError(res,fromAuth);
 const toAuth=await authorizeGraphNode(req,organizationId,b.toType,b.toId); if(!toAuth.allowed)return graphTenantError(res,toAuth);
 const r=await db.query('INSERT INTO economic_graph_relationships(organization_id,from_type,from_id,relationship_type,to_type,to_id,status,confidence,evidence_ref,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(from_type,from_id,relationship_type,to_type,to_id) DO UPDATE SET organization_id=EXCLUDED.organization_id,status=EXCLUDED.status,confidence=EXCLUDED.confidence,evidence_ref=EXCLUDED.evidence_ref,notes=EXCLUDED.notes RETURNING id,from_type AS "fromType",from_id AS "fromId",relationship_type AS "relationshipType",to_type AS "toType",to_id AS "toId",status,confidence,evidence_ref AS "evidenceRef",notes,organization_id AS "organizationId"',[organizationId,String(b.fromType).toLowerCase(),b.fromId,b.relationshipType,String(b.toType).toLowerCase(),b.toId,b.status||'reported',b.confidence??null,b.evidenceRef||null,b.notes||null,m.id]);
 res.status(201).json(r.rows[0]);
}