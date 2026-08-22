import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET'];
export default async function(req,res){
 const {rows}=await db.query(`SELECT id, full_name AS "fullName", email, consent_status AS "consentStatus", id_document_status AS "idDocumentStatus", date_of_birth AS "dateOfBirth", nationality, occupation, residential_address AS "residentialAddress", service_address AS "serviceAddress", id_document_name AS "idDocumentName" FROM cac_director_profiles ORDER BY created_at`);
 const directorCount=rows.length;
 const consentComplete=rows.filter(x=>x.consentStatus==='accepted').length;
 const identityComplete=rows.filter(x=>x.idDocumentStatus==='verified').length;
 const particularsComplete=rows.filter(x=>x.dateOfBirth&&x.nationality&&x.occupation&&x.residentialAddress&&x.serviceAddress).length;
 res.json({ok:true,summary:{directorCount,consentComplete,identityComplete,particularsComplete},directors:rows});
}