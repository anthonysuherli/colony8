CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'running',
  health JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id),
  title STRING NOT NULL,
  content JSONB NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  provenance JSONB NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0.7,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ,
  superseded_by UUID
);

CREATE INDEX IF NOT EXISTS findings_live_idx ON findings (run_id) WHERE invalidated_at IS NULL;

CREATE TABLE IF NOT EXISTS resolution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  op STRING NOT NULL,
  candidate_title STRING NOT NULL,
  target_finding_id UUID,
  new_finding_id UUID,
  reason STRING,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
