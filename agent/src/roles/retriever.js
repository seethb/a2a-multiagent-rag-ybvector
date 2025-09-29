// agent/src/roles/retriever.js
// Hybrid parsing (local + optional LLM) and safe, case-insensitive SQL

require('dotenv').config();
const { isEnabled, callClaudeJSON } = require('../llm');

// ---- Config ----
// Raise MAX_HOURS to allow long windows (e.g., 180 days). Or set via env.
const MAX_ROWS   = Number(process.env.RETRIEVER_MAX_ROWS  || 100);
const MAX_HOURS  = Number(process.env.RETRIEVER_MAX_HOURS || 24 * 180); // up to 180 days
const MAX_AMOUNT = Number(process.env.RETRIEVER_MAX_AMT   || 1e9);

const KNOWN_CATEGORIES = new Set([
  'crypto','gift_cards','donation','food','shopping','travel','utilities'
]);
const CATEGORY_ALIASES = { giftcards: 'gift_cards', giftcard: 'gift_cards', gifts: 'gift_cards' };

// Small normalizer for special location tokens
function normalizeLocation(loc) {
  if (!loc) return loc;
  const raw = String(loc).trim();
  if (/^n\/a$/i.test(raw)) return 'N/A';
  if (/^unknown$/i.test(raw)) return 'Unknown';
  return raw;
}

function parseQueryLocal(q) {
  const lower = q.toLowerCase();

  // time: hours/days/months + "since YYYY-MM-DD"
  const mHours = /last\s+(\d+)\s*hours?/.exec(lower)?.[1];
  const mDays  = /last\s+(\d+)\s*days?/.exec(lower)?.[1];
  const mMons  = /last\s+(\d+)\s*months?/.exec(lower)?.[1];
  const mSince = /since\s+(\d{4}-\d{2}-\d{2})/.exec(lower)?.[1];

  let timeWindowHours = null;
  if (mHours) timeWindowHours = Number(mHours);
  else if (mDays) timeWindowHours = Number(mDays) * 24;
  else if (mMons) timeWindowHours = Number(mMons) * 30 * 24; // rough month → 30 days
  // "since" gets handled as an absolute bound later

  // category
  let cat =
    /category\s*[:=]\s*([a-z_]+)/.exec(lower)?.[1] ||
    /category\s+as\s+([a-z_]+)/.exec(lower)?.[1] ||
    (() => {
      const words = lower.match(/[a-z_]+/g) || [];
      for (const w of words) {
        if (KNOWN_CATEGORIES.has(w)) return w;
        if (CATEGORY_ALIASES[w])    return CATEGORY_ALIASES[w];
      }
      return null;
    })();

  // location: support quoted, N/A, Unknown, single word
  let loc =
    /(?:in|at)\s+"([^"]+)"/.exec(q)?.[1] ||
    /(?:in|at)\s+(N\/A|Unknown)\b/i.exec(q)?.[1] ||
    /(?:in|at)\s+([A-Za-z]+)/.exec(q)?.[1];
  loc = normalizeLocation(loc);

  // amount
  const mOver = /over\s+(\d+(?:\.\d+)?)/.exec(lower)?.[1];

  // fraud-only
  const fraudOnly = /\b(marked\s+as\s+fraud|is\s+fraud|fraud\s*=\s*true)\b/.test(lower);

  // limit
  const mLimit = /limit\s+(\d+)/.exec(lower)?.[1];

  // txn type
  const mType  = /\b(p2p|p2m)\b/.exec(lower)?.[1];

  return {
    timeWindowHours: timeWindowHours ?? null,
    since: mSince || null, // YYYY-MM-DD
    category:   cat || null,
    location:   loc || null,
    overAmt:    mOver ? Number(mOver) : null,
    fraudOnly,
    limit:      mLimit ? Number(mLimit) : null,
    txnType:    mType ? mType.toUpperCase() : null
  };
}

function clampFilters(f) {
  const out = {
    timeWindowHours: null, since: null, category: null, location: null, overAmt: null,
    fraudOnly: !!f.fraudOnly, limit: null, txnType: null
  };
  if (Number.isFinite(f.timeWindowHours) && f.timeWindowHours > 0) {
    out.timeWindowHours = Math.min(Math.floor(f.timeWindowHours), MAX_HOURS);
  }
  if (typeof f.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.since)) {
    out.since = f.since;
  }
  if (typeof f.category === 'string' && f.category.length <= 32) out.category = f.category.toLowerCase();
  if (typeof f.location === 'string' && f.location.length <= 64) out.location = normalizeLocation(f.location);
  if (Number.isFinite(f.overAmt) && f.overAmt >= 0) out.overAmt = Math.min(f.overAmt, MAX_AMOUNT);
  if (Number.isFinite(f.limit) && f.limit > 0) out.limit = Math.min(Math.floor(f.limit), MAX_ROWS);
  if (f.txnType && (f.txnType === 'P2P' || f.txnType === 'P2M')) out.txnType = f.txnType;
  return out;
}

async function parseQueryLLM(q) {
  const system = `You output ONLY JSON filters:
{"timeWindowHours": number|null, "since": "YYYY-MM-DD"|null, "category": string|null, "location": string|null, "overAmt": number|null, "fraudOnly": boolean, "limit": number|null, "txnType": "P2P"|"P2M"|null}
- Convert "last N hours/days/months" to hours (cap via retriever).
- Recognize 'since YYYY-MM-DD' as absolute lower bound.
- 'category as X' or 'category=X' or bare tokens (crypto, travel, etc.).
- 'marked as fraud'/'is fraud'/'fraud=true' => fraudOnly=true.
- 'limit N' => limit, recognize P2P/P2M.
Return JSON ONLY.`;
  const user = `Query: ${q}\nReturn filters JSON only.`;

  const text = await callClaudeJSON({ system, user });
  try { return clampFilters(JSON.parse(text)); } catch { return clampFilters(parseQueryLocal(q)); }
}

async function buildFilters(q) {
  if (isEnabled()) {
    try {
      const f = await parseQueryLLM(q);
      return { filters: f, usedLLM: true, fellBack: false };
    } catch {
      return { filters: clampFilters(parseQueryLocal(q)), usedLLM: true, fellBack: true };
    }
  }
  return { filters: clampFilters(parseQueryLocal(q)), usedLLM: false, fellBack: false };
}

async function fetchTransactions(db, q) {
  const { filters, usedLLM, fellBack } = await buildFilters(q);

  const where = [];
  const vals  = [];
  let i = 1;

  // time window OR since-date
  if (filters.timeWindowHours) {
    where.push(`txn_time >= now() - interval '${filters.timeWindowHours} hours'`);
  }
  if (filters.since) {
    // prefer since if both provided (or add both if you want the tighter bound)
    where.push(`txn_time >= $${i}::timestamptz`);
    vals.push(filters.since + ' 00:00:00+00'); // midnight UTC
    i++;
  }

  if (filters.category) {
    where.push(`lower(merchant_category) = lower($${i})`);
    vals.push(filters.category); i++;
  }
  if (filters.location) {
    where.push(`lower(location) = lower($${i})`);
    vals.push(filters.location); i++;
  }
  if (filters.overAmt != null) {
    where.push(`amount >= $${i}`);
    vals.push(filters.overAmt); i++;
  }
  if (filters.fraudOnly) where.push(`is_fraud = true`);
  if (filters.txnType) {
    where.push(`txn_type = $${i}`);
    vals.push(filters.txnType); i++;
  }

  const limit = filters.limit || MAX_ROWS;

  const sql = `
    SELECT
      txn_id, payer_vpa, payee_vpa, amount, txn_time, device_id, ip_address,
      merchant_category, location, txn_type, is_fraud,
      fraud_score, is_fraud_pred   -- expose DB risk columns to app/score
    FROM upi_transactions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY txn_time DESC
    LIMIT ${limit}
  `;

  if (process.env.DEBUG_SQL === '1') {
    console.log('[SQL]', sql.replace(/\s+/g, ' ').trim());
    console.log('[VALS]', vals);
  }

  const { rows } = await db.query(sql, vals);

  // Optional fallback: if fraudOnly and empty, retry without label
  if (filters.fraudOnly && rows.length === 0) {
    const where2 = where.filter(w => w !== 'is_fraud = true');
    const sql2 = `
      SELECT
        txn_id, payer_vpa, payee_vpa, amount, txn_time, device_id, ip_address,
        merchant_category, location, txn_type, is_fraud,
        fraud_score, is_fraud_pred
      FROM upi_transactions
      ${where2.length ? `WHERE ${where2.join(' AND ')}` : ''}
      ORDER BY txn_time DESC
      LIMIT ${limit}
    `;
    if (process.env.DEBUG_SQL === '1') {
      console.log('[FALLBACK SQL]', sql2.replace(/\s+/g, ' ').trim());
      console.log('[VALS]', vals);
    }
    const { rows: rows2 } = await db.query(sql2, vals);
    return { filters, count: rows2.length, rows: rows2, meta: { usedLLM, fellBack } };
  }

  return { filters, count: rows.length, rows, meta: { usedLLM, fellBack } };
}

module.exports = { fetchTransactions, clampFilters, parseQueryLocal };
