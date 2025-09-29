-- Keep your existing DDL and append the run-log table:

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  query_text TEXT NOT NULL,
  step_timings JSONB NOT NULL,
  results JSONB NOT NULL,
  risk_score NUMERIC(5,2) NOT NULL,
  flags JSONB NOT NULL
);
