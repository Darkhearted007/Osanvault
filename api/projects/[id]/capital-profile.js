import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET','PUT'];

async function calculate(projectId) {
  const [evidence, verification, economics, governance, risk, readiness] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS n FROM project_evidence WHERE project_id=$1',[projectId]).catch(()=>({rows:[{n:0}]})),
    db.query('SELECT COUNT(*)::int AS n FROM verification_cases vc JOIN projects p ON p.id=$1 WHERE vc.status=\'closed\'',[projectId]).catch(()=>({rows:[{n:0}]})),
    db.query('SELECT COUNT(*)::int AS n FROM project_economic_models WHERE project_id=$1',[projectId]).catch(()=>({rows:[{n:0}]})),
    db.query('SELECT governance_ready FROM project_capital_readiness WHERE project_id=$1 ORDER BY assessed_at DESC LIMIT 1',[projectId]).catch(()=>({rows:[]})),
    db.query('SELECT risk_ready FROM project_capital_readiness WHERE project_id=$1 ORDER BY assessed_at DESC LIMIT 1',[projectId]).catch(()=>({rows:[]})),
    db.query('SELECT economics_ready,evidence_ready,legal_ready,valuation_ready,risk_ready,governance_ready FROM project_capital_readiness WHERE project_id=$1 ORDER BY assessed_at DESC LIMIT 1',[projectId]).catch(()=>({rows:[]}))
  ]);
  const e=Math.min(100,evidence.rows[0]?.n*20||0);
  const v=verification.rows[0]?.n?80:20;
  const ec=economics.rows[0]?.n?70:20;
  const g=governance.rows[0]?.governance_ready?80:20;
  const r=risk.rows[0]?.risk_ready?80:20;
  const p=readiness.rows[0]?.economics_ready&&readiness.rows[0]?.evidence_ready&&readiness.rows[0]?.legal_ready?80:40;
  const score=Math.round((e+v+ec+g+r+p)/6);
  const state=score>=80?'capital_ready_candidate':score>=60?'diligence_ready_candidate':score>=35?'developing':'not_ready';
  return {score,state,evidenceScore:e,verificationScore:v,economicsScore:ec,governanceScore:g,riskScore:r,repaymentScore:p};
}
export default async function(req,res){
 const id=req.params.id;
 const p=await db.query('SELECT id,name FROM projects WHERE id=$1',[id]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 if(req.method==='GET'){
  const r=await db.query('SELECT id,project_id AS "projectId",capital_required AS "capitalRequired",currency,minimum_capital AS "minimumCapital",maximum_capital AS "maximumCapital",use_of_funds AS "useOfFunds",revenue_model AS "revenueModel",expected_cashflow AS "expectedCashflow",tenor_months AS "tenorMonths",risk_profile AS "riskProfile",security_type AS "securityType",security_notes AS "securityNotes",sponsor_contribution AS "sponsorContribution",development_stage AS "developmentStage",governance_notes AS "governanceNotes",capital_readiness_score AS "capitalReadinessScore",capital_readiness_state AS "capitalReadinessState",evidence_score AS "evidenceScore",verification_score AS "verificationScore",economics_score AS "economicsScore",governance_score AS "governanceScore",risk_score AS "riskScore",repayment_score AS "repaymentScore",assessed_at AS "assessedAt" FROM canonical_capital_profiles WHERE project_id=$1',[id]);
  return res.json({project:p.rows[0],profile:r.rows[0]||null});
 }
 const b=req.body||{}; const c=await calculate(id);
 const r=await db.query(`INSERT INTO canonical_capital_profiles(project_id,capital_required,currency,minimum_capital,maximum_capital,use_of_funds,revenue_model,expected_cashflow,tenor_months,risk_profile,security_type,security_notes,sponsor_contribution,development_stage,governance_notes,capital_readiness_score,capital_readiness_state,evidence_score,verification_score,economics_score,governance_score,risk_score,repayment_score,assessed_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,now(),$24) ON CONFLICT(project_id) DO UPDATE SET capital_required=EXCLUDED.capital_required,currency=EXCLUDED.currency,minimum_capital=EXCLUDED.minimum_capital,maximum_capital=EXCLUDED.maximum_capital,use_of_funds=EXCLUDED.use_of_funds,revenue_model=EXCLUDED.revenue_model,expected_cashflow=EXCLUDED.expected_cashflow,tenor_months=EXCLUDED.tenor_months,risk_profile=EXCLUDED.risk_profile,security_type=EXCLUDED.security_type,security_notes=EXCLUDED.security_notes,sponsor_contribution=EXCLUDED.sponsor_contribution,development_stage=EXCLUDED.development_stage,governance_notes=EXCLUDED.governance_notes,capital_readiness_score=EXCLUDED.capital_readiness_score,capital_readiness_state=EXCLUDED.capital_readiness_state,evidence_score=EXCLUDED.evidence_score,verification_score=EXCLUDED.verification_score,economics_score=EXCLUDED.economics_score,governance_score=EXCLUDED.governance_score,risk_score=EXCLUDED.risk_score,repayment_score=EXCLUDED.repayment_score,assessed_at=now(),updated_at=now() RETURNING id,project_id AS "projectId",capital_readiness_score AS "capitalReadinessScore",capital_readiness_state AS "capitalReadinessState",evidence_score AS "evidenceScore",verification_score AS "verificationScore",economics_score AS "economicsScore",governance_score AS "governanceScore",risk_score AS "riskScore",repayment_score AS "repaymentScore",assessed_at AS "assessedAt"`,[id,b.capitalRequired||null,b.currency||'NGN',b.minimumCapital||null,b.maximumCapital||null,b.useOfFunds||null,b.revenueModel||null,b.expectedCashflow||null,b.tenorMonths||null,b.riskProfile||null,b.securityType||null,b.securityNotes||null,b.sponsorContribution||null,b.developmentStage||null,b.governanceNotes||null,c.score,c.state,c.evidenceScore,c.verificationScore,c.economicsScore,c.governanceScore,c.riskScore,c.repaymentScore,req.member.id]);
 res.status(200).json({project:p.rows[0],profile:r.rows[0],assessment:{...c,method:'OV-16.1-RULES-V1',note:'Readiness is an internal evidence-based screening signal, not a credit, valuation or investment decision.'}});
}