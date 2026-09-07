import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const WRITE_ROLES=new Set(['OWNER','ADMIN','DEVELOPER_ADMIN','PROJECT_MANAGER']);
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):null;
export default async function(req,res){
 const b=req.body||{},member=req.member,orgId=String(b.organizationId||'');
 if(!orgId||!clean(b.projectName,180)||!clean(b.projectType,100)||!b.assetId)return res.status(400).json({error:'organizationId, projectName, projectType and assetId are required'});
 const org=(await db.query(`SELECT o.id,o.name,m.role FROM gis_organizations o JOIN gis_organization_members m ON m.organization_id=o.id
   WHERE o.id=$1 AND m.member_id=$2 AND m.status='ACTIVE' AND o.status='ACTIVE'`,[orgId,member.id])).rows[0];
 if(!org)return res.status(403).json({error:'organization_access_denied'});
 if(!WRITE_ROLES.has(org.role))return res.status(403).json({error:'project_submission_not_authorized'});
 const asset=(await db.query(`SELECT a.id,a.name,ga.access_level FROM assets a JOIN gis_organization_assets ga ON ga.asset_id=a.id
   WHERE a.id=$1 AND ga.organization_id=$2`,[b.assetId,orgId])).rows[0];
 if(!asset)return res.status(403).json({error:'asset_not_authorized_for_organization'});
 const identifier='OV-PROJ-'+crypto.randomUUID().slice(0,8).toUpperCase();
 const project=await db.query(`INSERT INTO projects(organization_id,project_identifier,name,description,project_type,status,jurisdiction,location,development_stage,units,development_scope,estimated_completion,ownership_control_relationship,capital_preferences,submission_source,submitted_by)
   VALUES($1,$2,$3,$4,$5,'submitted',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id,project_identifier AS "projectIdentifier",name,project_type AS "projectType",status,organization_id AS "organizationId"`,
   [orgId,identifier,clean(b.projectName,180),clean(b.description,4000),clean(b.projectType,100),clean(b.jurisdiction,120),clean(b.location,500),clean(b.developmentStage,100),Number.isInteger(b.units)?b.units:null,clean(b.developmentScope,4000),b.estimatedCompletion||null,clean(b.ownershipControlRelationship,500),Array.isArray(b.capitalPreferences)?b.capitalPreferences.slice(0,12):[], 'developer_submission',member.id]);
 await db.query('INSERT INTO project_assets(project_id,asset_id,relationship) VALUES($1,$2,$3)',[project.rows[0].id,b.assetId,'primary']);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[orgId,member.id,'PROJECT_SUBMITTED',JSON.stringify({project_id:project.rows[0].id,asset_id:b.assetId})]).catch(()=>{});
 res.status(201).json({project:project.rows[0],asset:{id:asset.id,name:asset.name},status:'submitted',message:'Project submitted for review. Submission does not constitute verification, readiness, eligibility or financing approval.'});
}