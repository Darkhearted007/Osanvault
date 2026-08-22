import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET'];
export default async function(req,res){
  const [directors, checklist] = await Promise.all([
    db.query(`SELECT id, full_name AS "fullName", email, role_title AS "roleTitle", status, consent_status AS "consentStatus", id_document_status AS "idDocumentStatus", date_of_birth AS "dateOfBirth", nationality, occupation, residential_address AS "residentialAddress", service_address AS "serviceAddress", phone, id_document_name AS "idDocumentName", id_document_hash AS "idDocumentHash" FROM cac_director_profiles ORDER BY created_at`),
    db.query(`SELECT id, item_key AS "itemKey", label, status, notes FROM cac_registration_checklist ORDER BY sort_order`)
  ]);
  const directorEvidence = directors.rows.map(d => ({...d, evidenceReady: d.consentStatus === 'accepted' && d.idDocumentStatus === 'verified' && !!d.dateOfBirth && !!d.nationality && !!d.occupation && !!d.residentialAddress && !!d.serviceAddress}));
  const requiredComplete = checklist.rows.filter(x => x.status === 'complete' || x.status === 'ready').length;
  const evidenceReady = directorEvidence.every(d => d.evidenceReady) && requiredComplete === checklist.rows.length;
  res.json({ok:true,company:'OSANVAULT AFRICA LTD',generatedAt:new Date().toISOString(),evidenceReady,filingStatus:evidenceReady?'READY_FOR_FINAL_REVIEW':'INCOMPLETE',directors:directorEvidence,checklist:checklist.rows,packSections:['Company particulars','Share capital and ownership','Directors and consents','Persons with Significant Control (PSC)','MEMART / constitutional documents','Identity evidence','Final filing review'],requiredComplete,totalChecklist:checklist.rows.length});
}