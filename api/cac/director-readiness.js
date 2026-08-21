import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const directors=[{name:'Olugbenga Ajayi',role:'Director / Founder',status:'confirmed by applicant',personalDetailsRequired:true},{name:'Ajayi Damilola Martha',role:'Director',status:'proposed — consent and particulars required',personalDetailsRequired:true}];
 const checks=[{key:'director_count',status:'ready',detail:'Two directors planned.'},{key:'damilola_consent',status:'pending',detail:'Confirm she agrees to serve as director before filing.'},{key:'identity_documents',status:'pending',detail:'Each director needs a valid recognised photo ID.'},{key:'director_particulars',status:'pending',detail:'Date of birth, nationality, occupation, residence and service address are required.'}];
 res.json({ok:true,company:'OSANVAULT AFRICA LTD',directors,checks,publicExposure:false,next:'collect_director_consent_and_particulars'});
}