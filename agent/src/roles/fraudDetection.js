// agent/src/roles/fraudDetection.js
// Simple rule flags; tune thresholds as needed

const HIGH_AMOUNT_50K = Number(process.env.HIGH_AMOUNT_50K ?? 50000);
const HIGH_AMOUNT_10K = Number(process.env.HIGH_AMOUNT_10K ?? 10000);

const HIGH_RISK_CATEGORIES = new Set(['crypto', 'gift_cards']);

function detectFlags(rows) {
  const flags = [];

  for (const t of rows) {
    const cat = (t.merchant_category || '').toLowerCase();

    if (t.amount >= HIGH_AMOUNT_50K) {
      flags.push({ txn_id: t.txn_id, reason: `High amount ≥ ${HIGH_AMOUNT_50K}` });
    } else if (t.amount >= HIGH_AMOUNT_10K) {
      flags.push({ txn_id: t.txn_id, reason: `High amount ≥ ${HIGH_AMOUNT_10K}` });
    }

    if (HIGH_RISK_CATEGORIES.has(cat)) {
      flags.push({ txn_id: t.txn_id, reason: `High-risk category: ${cat}` });
    }
  }

  return flags;
}

module.exports = { detectFlags };
