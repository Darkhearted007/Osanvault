import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function(req,res){
 const id=req.params.id;
 const r=await db.query(`SELECT p.id,p.name,COALESCE(cr.legal_ready,false) AS "legalReady",COALESCE(cr.evidence_ready,false) AS "evidenceReady",COALESCE(cr.valuation_ready,false) AS "valuationReady",COALESCE(cr.risk_ready,false) AS "riskReady",COALESCE(cr.economics_ready,false) AS "economicsReady",COALESCE(cr.governance_ready,false) AS "governanceReady",COALESCE(cr.capital_requirement,0) AS "capitalRequirement",COALESCE(cr.currency,'NGN') AS currency,COALESCE(cr.readiness_state,'not_ready') AS state FROM projects p LEFT JOIN project_capital_readiness cr ON cr.project_id=p.id WHERE p.id=$1`,[id]);
 if(!r.rows.length)return res.status(404).json({error:'Project not found'});
 const x=r.rows[0]; const checks=[x.legalReady,x.evidenceReady,x.valuationReady,x.riskReady,x.economicsReady,x.governanceReady]; const score=Math.round(checks.filter(Boolean).length/checks.length*100); const missing=['legalReady','evidenceReady','valuationReady','riskReady','economicsReady','governanceReady'].filter(k=>!x[k]);
 res.json({projectId:x.id,projectName:x.name,score,state:x.state,capitalRequirement:x.capitalRequirement,currency:x.currency,checks:{legal:x.legalReady,evidence:x.evidenceReady,valuation:x.valuationReady,risk:x.riskReady,economics:x.economicsReady,governance:x.governanceReady},missing});
}