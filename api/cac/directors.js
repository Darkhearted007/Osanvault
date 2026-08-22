import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET'];
export default async function(req,res){
  const { rows } = await db.query(`SELECT id, full_name AS "fullName", email, role_title AS "roleTitle", status, consent_status AS "consentStatus", id_document_status AS "idDocumentStatus", consented_at AS "consentedAt", created_at AS "createdAt", updated_at AS "updatedAt" FROM cac_director_profiles ORDER BY created_at DESC`);
  res.json({ok:true,company:'OSANVAULT AFRICA LTD',directors:rows});
}