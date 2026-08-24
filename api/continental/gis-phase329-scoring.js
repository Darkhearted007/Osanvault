import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "POST"];

function norm(v) {
  return String(v || "").toUpperCase().normalize("NFKD").replace(/[^A-Z0-9]+/g, " ").trim();
}
function similarity(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = new Set(x.split(" ")), B = new Set(y.split(" "));
  const inter = [...A].filter(t => B.has(t)).length;
  return inter / Math.max(1, new Set([...A, ...B]).size);
}

async function sourceRows(version, limit) {
  try {
    const q = await db.query(`SELECT source_feature_id, source_area_name, source_state_code, source_provider FROM gis_current_exception_queue WHERE crosswalk_version=$1 AND status='OPEN' ORDER BY source_feature_id LIMIT $2`, [version, limit]);
    return q.rows;
  } catch (_) {
    return [];
  }
}

export default async function (req, res) {
  const version = req.query?.crosswalk_version || req.body?.crosswalk_version || "phase323-current";
  const limit = Math.min(Math.max(Number(req.query?.limit || req.body?.limit || 30), 1), 100);
  const sources = await sourceRows(version, limit);
  const targets = await db.query(`SELECT feature_id, feature_name, state_code, provider, geometry_valid, normalized_geometry_available FROM gis_geometry_features WHERE geometry_valid=true AND normalized_geometry_available=true ORDER BY feature_id`);

  let generated = 0, geometryReady = 0;
  for (const s of sources) {
    const ranked = targets.rows.map(t => {
      const sm = s.source_state_code && t.state_code ? String(s.source_state_code).toUpperCase() === String(t.state_code).toUpperCase() : null;
      const ns = similarity(s.source_area_name, t.feature_name);
      const score = (sm === true ? 0.55 : 0) + ns * 0.45;
      return { t, sm, ns, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 5);

    for (const r of ranked) {
      const decision = r.score >= 0.92 && r.sm === true ? "CANDIDATE_HIGH" : r.score >= 0.75 ? "CANDIDATE_REVIEW" : "REVIEW_REQUIRED";
      const confidence = r.score >= 0.92 && r.sm === true ? "HIGH" : r.score >= 0.75 ? "MEDIUM" : "LOW";
      await db.query(`INSERT INTO gis_phase329_candidate_scores (crosswalk_version,source_feature_id,target_feature_id,source_provider,target_provider,state_match,name_similarity,geometry_ready,scoring_mode,score,confidence,decision,evidence) VALUES ($1,$2,$3,$4,$5,$6,$7,true,'METADATA_PLUS_GEOMETRY_READY',$8,$9,$10,$11) ON CONFLICT (crosswalk_version,source_feature_id,target_feature_id) DO UPDATE SET state_match=EXCLUDED.state_match,name_similarity=EXCLUDED.name_similarity,geometry_ready=EXCLUDED.geometry_ready,score=EXCLUDED.score,confidence=EXCLUDED.confidence,decision=EXCLUDED.decision,evidence=EXCLUDED.evidence,created_at=now()`, [version,s.source_feature_id,r.t.feature_id,s.source_provider,r.t.provider,r.sm,r.ns,r.score,confidence,decision,{geometry_valid:true,normalized_geometry_available:true,source_state_code:s.source_state_code,target_state_code:r.t.state_code,source_area_name:s.source_area_name,target_area_name:r.t.feature_name,scoring_mode:'METADATA_PLUS_GEOMETRY_READY'}]);
      generated++;
    }
    if (ranked.length) geometryReady++;
  }
  return res.json({phase:329,crosswalk_version:version,open_exception_batch:sources.length,target_geometry_features:targets.rows.length,candidates_generated:generated,exceptions_with_candidates:geometryReady,certification:"BLOCKED",note:"Candidates are evidence-ranked but are not certified identities. Exact polygon intersection/IoU is not asserted unless explicit spatial intersection evidence is present."});
}