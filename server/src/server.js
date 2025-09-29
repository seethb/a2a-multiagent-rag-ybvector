// server/src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ---- CORS (dev-friendly, lock down later) ----
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/postman
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, true); // open in dev
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
}));
app.options('*', cors());

// ---- Basic middleware ----
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} Origin=${req.headers.origin || '-'}`);
  next();
});
app.use(express.json({ limit: '2mb' }));

// ---- DB + Agent ----
const db = require('./db');
const { runPipeline } = require(path.join(__dirname, '../../agent/src/agent'));
const { fetchTransactions } = require(path.join(__dirname, '../../agent/src/roles/retriever'));
const { detectFlags } = require(path.join(__dirname, '../../agent/src/roles/fraudDetection'));
const { score } = require(path.join(__dirname, '../../agent/src/roles/riskScoring'));
const { summarize } = require(path.join(__dirname, '../../agent/src/roles/writer'));
const { checkCompliance } = require(path.join(__dirname, '../../agent/src/roles/compliance'));

// ---- Routes ----

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, now: new Date().toISOString() }));

// Diagnostic (confirms DB/env)
app.get('/api/diag', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT current_database() AS db,
             inet_server_port()  AS port,
             now()                AS now_utc,
             (
               SELECT count(*) FROM upi_transactions
               WHERE is_fraud = true
                 AND lower(merchant_category) = 'crypto'
                 AND lower(location) = 'unknown'
                 AND amount >= 10
                 AND txn_time >= now() - interval '1368 hours'
             ) AS fraud_crypto_unknown_57d
    `);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// One-shot run (POST)
app.post('/api/run', async (req, res) => {
  try {
    const q = String(req.body?.query || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing query' });

    const result = await runPipeline(q);
    return res.json(result);
  } catch (e) {
    console.error('Pipeline error:', e);
    return res.status(500).json({ error: e.message || 'Pipeline failed' });
  }
});

// Live stream run (SSE)
app.get('/api/run/stream', async (req, res) => {
  const query = String(req.query?.q || '').trim();
  if (!query) {
    res.status(400).end('Missing q');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, payload) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const t0 = Date.now();
    const retrieved = await fetchTransactions(db, query);
    send('retriever', { ...retrieved, took_ms: Date.now() - t0 });

    const t1 = Date.now();
    const flags = detectFlags(retrieved.rows);
    send('fraudDetection', { flags, took_ms: Date.now() - t1 });

    const t2 = Date.now();
    const risk = score(retrieved.rows, flags);
    send('riskScoring', { ...risk, took_ms: Date.now() - t2 });

    const t3 = Date.now();
    const writerOut = await summarize({
      query,
      filters: retrieved.filters,
      count: retrieved.count,
      flags,
      risk
    });
    send('writer', { narrative: writerOut.text ?? writerOut, meta: { usedLLM: !!writerOut.usedLLM }, took_ms: Date.now() - t3 });

    const t4 = Date.now();
    const compliance = await checkCompliance(risk.overall, flags, { query, filters: retrieved.filters });
    send('compliance', { ...compliance, took_ms: Date.now() - t4 });

    send('done', { ok: true });
    res.end();
  } catch (e) {
    send('error', { message: e.message || String(e) });
    res.end();
  }
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
