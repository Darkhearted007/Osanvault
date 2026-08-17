import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET'];
export default async function(req,res){
 const r=await db.query('SELECT id,submission_identifier AS "submissionIdentifier",submitted_by AS "submittedBy",contributor_type AS "contributorType",name,asset_type_code AS "assetTypeCode",description,jurisdiction_code AS "jurisdictionCode",location_text AS location,latitude,longitude,rights_holder_name AS "rightsHolderName",rights_basis AS "rightsBasis",status,review_notes AS "reviewNotes",created_at AS "createdAt" FROM asset_submissions WHERE id=$1 AND submitted_by=$2',[req.params.id,req.member.id]);
 if(!r.rows.length)return res.status(404).json({error:'Submission not found'});
 const e=await db.query('SELECT id,evidence_type AS "evidenceType",title,source,description,storage_url AS "storageUrl",document_hash AS "documentHash",status,created_at AS "createdAt" FROM submission_evidence WHERE submission_id=$1 ORDER BY created_at DESC',[req.params.id]);
 res.json({...r.rows[0],evidence:e.rows});
}