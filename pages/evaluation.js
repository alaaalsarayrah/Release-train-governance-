import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const initialForm = {
  scenarioId: 'SCN-001',
  scenarioName: 'Backlog refinement with dependency resolution',
  participantId: '',
  participantRole: '',
  evaluatorId: '',
  evaluatorRole: 'Scrum Master',
  evaluatedAt: nowInputValue(),
  baselineManualPlanningMinutes: '',
  aiAssistedPlanningMinutes: '',
  taskCompletionMinutes: '',
  recommendationsGenerated: '',
  recommendationsAccepted: '',
  dependencyIssuesIdentified: '',
  dependencyIssuesValidated: '',
  riskItemsIdentified: '',
  riskRecommendationsAccepted: '',
  estimationBaseline: '',
  aiSupportedEstimate: '',
  clarificationRequests: '',
  taskCompletionSuccess: '1',
  systemResponseMs: '',
  errorCount: '',
  perceivedUsefulness: 4,
  easeOfUse: 4,
  trust: 4,
  intentionToUse: 4,
  evaluatorComments: '',
  observations: '',
  limitations: '',
  notes: '',
  interviewNotes: ''
}

function metricValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  return `${value}${suffix}`
}

export default function EvaluationPage() {
  const [form, setForm] = useState(initialForm)
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [demoBusy, setDemoBusy] = useState('')
  const [message, setMessage] = useState('')

  const acceptanceRate = useMemo(() => {
    if (!summary || summary.recommendationAcceptanceRate === null) return '-'
    return `${summary.recommendationAcceptanceRate}%`
  }, [summary])

  useEffect(() => {
    void loadEntries()
  }, [])

  async function loadEntries() {
    setLoading(true)
    try {
      const res = await fetch('/api/agentic/evaluation?limit=200')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load evaluation data')
      setEntries(json.evaluations || [])
      setSummary(json.summary || null)
    } catch (err) {
      setMessage(`Load failed: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e) {

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
            setMessage('Thesis evaluation evidence loaded successfully.')
          } else {
            setMessage('Demo data reset to baseline defaults.')
          }
          await loadEntries()
        } catch (err) {
          setMessage(`Demo data action failed: ${err.message || err}`)
        } finally {
          setDemoBusy('')
        }
      }
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    try {
      const res = await fetch('/api/agentic/evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Save failed')

      setMessage('Evaluation entry saved.')
      setForm((prev) => ({ ...initialForm, scenarioId: prev.scenarioId, scenarioName: prev.scenarioName }))
      await loadEntries()
    } catch (err) {
      setMessage(`Save failed: ${err.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Thesis Evaluation Evidence Console</h1>
          <p>Capture TAM survey ratings, scenario metrics, and interview notes for Chapter 4 evidence.</p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/planning-export-center">Export Center</Link>
          <Link href="/agentic-workflow">Supporting Workflow</Link>
          <a href="/api/agentic/chapter4-evidence?format=json" target="_blank" rel="noreferrer">Export JSON</a>
          <a href="/api/agentic/chapter4-evidence?format=csv" target="_blank" rel="noreferrer">Export CSV</a>
          <Link href="/">Home</Link>
            <Link href="/conceptual-framework">Conceptual Framework</Link>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel">
        <h2>Demo Data Controls</h2>
        <p className="muted">Load deterministic thesis records to populate this console before demonstrations.</p>
        <div className="actions">
          <button type="button" onClick={() => void runDemoAction('load')} disabled={Boolean(demoBusy) || loading}>
            {demoBusy === 'load' ? 'Loading...' : 'Load Thesis Demo Data'}
          </button>
          <button type="button" className="secondary" onClick={() => void runDemoAction('reset')} disabled={Boolean(demoBusy) || loading}>
            {demoBusy === 'reset' ? 'Resetting...' : 'Reset Demo Data'}
          </button>
        </div>
          e.preventDefault()
          const errors = validateForm(form)
          setValidationErrors(errors)
          if (errors.length) {
            setMessage('Please correct the validation errors before saving.')
            return
          }
          setSubmitting(true)
          setMessage('')
      </section>

      <section className="panel">
        <h2>Record Evaluation Entry</h2>
        <form onSubmit={submit}>
          <div className="grid">
            <label>
              Scenario ID
              <input value={form.scenarioId} onChange={(e) => updateField('scenarioId', e.target.value)} required />
            </label>
            <label>
              Scenario Name
              <input value={form.scenarioName} onChange={(e) => updateField('scenarioName', e.target.value)} />
            </label>
            <label>
              Participant ID
              <input value={form.participantId} onChange={(e) => updateField('participantId', e.target.value)} placeholder="P-001" />
            </label>
            <label>
              Participant Role
              <input value={form.participantRole} onChange={(e) => updateField('participantRole', e.target.value)} placeholder="Product Owner" />
            </label>
          </div>

          <h3>TAM Ratings (1-5)</h3>
          <div className="grid small">
            <label>
              Perceived Usefulness
              <input type="number" min="1" max="5" value={form.perceivedUsefulness} onChange={(e) => updateField('perceivedUsefulness', e.target.value)} />
            </label>
            <label>
              Ease of Use
              <input type="number" min="1" max="5" value={form.easeOfUse} onChange={(e) => updateField('easeOfUse', e.target.value)} />
            </label>
            <label>
              Trust
              <input type="number" min="1" max="5" value={form.trust} onChange={(e) => updateField('trust', e.target.value)} />
            </label>
            <label>
              Intention to Use
              <input type="number" min="1" max="5" value={form.intentionToUse} onChange={(e) => updateField('intentionToUse', e.target.value)} />
            </label>
          </div>

          <h3>Scenario Metrics</h3>
          <div className="grid small">
            <label>
              Task Completion (minutes)
              <input type="number" min="0" step="0.1" value={form.taskCompletionMinutes} onChange={(e) => updateField('taskCompletionMinutes', e.target.value)} />
            </label>
            <label>
              Recommendations Generated
              <input type="number" min="0" value={form.recommendationsGenerated} onChange={(e) => updateField('recommendationsGenerated', e.target.value)} />
            </label>
            <label>
              Recommendations Accepted
              <input type="number" min="0" value={form.recommendationsAccepted} onChange={(e) => updateField('recommendationsAccepted', e.target.value)} />
            </label>
            <label>
              Clarification Requests
              <input type="number" min="0" value={form.clarificationRequests} onChange={(e) => updateField('clarificationRequests', e.target.value)} />
            </label>
            <label>
              Avg System Response (ms)
              <input type="number" min="0" value={form.systemResponseMs} onChange={(e) => updateField('systemResponseMs', e.target.value)} />
            </label>
            <label>
              Error Count
              <input type="number" min="0" value={form.errorCount} onChange={(e) => updateField('errorCount', e.target.value)} />
            </label>
          </div>

          <label>
            Post-Scenario Notes
            <textarea rows={3} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
          </label>

          <label>
            Interview Notes
            <textarea rows={4} value={form.interviewNotes} onChange={(e) => updateField('interviewNotes', e.target.value)} />
          </label>

          <div className="actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Evaluation'}</button>
            <button type="button" className="secondary" onClick={() => setForm(initialForm)}>Reset</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Chapter 4 Snapshot</h2>
          <button onClick={() => void loadEntries()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>

        <div className="stats">
          <div><strong>Total</strong><span>{metricValue(summary?.totalEvaluations)}</span></div>
          <div><strong>Usefulness</strong><span>{metricValue(summary?.avgPerceivedUsefulness)}</span></div>
          <div><strong>Ease of Use</strong><span>{metricValue(summary?.avgEaseOfUse)}</span></div>
          <div><strong>Trust</strong><span>{metricValue(summary?.avgTrust)}</span></div>
          <div><strong>Intention</strong><span>{metricValue(summary?.avgIntentionToUse)}</span></div>
          <div><strong>Acceptance Rate</strong><span>{acceptanceRate}</span></div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Scenario</th>
                <th>Participant</th>
                <th>PU</th>
                <th>PEOU</th>
                <th>Trust</th>
                <th>IU</th>
                <th>Task Min</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id}>
                  <td>{row.created_at}</td>
                  <td>{row.scenario_id}</td>
                  <td>{row.participant_id || '-'}</td>
                  <td>{metricValue(row.perceived_usefulness)}</td>
                  <td>{metricValue(row.ease_of_use)}</td>
                  <td>{metricValue(row.trust)}</td>
                  <td>{metricValue(row.intention_to_use)}</td>
                  <td>{metricValue(row.task_completion_minutes)}</td>
                </tr>
              ))}
              {!entries.length ? (
                <tr>
                  <td colSpan={8}>No evaluation records yet. Use Load Thesis Demo Data to prefill Chapter 4 evidence.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1180px;
          margin: 0 auto;
          padding: 24px;
          color: #11253d;
          position: relative;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 10% 12%, rgba(20, 143, 180, 0.12), transparent 40%),
            radial-gradient(circle at 84% 10%, rgba(57, 118, 218, 0.14), transparent 44%),
            linear-gradient(180deg, #f8fbff, #edf4ff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 33px;
        }

        .hero p {
          margin: 8px 0 0;
          color: #3d536d;
        }

        .heroLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .heroLinks :global(a) {
          text-decoration: none;
          color: #0d3a64;
          border: 1px solid #c9dcf1;
          border-radius: 999px;
          background: #fff;
          padding: 7px 13px;
          font-weight: 700;
        }

        .banner {
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          background: #eff6ff;
          color: #1e3a8a;
          padding: 9px 11px;
          margin-bottom: 12px;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          font-size: 13px;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          margin-bottom: 14px;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        .panel h2 {
          margin: 0 0 10px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .panel h3 {
          margin: 10px 0 7px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          font-size: 16px;
        }

        form {
          display: grid;
          gap: 8px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .grid.small {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        label {
          display: grid;
          gap: 4px;
          font-size: 13px;
          color: #334155;
        }

        input,
        textarea,
        select {
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          padding: 8px;
          font-size: 13px;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          background: #fff;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        button {
          border: none;
          border-radius: 9px;
          padding: 7px 11px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
        }

        button.secondary {
          background: linear-gradient(135deg, #64748b, #475569);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .stats div {
          border: 1px solid #d8e4f5;
          border-radius: 10px;
          background: #f8fbff;
          padding: 8px;
          display: grid;
          gap: 3px;
        }

        .stats strong {
          color: #334155;
          font-size: 12px;
        }

        .stats span {
          color: #0f172a;
          font-weight: 700;
          font-size: 14px;
        }

        .tableWrap {
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 860px;
          border-collapse: collapse;
          font-size: 13px;
        }

        th,
        td {
          text-align: left;
          border-bottom: 1px solid #e2ecf8;
          padding: 8px;
          vertical-align: top;
        }

        th {
          color: #3e5671;
          background: #f7fbff;
        }

        @media (max-width: 980px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .grid,
          .grid.small,
          .stats {
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
