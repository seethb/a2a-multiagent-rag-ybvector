// agent/src/roles/compliance.js
// Rule baseline + optional LLM policy assist (conservative merge)

require('dotenv').config();
const { isEnabled, callClaudeJSON } = require('../llm');

const RISK_ESCALATE  = Number(process.env.RISK_ESCALATE  ?? 80);
const RISK_REVIEW    = Number(process.env.RISK_REVIEW    ?? 60);
const FLAGS_ESCALATE = Number(process.env.FLAGS_ESCALATE ?? 5);
const FLAGS_REVIEW   = Number(process.env.FLAGS_REVIEW   ?? 3);

function ruleCompliance(riskOverall, flags) {
  const totalFlags = flags.length;
  let action = 'OK';
  if (riskOverall >= RISK_ESCALATE || totalFlags >= FLAGS_ESCALATE) action = 'ESCALATE';
  else if (riskOverall >= RISK_REVIEW || totalFlags >= FLAGS_REVIEW) action = 'REVIEW';

  const notes = [];
  if (riskOverall >= RISK_ESCALATE) notes.push('High risk score');
  if (totalFlags >= FLAGS_ESCALATE) notes.push('Many flags raised');

  return { action, notes };
}

function severityRank(action) {
  return action === 'ESCALATE' ? 2 : action === 'REVIEW' ? 1 : 0;
}

async function llmCompliance({ query, filters, riskOverall, flags }) {
  const system = `You are a BFSI compliance reviewer. Output JSON only:
{"action":"OK"|"REVIEW"|"ESCALATE","notes":[string,...]}
Be conservative; do not under-call escalation.`;
  const user = `Query: ${query}
Filters: ${JSON.stringify(filters)}
Risk: ${riskOverall}
Flags (up to 15): ${JSON.stringify(flags.slice(0,15))}
Return JSON only.`;

  const text = await callClaudeJSON({ system, user, maxTokens: 250 });
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* ignore */ }
  if (!parsed || !['OK','REVIEW','ESCALATE'].includes(parsed.action)) return null;
  if (!Array.isArray(parsed.notes)) parsed.notes = [];
  parsed.notes = parsed.notes.slice(0, 10).map(s => String(s).slice(0, 200));
  return parsed;
}

async function checkCompliance(riskOverall, flags, ctx = {}) {
  const base = ruleCompliance(riskOverall, flags);
  if (!isEnabled()) return { ...base, usedLLM: false, fellBack: false };

  try {
    const llm = await llmCompliance({
      query: ctx.query || '',
      filters: ctx.filters || {},
      riskOverall,
      flags
    });
    if (!llm) return { ...base, usedLLM: true, fellBack: true };
    const chosen = severityRank(llm.action) >= severityRank(base.action) ? llm : base;
    const noteSet = new Set([...(base.notes||[]), ...(llm.notes||[])]);
    chosen.notes = Array.from(noteSet).slice(0, 12);
    return { ...chosen, usedLLM: true, fellBack: false };
  } catch {
    return { ...base, usedLLM: true, fellBack: true };
  }
}

module.exports = { checkCompliance, ruleCompliance };
