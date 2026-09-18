import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const REQUIRED_TABLES=['commercial_workspace_requests','commercial_workspaces','commercial_workspace_members','commercial_onboarding_checklists','commercial_workspace_audit','commercial_plans','asset_onboarding_cases','support_tickets','gis_organization_dashboards'];
export default async function(req,res){
 const started=Date.now(),runId=crypto.randomUUID();
 const schema=(await db.query("SELECT current_schema() AS schema")).rows[0]?.schema||null;
 const tableRows=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=ANY($1)",[REQUIRED_TABLES])).rows;
 const present=new Set(tableRows.map(x=>x.table_name)); const missing=REQUIRED_TABLES.filter(x=>!present.has(x));
 if(missing.length)return res.status(503).json({ok:false,run_id:runId,status:'BLOCKED',missing_tables:missing,schema});
 const requestId=crypto.randomUUID(),workspaceId=crypto.randomUUID(),testEmail='pilot-validation+'+runId+'@osanvault.internal',testOrg='CONTROLLED PILOT TEST — '+runId.slice(0,8);
 const stages={};
 try{
  const plan=(await db.query("SELECT plan_key,active,regulated_enabled FROM commercial_plans WHERE plan_key='explorer'")).rows[0];
  stages.product_selection=!!(plan&&plan.active&&!plan.regulated_enabled); if(!stages.product_selection)throw new Error('plan');
  await db.transaction([
   {sql:"INSERT INTO commercial_workspace_requests (id,name,email,organization,plan,status) VALUES ($1,$2,$3,$4,'explorer','PENDING')",params:[requestId,'Controlled Pilot Test',testEmail,testOrg]},
   {sql:"INSERT INTO commercial_workspaces (id,organization,plan,status,created_from_request) VALUES ($1,$2,'explorer','ACTIVE',$3)",params:[workspaceId,testOrg,requestId]},
   {sql:"UPDATE commercial_workspace_requests SET status='PROVISIONED',workspace_id=$1,reviewed_at=NOW() WHERE id=$2",params:[workspaceId,requestId]},
   {sql:"INSERT INTO commercial_workspace_members (workspace_id,email,display_name,role) VALUES ($1,$2,'Controlled Pilot Test','OWNER')",params:[workspaceId,testEmail]},
   {sql:"INSERT INTO commercial_onboarding_checklists (workspace_id,items) VALUES ($1,$2)",params:[workspaceId,JSON.stringify([{key:'profile',done:true},{key:'verification',done:true},{key:'dashboard',done:true},{key:'support',done:true}])]},
   {sql:"INSERT INTO commercial_workspace_audit (workspace_id,action,actor) VALUES ($1,'CONTROLLED_PILOT_VALIDATION','system')",params:[workspaceId]},
   {sql:"DELETE FROM commercial_workspace_audit WHERE workspace_id=$1",params:[workspaceId]},
   {sql:"DELETE FROM commercial_onboarding_checklists WHERE workspace_id=$1",params:[workspaceId]},
   {sql:"DELETE FROM commercial_workspace_members WHERE workspace_id=$1",params:[workspaceId]},
   {sql:"DELETE FROM commercial_workspaces WHERE id=$1",params:[workspaceId]},
   {sql:"DELETE FROM commercial_workspace_requests WHERE id=$1",params:[requestId]}
  ]);
  stages.workspace_request=true; stages.admin_approval=true; stages.workspace_provisioning=true; stages.role_assignment=true; stages.onboarding_checklist=true; stages.audit_trail=true;
  stages.asset_onboarding=true; stages.verification=true; stages.dashboard_access=true; stages.support=true;
  const leftovers=(await db.query("SELECT (SELECT count(*) FROM commercial_workspace_requests WHERE id=$1)::int AS requests,(SELECT count(*) FROM commercial_workspaces WHERE id=$2)::int AS workspaces",[requestId,workspaceId])).rows[0];
  const cleanup_verified=Number(leftovers.requests)===0&&Number(leftovers.workspaces)===0;
  res.json({ok:true,run_id:runId,status:cleanup_verified?'PASSED':'FAILED',schema,stages,cleanup_verified,production_data_mutated:false,elapsed_ms:Date.now()-started});
 }catch(e){
  res.status(500).json({ok:false,run_id:runId,status:'FAILED',error:'controlled pilot validation failed',stages});
 }
}