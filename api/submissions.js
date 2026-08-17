import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET','POST'];
export default async function(req,res){
 const member=req.member;
 if(req.method==='GET'){
  const r=await db.query('SELECT id,submission_identifier AS "submissionIdentifier",name,asset_type_code AS "assetTypeCode",jurisdiction_code AS "jurisdictionCode",location_text AS location,status,created_at AS "createdAt" FROM asset_submissions WHERE submitted_by=$1 ORDER BY created_at DESC',[member.id]);
  return res.json(r.rows);
 }
 const b=req.body||{}; if(!b.name||!b.assetTypeCode)return res.status(400).json({error:'name and assetTypeCode are required'});
 const identifier=`SUB-${Date.now()}-${Math.floor(Math.random()*10000)}`;
 const r=await db.query('INSERT INTO asset_submissions(submission_identifier,submitted_by,contributor_type,name,asset_type_code,description,jurisdiction_code,location_text,latitude,longitude,rights_holder_name,rights_basis) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,submission_identifier AS "submissionIdentifier",name,status',[identifier,member.id,b.contributorType||'community',b.name,b.assetTypeCode,b.description||null,b.jurisdictionCode||null,b.location||null,b.latitude??null,b.longitude??null,b.rightsHolderName||null,b.rightsBasis||null]);
 res.status(201).json(r.rows[0]);
}