// agent/src/llm.js
// Minimal Anthropic client using fetch (Node 18+)

require('dotenv').config();

const LLM_ENABLED = (process.env.LLM_MODE || '').toLowerCase() === 'claude';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
const DEFAULT_MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS || 400);
const LLM_STEP_TIMEOUT_MS = Number(process.env.LLM_STEP_TIMEOUT_MS || 6000);

function isEnabled() {
  return LLM_ENABLED && !!ANTHROPIC_API_KEY;
}

async function callClaudeJSON({ system, user, maxTokens = DEFAULT_MAX_TOKENS, timeoutMs = LLM_STEP_TIMEOUT_MS }) {
  if (!isEnabled()) throw new Error('LLM disabled');

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Claude HTTP ${res.status}: ${txt}`);
    }
    const json = await res.json();
    const text = (json?.content?.[0]?.text || '').trim();
    return text;
  } finally {
    clearTimeout(t);
  }
}

module.exports = { isEnabled, callClaudeJSON };
