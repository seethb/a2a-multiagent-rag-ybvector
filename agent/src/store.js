// agent/src/store.js
const { v4: uuidv4 } = require('uuid');
const db = require('../../server/src/db');

async function saveRun({ queryText, stepTimings, results, riskScore, flags }) {
  const id = uuidv4();
  const created_at = new Date().toISOString();

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS runs (
        id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL,
        query_text TEXT,
        step_timings JSONB,
        results JSONB,
        risk_score NUMERIC,
        flags JSONB
      );
    `);

    // 👇 Stringify JSON fields and cast to jsonb
    await db.query(
      `INSERT INTO runs (id, created_at, query_text, step_timings, results, risk_score, flags)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb)`,
      [
        id,
        created_at,
        queryText,
        JSON.stringify(stepTimings ?? {}),
        JSON.stringify(results ?? {}),
        riskScore ?? 0,
        JSON.stringify(flags ?? []),
      ]
    );
  } catch (e) {
    console.warn('[store] saveRun non-fatal:', e.message);
  }

  return { id, created_at };
}

module.exports = { saveRun };
