-- Enforce at most one open verification case per asset.
-- Fail closed if legacy duplicates exist; reconcile them before rollout.
CREATE UNIQUE INDEX IF NOT EXISTS verification_cases_one_open_per_asset
  ON verification_cases(asset_id)
  WHERE status = 'open';
