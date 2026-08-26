import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
 const b=req.body||{}; if(!b.lead_id)return res.status(400).json({error:'lead_id is required'});
 const lead=(await db.query('SELECT id,name,email,company FROM crm_leads WHERE id=$1',[b.lead_id])).rows[0];
 if(!lead)return res.status(404).json({error:'lead not found'});
 const existing=(await db.query('SELECT id,stage FROM crm_opportunities WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 1',[lead.id])).rows[0];
 if(lead.organization_id)return res.status(409).json({error:'lead already converted',organization_id:lead.organization_id});
 const org=(await db.query("INSERT INTO gis_organizations (name,organization_type,status,created_by) VALUES ($1,$2,$3,$4) RETURNING id,name,organization_type,status",[lead.company||lead.name,'commercial','ACTIVE',req.member.id])).rows[0];
 const opp=existing?.id ? (await db.query("UPDATE crm_opportunities SET stage='won',updated_at=now() WHERE id=$1 RETURNING id,stage",[existing.id])).rows[0] : (await db.query("INSERT INTO crm_opportunities (lead_id,stage) VALUES ($1,'won') RETURNING id,stage",[lead.id])).rows[0];
 await db.query("UPDATE crm_leads SET status='converted',organization_id=$1,updated_at=now() WHERE id=$2",[org.id,lead.id]);
 await db.query("INSERT INTO crm_events (lead_id,actor_id,event_type,metadata) VALUES ($1,$2,'converted',$3)",[lead.id,req.member.id,JSON.stringify({organization_id:org.id,opportunity_id:opp.id})]);
 res.status(201).json({conversion:{lead_id:lead.id,organization_id:org.id,opportunity_id:opp.id,status:'converted'}});
}