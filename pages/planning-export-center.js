import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const EXPORT_DEFINITIONS = [
  { type: 'sprint-summary', title: 'Sprint Summary', desc: 'Executive sprint narrative and delivery snapshot.' },
  { type: 'dependencies', title: 'Dependency Register', desc: 'Cross-team and blocker relationships.' },
  { type: 'risks', title: 'Risk Register', desc: 'Risk profile with severity and mitigation.' },
  { type: 'architecture', title: 'Architecture Notes', desc: 'Architecture guidance and constraints.' },
  { type: 'estimation', title: 'Estimation Delta', desc: 'AI estimate versus final human estimate.' },
  { type: 'human-decisions', title: 'Human Decisions', desc: 'Accept/modify/reject decision log.' },
  { type: 'override-logs', title: 'Override Log', desc: 'Human modifications captured for traceability.' }
]

function parseMaybe(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export default function PlanningExportCenterPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState('')
  const [session, setSession] = useState(null)
  const [previewType, setPreviewType] = useState('sprint-summary')
  const [previewData, setPreviewData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [demoBusy, setDemoBusy] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!router.isReady) return

    const fromQuery = String(router.query.sessionId || '').trim()
    if (fromQuery) {
      setSessionId(fromQuery)
      void loadSession(fromQuery)
      return
    }

    void loadLatestSession()
  }, [router.isReady, router.query.sessionId])

  useEffect(() => {
    if (!sessionId) return
    void loadPreview(sessionId, previewType)
  }, [sessionId, previewType])

  async function loadSession(id) {
    if (!id) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/planning/session?sessionId=${encodeURIComponent(id)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load planning session')
      setSessionId(id)
      setSession(json.session || null)
      setMessage('Session loaded')
    } catch (err) {
      setSession(null)
      setMessage(`Session load failed: ${String(err.message || err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function loadLatestSession() {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/planning/session?limit=25')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load planning sessions')

      const sessions = Array.isArray(json.sessions) ? json.sessions : []
      if (!sessions.length) {
        setSession(null)
        setSessionId('')
        setMessage('No planning sessions found. Load Thesis Demo Data from Thesis Demo to populate evidence exports.')
        return
      }

      const preferred = sessions.find((row) => String(row.id).startsWith('PLAN-THESIS-DEMO'))
        || sessions.find((row) => String(row.status || '').toLowerCase() === 'finalized')
        || sessions[0]

      if (!preferred?.id) {
        setMessage('No valid planning session identifier found.')
        return
      }

      await loadSession(preferred.id)
    } catch (err) {
      setSession(null)
      setSessionId('')
      setMessage(`Latest session load failed: ${String(err.message || err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runDemoAction(action) {
    if (action === 'reset') {
      const confirmed = window.confirm('Reset demo data to default baseline?')
      if (!confirmed) return
    }

    setDemoBusy(action)
    setMessage('')
    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, profile: 'thesis-demo' })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Demo data action failed')

      if (action === 'load') {
        setMessage('Thesis demo data loaded. Latest planning session is now available for export previews.')
      } else {
        setMessage('Demo data reset to baseline defaults.')
      }
      await loadLatestSession()
    } catch (err) {
      setMessage(`Demo data action failed: ${String(err.message || err)}`)
    } finally {
      setDemoBusy('')
    }
  }

  async function loadPreview(id, type) {
    try {
      const res = await fetch(`/api/planning/export?sessionId=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&format=json`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Preview load failed')
      setPreviewData(json.data ?? null)
    } catch (err) {
      setPreviewData({ error: String(err.message || err) })
    }
  }

  const summary = useMemo(() => {
    if (!session) return null
    return {
      team: session.team_name || '-',
      sprint: session.sprint_name || '-',
      outputs: Array.isArray(session.outputs) ? session.outputs.length : 0,
      dependencies: Array.isArray(session.dependencies) ? session.dependencies.length : 0,
      risks: Array.isArray(session.risks) ? session.risks.length : 0,
      decisions: Array.isArray(session.decisions) ? session.decisions.length : 0
    }
  }, [session])

  const previewPretty = useMemo(() => {
    if (previewData === null || previewData === undefined) return 'No preview loaded yet.'
    const parsed = parseMaybe(previewData)
    if (parsed) return JSON.stringify(parsed, null, 2)
    return JSON.stringify(previewData, null, 2)
  }, [previewData])

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <p className="eyebrow">Thesis Evidence and Reporting</p>
          <h1>Planning Export Center</h1>
          <p>
            Package sprint planning outputs as governed evidence bundles for leadership reviews,
            delivery operations, and thesis documentation.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/conceptual-framework">Conceptual Framework</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/evaluation">Evaluation</Link>
          <Link href="/agentic-workflow">Supporting Workflow</Link>
          <Link href="/dashboard">Supporting Dashboard</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel controls">
        <label>
          Session ID
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Enter planning session ID"
          />
        </label>
        <button onClick={() => void loadSession(sessionId)} disabled={!sessionId || busy}>
          {busy ? 'Loading...' : 'Load Session'}
        </button>
        <button className="secondary" onClick={() => void loadLatestSession()} disabled={busy || Boolean(demoBusy)}>
          Latest Session
        </button>
        <button onClick={() => void runDemoAction('load')} disabled={Boolean(demoBusy) || busy}>
          {demoBusy === 'load' ? 'Loading...' : 'Load Thesis Demo Data'}
        </button>
        <button className="ghost" onClick={() => void runDemoAction('reset')} disabled={Boolean(demoBusy) || busy}>
          {demoBusy === 'reset' ? 'Resetting...' : 'Reset Demo Data'}
        </button>
      </section>

      {summary ? (
        <section className="stats">
          <article><span>Team</span><strong>{summary.team}</strong></article>
          <article><span>Sprint</span><strong>{summary.sprint}</strong></article>
          <article><span>Agent Outputs</span><strong>{summary.outputs}</strong></article>
          <article><span>Dependencies</span><strong>{summary.dependencies}</strong></article>
          <article><span>Risks</span><strong>{summary.risks}</strong></article>
          <article><span>Decisions</span><strong>{summary.decisions}</strong></article>
        </section>
      ) : null}

      <section className="panel">
        <h2>Export Packages</h2>
        {!sessionId ? <p className="muted">Load a planning session first, or use Load Thesis Demo Data to seed deterministic evidence records.</p> : (
          <div className="grid">
            {EXPORT_DEFINITIONS.map((item) => (
              <article key={item.type} className="card">
                <strong>{item.title}</strong>
                <p>{item.desc}</p>
                <div className="actions">
                  <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=${encodeURIComponent(item.type)}&format=json`} target="_blank" rel="noreferrer">JSON</a>
                  <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=${encodeURIComponent(item.type)}&format=csv`} target="_blank" rel="noreferrer">CSV</a>
                  <button type="button" onClick={() => setPreviewType(item.type)}>Preview</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel twoCol">
        <article>
          <h2>Live JSON Preview</h2>
          <label>
            Preview Type
            <select value={previewType} onChange={(e) => setPreviewType(e.target.value)}>
              {EXPORT_DEFINITIONS.map((item) => (
                <option key={item.type} value={item.type}>{item.title}</option>
              ))}
            </select>
          </label>
          <pre>{previewPretty}</pre>
        </article>

        <article>
          <h2>Evaluation Metrics</h2>
          <p className="muted">
            Download cross-session evaluation metrics for acceptance analysis and thesis chapter reporting.
          </p>
          <div className="actions vertical">
            <a href="/api/planning/export?type=evaluation-metrics&format=csv" target="_blank" rel="noreferrer">Download Evaluation Metrics (CSV)</a>
            <a href="/api/planning/export?type=evaluation-metrics&format=json" target="_blank" rel="noreferrer">Open Evaluation Metrics (JSON)</a>
          </div>
        </article>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px;
          color: #12293f;
          font-family: 'Sora', 'Segoe UI', sans-serif;
          position: relative;
        }

        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 8% 12%, rgba(15, 157, 196, 0.16), transparent 42%),
            radial-gradient(circle at 85% 14%, rgba(37, 99, 235, 0.14), transparent 44%),
            linear-gradient(180deg, #f8fcff, #eef5ff 62%, #f9fcff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 12px;
        }

        .eyebrow {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #0a5b8a;
          font-weight: 700;
        }

        h1 {
          margin: 8px 0;
          font-size: 34px;
        }

        .hero p {
          margin: 0;
          color: #3c5670;
          max-width: 760px;
        }

        .heroLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .heroLinks :global(a) {
          text-decoration: none;
          color: #0f3d67;
          border: 1px solid #c8ddf3;
          border-radius: 999px;
          background: #fff;
          padding: 7px 12px;
          font-weight: 700;
        }

        .banner {
          border: 1px solid #9fd4f3;
          background: #edf7ff;
          border-radius: 10px;
          padding: 9px 12px;
          margin-bottom: 12px;
          color: #12507f;
          font-weight: 600;
        }

        .panel {
          border: 1px solid #d6e4f4;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
          margin-bottom: 12px;
          padding: 12px;
        }

        .controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: flex-end;
        }

        .controls label {
          flex: 1;
          display: grid;
          gap: 4px;
          font-size: 13px;
          color: #375069;
          font-weight: 700;
        }

        input,
        select {
          border: 1px solid #c4d7ee;
          border-radius: 10px;
          padding: 8px;
          font-size: 13px;
          color: #0f2941;
        }

        button {
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          color: #fff;
          background: linear-gradient(135deg, #1e4db1, #0b8aa7);
          font-weight: 700;
          cursor: pointer;
        }

        button.secondary {
          background: #0f766e;
        }

        button.ghost {
          background: #dbeafe;
          color: #1e3a8a;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .stats {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          margin-bottom: 12px;
        }

        .stats article {
          border: 1px solid #d4e3f4;
          border-radius: 12px;
          background: #fbfdff;
          padding: 10px;
          display: grid;
          gap: 3px;
        }

        .stats span {
          color: #4d647d;
          font-size: 12px;
          font-weight: 700;
        }

        .stats strong {
          color: #112d48;
          font-size: 21px;
        }

        h2 {
          margin: 0 0 8px;
        }

        .grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .card {
          border: 1px solid #d2e2f4;
          border-radius: 12px;
          background: linear-gradient(180deg, #ffffff, #f4faff);
          padding: 10px;
          display: grid;
          gap: 6px;
        }

        .card strong {
          color: #123659;
        }

        .card p {
          margin: 0;
          color: #48637e;
          font-size: 12px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .actions.vertical {
          display: grid;
          gap: 8px;
        }

        .actions a {
          text-decoration: none;
          border: 1px solid #c8dcf2;
          border-radius: 999px;
          background: #fff;
          color: #0f3962;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .twoCol {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 10px;
        }

        pre {
          margin: 8px 0 0;
          max-height: 430px;
          overflow: auto;
          border-radius: 10px;
          border: 1px solid #d7e3f2;
          background: #f7fbff;
          padding: 10px;
          font-size: 12px;
          white-space: pre-wrap;
          color: #15324f;
          font-family: 'IBM Plex Mono', Consolas, monospace;
        }

        .muted {
          color: #48627c;
        }

        @media (max-width: 1080px) {
          .stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .twoCol {
            grid-template-columns: 1fr;
          }

          .hero {
            flex-direction: column;
          }
        }

        @media (max-width: 760px) {
          .shell {
            padding: 14px;
          }

          .controls {
            flex-direction: column;
            align-items: stretch;
          }

          .grid,
          .stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Sora:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
