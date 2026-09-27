import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member'; export const methods=['GET'];
export default async function(req,res){
 const room=await db.query('SELECT d.id,d.institution_id AS "institutionId",oa.organization_id AS "organizationId" FROM institutional_data_rooms d JOIN gis_organization_assets oa ON oa.asset_id=d.asset_id WHERE d.id=$1',[req.params.id]);
 if(!room.rows.length)return res.status(404).json({error:'data_room_not_found'});
 const tenant=await authorizeTenant(req,room.rows[0].organizationId,'capital:read'); if(!tenant.allowed)return tenantError(res,tenant);
 const member=await db.query('SELECT id FROM institution_members WHERE institution_id=$1 AND member_id=$2 AND status=$3',[room.rows[0].institutionId,req.member.id,'active']);
 if(!member.rows.length)return res.status(403).json({error:'institution_membership_required'});
 const profileId=req.query?.profileId;if(!profileId)return res.status(400).json({error:'profileId is required'});
 const consent=await db.query('SELECT id,scope FROM economic_institutional_consents WHERE profile_id=$1 AND institution_id=$2 AND status=$3',[profileId,room.rows[0].institutionId,'granted']);
 if(!consent.rows.length)return res.status(403).json({error:'consent_required'});
 const r=await db.query("SELECT relationship_type AS \"relationshipType\",to_type AS \"toType\",to_id AS \"toId\",status,confidence,evidence_ref AS \"evidenceRef\" FROM economic_graph_relationships WHERE from_type='economic_business' AND from_id=$1 AND status IN ('evidenced','verified') ORDER BY status DESC,created_at DESC",[profileId]);
 res.json({roomId:room.rows[0].id,profileId,scope:consent.rows[0].scope,relationships:r.rows,disclaimer:'Scoped to this institution, data room and active consent. Evidenced/verified relationships only.'});
}