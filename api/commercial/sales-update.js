import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
const stages=new Set(['LEAD','QUALIFIED','UNDER_REVIEW','VERIFIED','APPROVED','PILOT','PAYING','EXPANDED']);
const pilots=new Set(['NOT_STARTED','PLANNED','ACTIVE','COMPLETED','PAUSED']);
export default async function(req,res){
 const b=req.body||{},id=String(b.request_id||'').trim(); if(!id)return res.status(400).json({error:'request_id is required'});
 const current=(await db.query("SELECT * FROM commercial_workspace_requests WHERE id=$1",[id])).rows[0]; if(!current)return res.status(404).json({error:'request not found'});
 const stage=b.sales_stage===undefined?current.sales_stage:String(b.sales_stage).trim().toUpperCase();
 const pilot=b.pilot_status===undefined?current.pilot_status:String(b.pilot_status).trim().toUpperCase();
 if(!stages.has(stage))return res.status(400).json({error:'invalid_sales_stage'}); if(!pilots.has(pilot))return res.status(400).json({error:'invalid_pilot_status'});
 const segment=b.customer_segment===undefined?current.customer_segment:String(b.customer_segment||'').trim().slice(0,160)||null;
 const country=b.country===undefined?current.country:String(b.country||'').trim().slice(0,120)||null;
 const useCase=b.use_case===undefined?current.use_case:String(b.use_case||'').trim().slice(0,1000)||null;
 const value=b.expected_contract_value===undefined?current.expected_contract_value:(b.expected_contract_value===''?null:Number(b.expected_contract_value));
 if(value!==null && (!Number.isFinite(value)||value<0))return res.status(400).json({error:'invalid_expected_contract_value'});
 const close=b.expected_close_date===undefined?current.expected_close_date:(b.expected_close_date?String(b.expected_close_date):null);
 const owner=b.sales_owner===undefined?current.sales_owner:String(b.sales_owner||'').trim().slice(0,200)||null;
 const next=b.next_action===undefined?current.next_action:String(b.next_action||'').trim().slice(0,1000)||null;
 const start=b.pilot_start_at===undefined?current.pilot_start_at:(b.pilot_start_at?String(b.pilot_start_at):null);
 const end=b.pilot_end_at===undefined?current.pilot_end_at:(b.pilot_end_at?String(b.pilot_end_at):null);
 const paid=b.paid_at===undefined?current.paid_at:(b.paid_at?String(b.paid_at):null);
 const outcome=b.outcome_notes===undefined?current.outcome_notes:String(b.outcome_notes||'').trim().slice(0,3000)||null;
 const notes=String(b.notes||'').trim().slice(0,2000);
 const actor=String(req.member?.email||'admin').slice(0,200);
 await db.transaction([
  {sql:"UPDATE commercial_workspace_requests SET sales_stage=$2,customer_segment=$3,country=$4,use_case=$5,expected_contract_value=$6,expected_close_date=$7,sales_owner=$8,next_action=$9,pilot_status=$10,pilot_start_at=$11,pilot_end_at=$12,paid_at=$13,outcome_notes=$14 WHERE id=$1",params:[id,stage,segment,country,useCase,value,close,owner,next,pilot,start,end,paid,outcome]},
  {sql:"INSERT INTO commercial_workspace_request_sales_activity (request_id,activity_type,notes,actor) VALUES ($1,$2,$3,$4)",params:[id,stage==='PILOT'?'PILOT_UPDATE':stage==='PAYING'?'PAYING_UPDATE':'SALES_UPDATE',notes||null,actor]},
  {sql:"INSERT INTO commercial_workspace_request_audit (request_id,action,actor,notes) VALUES ($1,'SALES_UPDATE',$2,$3)",params:[id,actor,notes||('Stage '+stage+'; pilot '+pilot)]}
 ]);
 const row=(await db.query("SELECT id,organization,sales_stage,customer_segment,country,use_case,expected_contract_value,expected_close_date,sales_owner,next_action,pilot_status,pilot_start_at,pilot_end_at,paid_at,outcome_notes FROM commercial_workspace_requests WHERE id=$1",[id])).rows[0];
 res.json({request:row});
}