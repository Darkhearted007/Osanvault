import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];

export default async function(req,res) {
  const assetId = String(req.query?.asset_id || '').trim();
  if (!assetId) return res.status(400).json({error:'asset_id is required'});
  const member = req.member;
  if (!member?.id) return res.status(401).json({error:'unauthorized'});

  const communities = (await db.query(
    'SELECT id,name,community_type,jurisdiction_code,recognition_status FROM community_entities WHERE representative_reference=$1',
    [member.id]
  )).rows;
  if (!communities.length) return res.status(403).json({error:'No community representative profile is linked to this account'});

  const ids = communities.map(x => x.id);
  const ph = ids.map((_,i) => `$${i+1}`).join(',');
  const params = [...ids,assetId];
  const assetParam = `$${ids.length+1}`;
  const [interests,evidence,sessions,consents,benefits,grievances,actions] = await Promise.all([
    db.query(`SELECT * FROM community_spatial_interests WHERE community_id IN (${ph}) AND asset_id=${assetParam} AND visibility='Restricted'`,params),
    db.query(`SELECT id,community_id,asset_id,evidence_type,title,description,verification_status,visibility,submitted_at FROM community_evidence_submissions WHERE community_id IN (${ph}) AND asset_id=${assetParam} ORDER BY submitted_at DESC`,params),
    db.query(`SELECT * FROM community_consultation_sessions WHERE community_id IN (${ph}) AND asset_id=${assetParam} ORDER BY scheduled_at DESC`,params),
    db.query(`SELECT * FROM community_consent_records WHERE community_id IN (${ph}) AND asset_id=${assetParam} ORDER BY created_at DESC`,params),
    db.query(`SELECT * FROM community_benefit_agreements WHERE community_id IN (${ph}) AND asset_id=${assetParam} ORDER BY created_at DESC`,params),
    db.query(`SELECT * FROM community_grievances WHERE community_id IN (${ph}) AND asset_id=${assetParam} ORDER BY opened_at DESC`,params),
    db.query(`SELECT ra.* FROM community_resolution_actions ra JOIN community_grievances g ON g.id=ra.grievance_id WHERE g.community_id IN (${ph}) AND g.asset_id=${assetParam} ORDER BY ra.occurred_at DESC`,params)
  ]);

  return res.json({
    communities,
    asset_id:assetId,
    spatialInterests:interests.rows,
    evidenceSubmissions:evidence.rows,
    consultations:sessions.rows,
    consentRecords:consents.rows,
    benefitAgreements:benefits.rows,
    grievances:grievances.rows,
    resolutionActions:actions.rows,
    rightsPrinciples:[
      'Community representatives control access to their protected submissions.',
      'Restricted spatial geometry is never returned through investor/public routes.',
      'Consultation, consent, grievance and benefit-sharing records remain auditable.'
    ]
  });
}
