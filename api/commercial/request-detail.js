import { db } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const id=String(req.query?.request_id||'').trim(); if(!id)return res.status(400).json({error:'request_id is required'});
 const q=await db.query("SELECT id,name,email,organization,organization_type,plan,status,verification_status,verification_reviewer,verification_notes,rejection_reason,official_website,official_domain,intended_use,geography_of_interest,sales_stage,customer_segment,country,use_case,expected_contract_value,expected_close_date,sales_owner,next_action,pilot_status,pilot_start_at,pilot_end_at,paid_at,outcome_notes,created_at,verification_started_at,verification_completed_at,approval_at,reviewed_at,workspace_id FROM commercial_workspace_requests WHERE id=$1",[id]);
 if(!q.rows.length)return res.status(404).json({error:'request not found'});
 const e=await db.query("SELECT id,evidence_type,title,source_reference,storage_key,content_hash,verification_status,submitted_by,created_at,reviewed_at,review_note FROM commercial_workspace_request_evidence WHERE request_id=$1 ORDER BY created_at DESC",[id]);
 const a=await db.query("SELECT id,action,actor,notes,created_at FROM commercial_workspace_request_audit WHERE request_id=$1 ORDER BY created_at DESC",[id]);
 const s=await db.query("SELECT id,activity_type,notes,actor,created_at FROM commercial_workspace_request_sales_activity WHERE request_id=$1 ORDER BY created_at DESC",[id]);
 const types=e.rows.filter(x=>x.verification_status==='VERIFIED').map(x=>x.evidence_type);
 const readiness={incorporation:types.includes('INCORPORATION'),representative_authorization:types.includes('REPRESENTATIVE_AUTHORIZATION'),ready_for_verification:types.includes('INCORPORATION')&&types.includes('REPRESENTATIVE_AUTHORIZATION')};
 res.json({request:q.rows[0],evidence:e.rows,audit:a.rows,sales_activity:s.rows,verification_readiness:readiness});
}