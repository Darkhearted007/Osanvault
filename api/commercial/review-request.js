import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
const transitions={
 START_REVIEW:{from:['PENDING'],to:'UNDER_REVIEW'},
 VERIFY:{from:['UNDER_REVIEW'],to:'VERIFIED'},
 REJECT:{from:['UNDER_REVIEW'],to:'REJECTED'},
 APPROVE:{from:['VERIFIED'],to:'APPROVED'}
};
export default async function(req,res){
 const id=String(req.body?.request_id||'').trim();
 const action=String(req.body?.action||'').trim().toUpperCase();
 const notes=String(req.body?.notes||'').trim();
 const reason=String(req.body?.rejection_reason||'').trim();
 if(!id||!action)return res.status(400).json({error:'request_id and action are required'});
 const t=transitions[action]; if(!t)return res.status(400).json({error:'unsupported_review_action'});
 const q=await db.query("SELECT * FROM commercial_workspace_requests WHERE id=$1",[id]);
 if(!q.rows.length)return res.status(404).json({error:'request not found'});
 const r=q.rows[0];
 if(!t.from.includes(r.status))return res.status(409).json({error:'invalid_status_transition',status:r.status,action});
 if(action==='VERIFY'&&!notes)return res.status(400).json({error:'verification_notes_required'});
 if(action==='VERIFY'){
  const e=(await db.query("SELECT evidence_type FROM commercial_workspace_request_evidence WHERE request_id=$1 AND verification_status IN ('PENDING','VERIFIED')",[id])).rows.map(x=>x.evidence_type);
  if(!e.includes('INCORPORATION')||!e.includes('REPRESENTATIVE_AUTHORIZATION'))return res.status(409).json({error:'required_verification_evidence_missing',required:['INCORPORATION','REPRESENTATIVE_AUTHORIZATION']});
 }
 if(action==='REJECT'&&!reason)return res.status(400).json({error:'rejection_reason_required'});
 const reviewer=String(req.member?.email||'admin').slice(0,200);
 const sql=action==='START_REVIEW'
  ?"UPDATE commercial_workspace_requests SET status='UNDER_REVIEW',verification_status='IN_REVIEW',verification_reviewer=$2,verification_started_at=COALESCE(verification_started_at,NOW()),verification_notes=NULL,rejection_reason=NULL WHERE id=$1"
  :action==='VERIFY'
  ?"UPDATE commercial_workspace_requests SET status='VERIFIED',verification_status='VERIFIED',verification_reviewer=$2,verification_notes=$3,verification_completed_at=NOW(),rejection_reason=NULL WHERE id=$1"
  :action==='REJECT'
  ?"UPDATE commercial_workspace_requests SET status='REJECTED',verification_status='REJECTED',verification_reviewer=$2,verification_notes=$3,rejection_reason=$4,verification_completed_at=NOW() WHERE id=$1"
  :"UPDATE commercial_workspace_requests SET status='APPROVED',verification_status='VERIFIED',verification_reviewer=$2,verification_notes=COALESCE(NULLIF($3,''),verification_notes),approval_at=NOW(),reviewed_at=NOW() WHERE id=$1";
 const params=action==='REJECT'?[id,reviewer,notes,reason]:[id,reviewer,notes];
 const auditNotes=action==='REJECT' ? [notes,reason].filter(Boolean).join(' | ') : notes;
 await db.transaction([
  {sql,params},
  {sql:"INSERT INTO commercial_workspace_request_audit (request_id,action,actor,notes) VALUES ($1,$2,$3,$4)",params:[id,action,reviewer,auditNotes||null]}
 ]);
 const out=(await db.query("SELECT id,name,email,organization,organization_type,plan,status,verification_status,verification_reviewer,verification_notes,rejection_reason,created_at,verification_started_at,verification_completed_at,approval_at,reviewed_at,workspace_id FROM commercial_workspace_requests WHERE id=$1",[id])).rows[0];
 res.json({request:out});
}