import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const checks=[
  {id:'ip_notice',status:'IMPLEMENTED',detail:'Proprietary IP and limited-licence notice is published at /legal/ip.html'},
  {id:'terms',status:'IMPLEMENTED',detail:'Platform Terms of Use published at /legal/terms.html'},
  {id:'privacy',status:'IMPLEMENTED_REVIEW_REQUIRED',detail:'Privacy framework published; final legal/DPO review required'},
  {id:'regulatory_notice',status:'IMPLEMENTED_REVIEW_REQUIRED',detail:'Regulatory boundaries published; counsel must map actual activities to licences/filings'},
  {id:'copyright',status:'ACTION_REQUIRED',detail:'Consider voluntary Nigerian Copyright Commission registration of eligible software/documentation works'},
  {id:'trademark',status:'ACTION_REQUIRED',detail:'Conduct clearance and file ÒsánVault/OsanVault marks in relevant classes and jurisdictions'},
  {id:'ndpc',status:'ACTION_REQUIRED',detail:'Complete NDPA/NDPC applicability assessment, governance and any required registration/compliance steps'},
  {id:'sec_digital_assets',status:'ACTION_REQUIRED',detail:'Obtain Nigerian securities counsel opinion before offering tokenised real-world assets or investment products'},
  {id:'property_minerals',status:'ACTION_REQUIRED',detail:'Verify title, land/mineral rights, permits and transaction structure per asset/jurisdiction'},
  {id:'regulated_finance',status:'GATED',detail:'Do not activate payment, custody, exchange, investment-advice or similar regulated features without the required legal pathway'}
 ];
 const result={phase:'389.06',status:'LEGAL_REVIEW_REQUIRED',checked_at:new Date().toISOString(),checks,launch_policy:'Technical production readiness does not equal a government licence or regulatory approval. Regulated features remain gated until the applicable legal pathway is completed.'};
 await storage.put('phase389/legal-regulatory-readiness.json',new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}