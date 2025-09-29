// web/src/App.jsx
import React, { useEffect, useRef, useState } from 'react'

const API =
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.replace(/\/$/, '')) ||
  `${window.location.protocol}//${window.location.hostname}:3000`

function Badge({ children, tone = 'neutral' }) {
  const colors = {
    neutral: { bg: '#0b1028', br: '#2a3869', fg: '#e7ecff' },
    info:    { bg: '#0b1b3a', br: '#3552a3', fg: '#bcd0ff' },
    warn:    { bg: '#342500', br: '#6b4c00', fg: '#ffd58a' },
    ok:      { bg: '#0b2a1b', br: '#1f5d3f', fg: '#b7ffd9' },
    danger:  { bg: '#2a0b0b', br: '#5d1f1f', fg: '#ffb7b7' },
    purple:  { bg: '#231034', br: '#4b2b6f', fg: '#e3c9ff' }
  }[tone] || { bg: '#0b1028', br: '#2a3869', fg: '#e7ecff' }
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 999,
      border: `1px solid ${colors.br}`, background: colors.bg, color: colors.fg,
      fontSize: 12, marginRight: 6
    }}>
      {children}
    </span>
  )
}

function ComplianceBadge({ action }) {
  const tone = action === 'ESCALATE' ? 'danger' : action === 'REVIEW' ? 'warn' : 'ok'
  return <Badge tone={tone}>Compliance: {action || 'OK'}</Badge>
}

export default function App() {
  const [query, setQuery] = useState('marked as fraud category:crypto over 1000 last 30 days in Unknown limit 5')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [live, setLive] = useState(false)

  const evtRef = useRef(null)

  const run = async () => {
    if (live) {
      if (evtRef.current) { evtRef.current.close(); evtRef.current = null }
      setLoading(true); setError(''); setData(null)
      const url = `${API}/api/run/stream?q=${encodeURIComponent(query)}`
      const es = new EventSource(url)
      evtRef.current = es

      const partial = { stepTimings: {} }

      es.addEventListener('retriever', (e) => {
        const payload = JSON.parse(e.data)
        partial.retriever = payload
        partial.stepTimings.retriever_ms = payload.took_ms
        setData({ ...partial })
      })
      es.addEventListener('fraudDetection', (e) => {
        const payload = JSON.parse(e.data)
        partial.fraudDetection = payload
        partial.stepTimings.fraudDetection_ms = payload.took_ms
        setData({ ...partial })
      })
      es.addEventListener('riskScoring', (e) => {
        const payload = JSON.parse(e.data)
        partial.riskScoring = payload
        partial.stepTimings.riskScoring_ms = payload.took_ms
        setData({ ...partial })
      })
      es.addEventListener('writer', (e) => {
        const payload = JSON.parse(e.data)
        partial.writer = { narrative: payload.narrative, meta: payload.meta }
        partial.stepTimings.writer_ms = payload.took_ms
        setData({ ...partial })
      })
      es.addEventListener('compliance', (e) => {
        const payload = JSON.parse(e.data)
        partial.compliance = payload
        partial.stepTimings.compliance_ms = payload.took_ms
        setData({ ...partial })
      })
      es.addEventListener('done', () => {
        setLoading(false)
        es.close()
        evtRef.current = null
      })
      es.addEventListener('error', () => {
        setError('Stream error')
        setLoading(false)
        es.close()
        evtRef.current = null
      })
      return
    }

    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch(`${API}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}))
        throw new Error(msg.error || res.statusText)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => { if (evtRef.current) evtRef.current.close() }, [])

  const risk = data?.riskScoring?.overall ?? null
  const txCount = data?.retriever?.count ?? null
  const action = data?.compliance?.action ?? 'OK'
  const compNotes = Array.isArray(data?.compliance?.notes) ? data.compliance.notes : []
  const summary = data?.writer?.narrative || ''

  const llm = {
    retriever: !!data?.retriever?.meta?.usedLLM,
    writer:    !!data?.writer?.meta?.usedLLM,
    compliance:!!data?.compliance?.usedLLM,
  }

  const topTxns = Array.isArray(data?.topTxns) ? data.topTxns : []

  const presets = [
    { label: 'OK (food 24h)', q: 'category:food over 15000 last 24 hours in Bangalore limit 10' },
    { label: 'REVIEW (donation fraud 30d)', q: 'marked as fraud category:donation over 19000 last 30 days in Delhi limit 10' },
    { label: 'ESCALATE (crypto 30d)', q: 'marked as fraud category:crypto over 1000 last 30 days in Unknown limit 5' }
  ]

  return (
    <div className="wrap">
      <div className="card">
        <h1>UPI Multi-Agent Orchestration</h1>
        <p className="muted">Retriever → FraudDetection → RiskScoring → Writer → Compliance</p>

        <div className="row">
          <input
            placeholder="Ask…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button onClick={run} disabled={loading}>{loading ? (live ? 'Streaming…' : 'Running…') : (live ? 'Stream' : 'Run')}</button>
        </div>

        <div className="row" style={{marginTop:8}}>
          {presets.map(p => (
            <button key={p.label} onClick={() => setQuery(p.q)} disabled={loading}>{p.label}</button>
          ))}
          <label style={{display:'flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} />
            Live (SSE)
          </label>
        </div>

        {error && <p style={{color:'#ff8a8a', marginTop:12}}>Error: {error}</p>}

        {data && (
          <>
            <div style={{marginTop:16}}>
              {data.id && <Badge>Run ID: {data.id}</Badge>}
              {data.created_at && <Badge tone="info">{new Date(data.created_at).toLocaleString()}</Badge>}
              {risk != null && <Badge tone={risk >= 80 ? 'danger' : risk >= 60 ? 'warn' : 'ok'}>Risk: {risk}/100</Badge>}
              {txCount != null && <Badge tone="info">Transactions: {txCount}</Badge>}
              <ComplianceBadge action={action} />
              {llm.retriever && <Badge tone="purple">LLM: Retriever</Badge>}
              {llm.writer && <Badge tone="purple">LLM: Writer</Badge>}
              {llm.compliance && <Badge tone="purple">LLM: Compliance</Badge>}
            </div>

            {/* Executive Summary */}
            <div className="section" style={{marginTop:12}}>
              <h3>Executive Summary</h3>
              <div className="timing">Time: {data.stepTimings?.writer_ms ?? 0} ms</div>
              <div style={{
                whiteSpace: 'pre-wrap',
                background:'#0b1028',
                border:'1px solid #1b2240',
                borderRadius:8,
                padding:12,
                marginTop:8,
                lineHeight:1.5
              }}>
                {summary || 'No summary generated.'}
              </div>
              <div style={{marginTop:8}}>
                {data?.retriever?.filters?.fraudOnly && <Badge>Fraud labels used</Badge>}
                {Array.isArray(data?.fraudDetection?.flags) &&
                  <Badge>Flags: {data.fraudDetection.flags.length}</Badge>}
              </div>
            </div>

            {/* Top Transactions */}
            <div className="section" style={{marginTop:12}}>
              <h3>Top Transactions</h3>
              <div className="timing">From risk scores</div>
              {topTxns.length ? (
                <div style={{overflowX:'auto', marginTop:8}}>
                  <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        <th style={{textAlign:'left', padding:'6px'}}>Txn ID</th>
                        <th style={{textAlign:'right', padding:'6px'}}>Amount</th>
                        <th style={{textAlign:'left', padding:'6px'}}>When</th>
                        <th style={{textAlign:'left', padding:'6px'}}>Location</th>
                        <th style={{textAlign:'left', padding:'6px'}}>Category</th>
                        <th style={{textAlign:'left', padding:'6px'}}>Type</th>
                        <th style={{textAlign:'right', padding:'6px'}}>Score</th>
                        <th style={{textAlign:'left', padding:'6px'}}>Reasons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTxns.map(t => (
                        <tr key={t.txn_id} style={{borderTop:'1px solid #1b2240'}}>
                          <td style={{padding:'6px', fontFamily:'ui-monospace'}}>{t.txn_id.slice(0,8)}…</td>
                          <td style={{padding:'6px', textAlign:'right'}}>{Number(t.amount).toLocaleString()}</td>
                          <td style={{padding:'6px'}}>{t.txn_time ? new Date(t.txn_time).toLocaleString() : ''}</td>
                          <td style={{padding:'6px'}}>{t.location || ''}</td>
                          <td style={{padding:'6px'}}>{t.category || ''}</td>
                          <td style={{padding:'6px'}}>{t.txn_type || ''}</td>
                          <td style={{padding:'6px', textAlign:'right'}}>{t.score}</td>
                          <td style={{padding:'6px'}}>{(t.reasons||[]).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{color:'#9bb0ff', marginTop:8}}>No transactions to display.</div>
              )}
            </div>

            {/* Raw panes */}
            <div className="grid">
              <div className="section">
                <h3>Retriever {llm.retriever && <Badge tone="purple">LLM</Badge>}</h3>
                <div className="timing">Time: {data.stepTimings?.retriever_ms ?? 0} ms</div>
                <pre>{JSON.stringify({filters: data.retriever?.filters, count: data.retriever?.count, sample: data.retriever?.sample}, null, 2)}</pre>
              </div>
              <div className="section">
                <h3>FraudDetection</h3>
                <div className="timing">Time: {data.stepTimings?.fraudDetection_ms ?? 0} ms</div>
                <pre>{JSON.stringify(data.fraudDetection, null, 2)}</pre>
              </div>
              <div className="section">
                <h3>RiskScoring</h3>
                <div className="timing">Time: {data.stepTimings?.riskScoring_ms ?? 0} ms</div>
                <pre>{JSON.stringify(data.riskScoring, null, 2)}</pre>
              </div>
              <div className="section">
                <h3>Writer {llm.writer && <Badge tone="purple">LLM</Badge>}</h3>
                <div className="timing">Time: {data.stepTimings?.writer_ms ?? 0} ms</div>
                <pre>{JSON.stringify(data.writer, null, 2)}</pre>
              </div>
              <div className="section">
                <h3>Compliance {llm.compliance && <Badge tone="purple">LLM</Badge>}</h3>
                <div className="timing">Time: {data.stepTimings?.compliance_ms ?? 0} ms</div>
                <div style={{marginBottom:8}}>
                  <ComplianceBadge action={action} />
                </div>
                {compNotes.length > 0 ? (
                  <ul style={{marginTop:8}}>
                    {compNotes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                ) : (
                  <div style={{color:'#9bb0ff'}}>No issues detected.</div>
                )}
                <div style={{marginTop:8}}>
                  <pre>{JSON.stringify(data.compliance, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="footer">
              Tip: set <code>VITE_API_URL</code> if your API isn’t on <code>localhost:3000</code>. Toggle <strong>Live (SSE)</strong> for step-by-step updates.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
