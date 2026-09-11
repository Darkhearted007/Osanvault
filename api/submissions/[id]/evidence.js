import { db } from 'hatchable';
export const access = 'member';
export const methods = ['POST'];
export default async function(req,res){
 if(!req.member?.id)return res.status(401).json({error:'authentication_required'});
 const b=req.body||{};
 const own=await db.query('SELECT id FROM asset_submissions WHERE id=$1 AND submitted_by=$2',[req.params.id,req.member.id]);
 if(!own.rows.length)return res.status(404).json({error:'Submission not found'});
 if(!b.evidenceType||!b.title)return res.status(400).json({error:'evidenceType and title are required'});
 const r=await db.query('INSERT INTO submission_evidence(submission_id,evidence_type,title,source,description,storage_url,document_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,evidence_type AS "evidenceType",title,status,created_at AS "createdAt"',[req.params.id,b.evidenceType,b.title,b.source||null,b.description||null,b.storageUrl||null,b.documentHash||null]);
 await db.query('UPDATE asset_submissions SET status=CASE WHEN status=\'submitted\' THEN \'documented\' ELSE status END,updated_at=now() WHERE id=$1',[req.params.id]);
 res.status(201).json(r.rows[0]);
}