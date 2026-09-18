import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
 const id=String(req.body?.request_id||''); if(!id)return res.status(400).json({error:'request_id is required'});
 const q=await db.query("SELECT * FROM commercial_workspace_requests WHERE id=$1",[id]); if(!q.rows.length)return res.status(404).json({error:'request not found'});
 const r=q.rows[0]; if(r.status==='PROVISIONED')return res.json({status:r.status,workspace_id:r.workspace_id});
 if(r.status!=='APPROVED')return res.status(409).json({error:'request_not_provisionable',status:r.status});
 const p=(await db.query("SELECT plan_key,active,regulated_enabled FROM commercial_plans WHERE plan_key=$1",[r.plan])).rows[0];
 if(!p||!p.active||p.regulated_enabled)return res.status(409).json({error:'plan_not_eligible_for_provisioning'});
 try{
  const tx=await db.transaction([
   {sql:"INSERT INTO commercial_workspaces (organization,plan,status,created_from_request) VALUES ($1,$2,'ACTIVE',$3) RETURNING id,organization,plan,status",params:[r.organization,r.plan,r.id]},
   {sql:"UPDATE commercial_workspace_requests SET status='PROVISIONED',workspace_id=(SELECT id FROM commercial_workspaces WHERE created_from_request=$1 ORDER BY created_at DESC LIMIT 1),reviewed_at=NOW() WHERE id=$1 AND status='PENDING'",params:[r.id]},
   {sql:"INSERT INTO commercial_workspace_members (workspace_id,email,display_name,role) VALUES ((SELECT id FROM commercial_workspaces WHERE created_from_request=$1 ORDER BY created_at DESC LIMIT 1),$2,$3,'OWNER')",params:[r.id,r.email,r.name]},
   {sql:"INSERT INTO commercial_onboarding_checklists (workspace_id,items) VALUES ((SELECT id FROM commercial_workspaces WHERE created_from_request=$1 ORDER BY created_at DESC LIMIT 1),$2)",params:[r.id,JSON.stringify([{key:'profile',label:'Complete organization profile',done:false},{key:'verification',label:'Complete asset verification',done:false},{key:'dashboard',label:'Review first dashboard',done:false},{key:'support',label:'Confirm support contact',done:false}])]},
   {sql:"INSERT INTO commercial_workspace_audit (workspace_id,action,actor) VALUES ((SELECT id FROM commercial_workspaces WHERE created_from_request=$1 ORDER BY created_at DESC LIMIT 1),'PROVISIONED',$2)",params:[r.id,req.member?.email||'admin']}
  ]);
  const ws=tx.results[0].rows[0]; res.status(201).json({status:'PROVISIONED',workspace_id:ws.id,organization:ws.organization,plan:ws.plan,owner_email:r.email});
 }catch(e){res.status(500).json({error:'workspace_provisioning_failed'})}
}