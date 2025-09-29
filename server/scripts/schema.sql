-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Store transactions
CREATE TABLE upi_transactions (
  txn_id UUID PRIMARY KEY,
  payer_vpa TEXT,
  payee_vpa TEXT,
  amount NUMERIC,
  txn_time TIMESTAMPTZ,
  device_id TEXT,
  ip_address TEXT,
  merchant_category TEXT,
  location TEXT,
  txn_type TEXT, -- 'P2P', 'P2M', 'Collect', etc.
  is_fraud BOOLEAN,
  embedding VECTOR(384),
  fraud_score    decimal(15,2),
 is_fraud_pred    boolean,
 explanation      jsonb
);

-- Store human feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  reviewer TEXT,
  feedback TEXT,
  ts TIMESTAMPTZ DEFAULT now()
);


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
CREATE INDEX ON upi_transactions USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON upi_transactions(txn_time ASC);
