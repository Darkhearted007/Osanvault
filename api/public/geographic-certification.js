import { db } from 'hatchable';
import { enforcePublicRateLimit } from 'lib/cac-public-rate-limit.js';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res) {
  const identifier = String(req.query?.id || req.query?.code || '').trim();
  if (!identifier || identifier.length > 200) {
    return res.status(400).json({error:'Certification identifier is required'});
  }
  if (!(await enforcePublicRateLimit(req,res,'public-geographic-certification',identifier,60))) {
    return res.status(429).json({error:'Too many certification requests. Try again later.'});
  }

  const byRegistry = identifier.startsWith('OSV-');
  const sql = byRegistry
    ? 'SELECT registry_id,certification_version,authoritative_source_id,feature_id,state_code,status,confidence,certified_at FROM gis_phase366_certification_registry WHERE registry_id=$1 ORDER BY registered_at DESC LIMIT 1'
    : 'SELECT registry_id,certification_version,authoritative_source_id,feature_id,state_code,status,confidence,certified_at FROM gis_phase366_certification_registry WHERE feature_id=$1 ORDER BY registered_at DESC LIMIT 1';
  const result = await db.query(sql,[identifier]);
  const record = result.rows[0];
  if (!record) return res.status(404).json({verified:false,status:'NOT_FOUND',error:'Public geographic certification record not found'});

  const [eventsResult,stateResult] = await Promise.all([
    db.query(
      'SELECT event_type,event_hash,previous_event_hash,created_at FROM gis_phase362_certification_events WHERE certification_version=$1 AND authoritative_source_id=$2 AND feature_id=$3 ORDER BY created_at,id',
      [record.certification_version,record.authoritative_source_id,record.feature_id]
    ),
    db.query(
      'SELECT state,current_hash FROM gis_phase362_certification_state WHERE certification_version=$1 AND authoritative_source_id=$2 AND feature_id=$3 LIMIT 1',
      [record.certification_version,record.authoritative_source_id,record.feature_id]
    )
  ]);

  const events = eventsResult.rows;
  let previous = null;
  let chainValid = events.length > 0;
  for (const event of events) {
    if (event.previous_event_hash !== previous) chainValid = false;
    previous = event.event_hash;
  }
  const state = stateResult.rows[0] || null;
  const effectiveStatus = state?.state || record.status;
  const verified = effectiveStatus === 'CERTIFIED' && chainValid &&
    (!state?.current_hash || state.current_hash === previous);

  return res.json({
    verified,
    status: verified ? 'CERTIFIED' : 'REQUIRES_REVIEW',
    record: {
      registry_id: record.registry_id,
      feature_id: record.feature_id,
      state_code: record.state_code,
      certification_status: effectiveStatus,
      confidence: record.confidence,
      certified_at: record.certified_at
    },
    integrity: {chainValid, eventCount:events.length},
    verifiedAt: new Date().toISOString(),
    disclosure: 'This public response excludes source identifiers, evidence payloads, event hashes, and confidential certification materials. A certification result does not establish land title, ownership, valuation, or investment eligibility.'
  });
}
