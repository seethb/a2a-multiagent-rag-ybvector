// agent/src/roles/writer.js
// Deterministic summary with optional Claude enrichment

require('dotenv').config();
const { isEnabled, callClaudeJSON } = require('../llm');

function deterministicSummary({ query, filters, count, flags, risk }) {
  const top = {};
  for (const f of flags) top[f.reason] = (top[f.reason] || 0) + 1;
  const sorted = Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const lines = [];
  lines.push(`Query: “${query}”. Retrieved ${count} transactions.`);
  if (filters && Object.values(filters).some(Boolean)) {
    lines.push(`Filters → ${JSON.stringify(filters)}`);
  }
  lines.push(`Overall risk score: ${risk.overall}/100`);
  if (sorted.length) {
    lines.push('Top flag reasons: ' + sorted.map(([r,c]) => `${r} (${c})`).join(', '));
  }
  return lines.join('\n');
}

async function summarize({ query, filters, count, flags, risk }) {
  if (!isEnabled()) {
    return { text: deterministicSummary({ query, filters, count, flags, risk }), usedLLM: false, fellBack: false };
  }

  const system = `You are a compliance analyst. Write concise, factual summaries for fraud reviews.`;
  const user = `
User query: ${query}
Transactions: ${count}
Filters: ${JSON.stringify(filters)}
Risk: ${risk.overall}
Flags (sample up to 10): ${JSON.stringify(flags.slice(0,10))}

Write a crisp summary (4–7 lines), no markdown, no headings.
Include: scope, filters, risk, top flag reasons, and a one-line recommendation.
  `.trim();

  try {
    const text = await callClaudeJSON({ system, user, maxTokens: 350 });
    return { text: (text || '').trim(), usedLLM: true, fellBack: false };
  } catch {
    return { text: deterministicSummary({ query, filters, count, flags, risk }), usedLLM: false, fellBack: true };
  }
}

module.exports = { summarize, deterministicSummary };
