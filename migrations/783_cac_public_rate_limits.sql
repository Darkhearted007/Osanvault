CREATE TABLE cac_public_rate_limits (
  bucket_start timestamptz NOT NULL,
  route_key text NOT NULL,
  subject_hash text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_start, route_key, subject_hash)
)