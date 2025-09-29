// agent/src/roles/riskScoring.js
// Weighted, configurable scoring with env overrides

require('dotenv').config();

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const W = {
  HIGH_AMT_50K:   num(process.env.W_HIGH_AMT_50K,   40),
  HIGH_AMT_10K:   num(process.env.W_HIGH_AMT_10K,   20),
  P2P:            num(process.env.W_P2P,             5),
  FLAGS_PER:      num(process.env.W_FLAGS_PER,       10),
  FLAGS_CAP:      num(process.env.W_FLAGS_CAP,       40),
  GAMBLING:       num(process.env.W_GAMBLING,        30),
  CRYPTO:         num(process.env.W_CRYPTO,          15),
  LABELED_FRAUD:  num(process.env.W_LABELED_FRAUD,   20),
};

function score(transactions, flags) {
  const reasonsByTxn = new Map();
  for (const f of flags) {
    if (!reasonsByTxn.has(f.txn_id)) reasonsByTxn.set(f.txn_id, []);
    reasonsByTxn.get(f.txn_id).push(f.reason);
  }

  let total = 0;
  const perTxnScores = [];

  for (const t of transactions) {
    let s = 0;
    if (t.amount > 50000) s += W.HIGH_AMT_50K;
    else if (t.amount > 10000) s += W.HIGH_AMT_10K;

    if (t.txn_type === 'P2P') s += W.P2P;

    const reasons = reasonsByTxn.get(t.txn_id) || [];
    s += Math.min(W.FLAGS_CAP, reasons.length * W.FLAGS_PER);

    const mcc = (t.merchant_category || '').toLowerCase();
    if (mcc === 'gambling') s += W.GAMBLING;
    if (mcc === 'crypto')   s += W.CRYPTO;

    if (t.is_fraud === true) s += W.LABELED_FRAUD;

    s = Math.min(100, s);
    total += s;
    perTxnScores.push({ txn_id: t.txn_id, score: s, reasons });
  }

  const overall = perTxnScores.length ? Number((total / perTxnScores.length).toFixed(2)) : 0;
  return { overall, perTxnScores };
}

module.exports = { score, W };
