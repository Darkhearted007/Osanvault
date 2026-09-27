import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const id=String(req.params?.id||'').trim();
 const p=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 const tenant=await authorizeTenant(req,p.rows[0].organizationId,'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 const r=await db.query('SELECT legal_ready,evidence_ready,valuation_ready,risk_ready,economics_ready,governance_ready,readiness_state FROM project_capital_readiness WHERE project_id=$1',[id]);
 const x=r.rows[0]||{};
 const checks=[!!x.legal_ready,!!x.evidence_ready,!!x.valuation_ready,!!x.risk_ready,!!x.economics_ready,!!x.governance_ready];
 const score=Math.round(checks.filter(Boolean).length/6*100);
 const state=checks.every(Boolean)?'capital_ready':checks.some(Boolean)?'due_diligence_ready':'not_ready';
 const g=await db.query("SELECT count(*)::int AS c FROM project_readiness_gaps WHERE project_id=$1 AND status<>'resolved' AND blocking=true",[id]);
 const m=await db.query("SELECT count(*)::int AS c FROM intelligence_remediation_items WHERE subject_type='project' AND subject_id=$1 AND status<>'completed'",[id]);
 const openGaps=Number(g.rows[0].c)+Number(m.rows[0].c);
 const ev=await db.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE status IN (\'Verified\',\'verified\',\'accepted\'))::int AS verified FROM asset_evidence WHERE asset_id IN (SELECT asset_id FROM project_assets WHERE project_id=$1)',[id]);
 const ins=await db.query("SELECT count(*)::int AS c FROM institutional_profiles WHERE status='active'");
 const up=await db.query("INSERT INTO project_intelligence_passports(project_id,passport_version,passport_status,evidence_state,readiness_state,overall_readiness_score,blocker_count,source_count,evidence_count,verified_evidence_count,summary,generated_at,generated_by) VALUES($1,1,'Draft',$2,$3,$4,$5,$6,$7,$8,$9,now(),$10) ON CONFLICT(project_id) DO UPDATE SET readiness_state=EXCLUDED.readiness_state,overall_readiness_score=EXCLUDED.overall_readiness_score,blocker_count=EXCLUDED.blocker_count,source_count=EXCLUDED.source_count,evidence_count=EXCLUDED.evidence_count,verified_evidence_count=EXCLUDED.verified_evidence_count,summary=EXCLUDED.summary,generated_at=now(),generated_by=EXCLUDED.generated_by,updated_at=now() RETURNING id,project_id,readiness_state,overall_readiness_score,blocker_count",[id],Number(ev.rows[0].verified)>0?'partial':'insufficient_data',state,score,openGaps,Number(ins.rows[0].c),Number(ev.rows[0].total),Number(ev.rows[0].verified),'Generated from current project readiness, evidence and institutional records.',req.member.id);
 if((x.readiness_state||'not_ready')!==state)await db.query('INSERT INTO project_pipeline_events(project_id,from_state,to_state,reason,actor_reference) VALUES($1,$2,$3,$4,$5)',[id,x.readiness_state||'not_ready',state,'Project intelligence passport recalculated',req.member.id]);
 return res.json({passport:up.rows[0],openGaps,checks:{legal:checks[0],evidence:checks[1],valuation:checks[2],risk:checks[3],economics:checks[4],governance:checks[5]}});
}