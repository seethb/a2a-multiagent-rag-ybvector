// agent/src/agent.js
require('dotenv').config();
const path = require('path');

const db = require(path.join(__dirname, '../../server/src/db'));
const { saveRun } = require('./store');

const { fetchTransactions } = require('./roles/retriever');
const { detectFlags } = require('./roles/fraudDetection');
const { score } = require('./roles/riskScoring');
const { summarize } = require('./roles/writer');
const { checkCompliance } = require('./roles/compliance');

const STEP_TIMEOUT_MS = Number(process.env.STEP_TIMEOUT_MS || 7000);

function withTimeout(promise, label, ms = STEP_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), ms)
    )
  ]);
}

async function runPipeline(queryText, options = {}) {
  const stepTimings = {};
  const now = () => Date.now();

  // 1) Retriever
  let t0 = now();
  const retrieved = await withTimeout(fetchTransactions(db, queryText), 'retriever');
  stepTimings.retriever_ms = now() - t0;

  // 2) FraudDetection
  t0 = now();
  const flags = await withTimeout(Promise.resolve(detectFlags(retrieved.rows)), 'fraudDetection');
  stepTimings.fraudDetection_ms = now() - t0;

  // 3) RiskScoring
  t0 = now();
  const risk = await withTimeout(Promise.resolve(score(retrieved.rows, flags)), 'riskScoring');
  stepTimings.riskScoring_ms = now() - t0;

  // 3b) Top transactions by risk
  const byId = new Map(retrieved.rows.map(r => [r.txn_id, r]));
  const topTxns = [...(risk.perTxnScores || [])]
    .sort((a,b) => b.score - a.score)
    .slice(0, 5)
    .map(p => ({
      txn_id: p.txn_id,
      amount: byId.get(p.txn_id)?.amount ?? null,
      txn_time: byId.get(p.txn_id)?.txn_time ?? null,
      location: byId.get(p.txn_id)?.location ?? null,
      category: byId.get(p.txn_id)?.merchant_category ?? null,
      txn_type: byId.get(p.txn_id)?.txn_type ?? null,
      score: p.score,
      reasons: p.reasons
    }));

  // 4) Writer
  t0 = now();
  const writerOut = await withTimeout(
    Promise.resolve(summarize({
      query: queryText,
      filters: retrieved.filters,
      count: retrieved.count,
      flags,
      risk
    })),
    'writer'
  );
  stepTimings.writer_ms = now() - t0;

  // 5) Compliance
  t0 = now();
  const compliance = await withTimeout(
    Promise.resolve(checkCompliance(risk.overall, flags, {
      query: queryText,
      filters: retrieved.filters
    })),
    'compliance'
  );
  stepTimings.compliance_ms = now() - t0;

  const results = {
    retriever: {
      filters: retrieved.filters,
      count: retrieved.count,
      sample: retrieved.rows.slice(0, 5),
      meta: retrieved.meta || { usedLLM:false, fellBack:false }
    },
    fraudDetection: { flags, meta: { usedLLM: false, fellBack: false } },
    riskScoring: { ...risk, meta: { usedLLM: false, fellBack: false } },
    writer: { narrative: writerOut.text, meta: { usedLLM: writerOut.usedLLM, fellBack: writerOut.fellBack } },
    compliance,
    topTxns
  };

  const saved = await saveRun({
    queryText,
    stepTimings,
    results,
    riskScore: risk.overall,
    flags
  });

  return { id: saved.id, created_at: saved.created_at, stepTimings, ...results };
}

module.exports = { runPipeline };
