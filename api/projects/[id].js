import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function(req,res){
 const id=req.params.id;
 const p=await db.query(`SELECT p.id,p.project_identifier AS "projectIdentifier",p.name,p.description,p.project_type AS "projectType",p.status,p.jurisdiction,p.created_at AS "createdAt",s.structure_type AS "structureType",s.legal_entity_name AS "legalEntityName",s.status AS "structureStatus",cr.capital_requirement AS "capitalRequirement",cr.currency,cr.readiness_state AS "readinessState",cr.legal_ready AS "legalReady",cr.evidence_ready AS "evidenceReady",cr.valuation_ready AS "valuationReady",cr.risk_ready AS "riskReady",cr.economics_ready AS "economicsReady",cr.governance_ready AS "governanceReady" FROM projects p LEFT JOIN project_structures s ON s.project_id=p.id LEFT JOIN project_capital_readiness cr ON cr.project_id=p.id WHERE p.id=$1 ORDER BY s.created_at DESC LIMIT 1`,[id]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 const [assets,milestones,opportunities]=await Promise.all([
  db.query(`SELECT a.id,a.asset_identifier AS "assetIdentifier",a.name,a.status FROM assets a JOIN project_assets pa ON pa.asset_id=a.id WHERE pa.project_id=$1`,[id]),
  db.query(`SELECT id,code,title,description,status,target_date AS "targetDate",completed_at AS "completedAt",sort_order AS "sortOrder" FROM project_milestones WHERE project_id=$1 ORDER BY sort_order,id`,[id]),
  db.query(`SELECT id,opportunity_type AS "opportunityType",title,thesis,status,capital_requirement AS "capitalRequirement",currency,created_at AS "createdAt" FROM opportunity_assessments WHERE project_id=$1 ORDER BY created_at DESC`,[id])
 ]);
 res.json({...p.rows[0],assets:assets.rows,milestones:milestones.rows,opportunities:opportunities.rows});
}