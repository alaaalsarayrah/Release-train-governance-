import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { deriveEvaluationMetrics, validateEvaluationPayload } from '../lib/evaluation/evidence-metrics'
import { getThesisDemoHydrationState, loadThesisDemoData, resetThesisDemoData } from '../lib/thesis/demo-state'

function nowInputValue() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function initialForm() {
  return {
    scenarioId: 'SCN-THESIS-001',
    scenarioName: 'AI-assisted sprint planning review',
    planningSessionId: '',
    teamId: '',
    teamName: '',
    sprintId: '',
    sprintName: '',
    participantId: '',
    participantRole: 'Product Owner',
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
}

function metricValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '-'
  return `${value}${suffix}`
}

function ratioText(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${value}%`
}

function toIsoLocal(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

export default function EvaluationPage() {
  const [form, setForm] = useState(initialForm)
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState(null)
  const [planningSessions, setPlanningSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [demoBusy, setDemoBusy] = useState('')
  const [hydrationState, setHydrationState] = useState(null)
  const [validationErrors, setValidationErrors] = useState([])
  const [message, setMessage] = useState('')

  const derivedDraft = useMemo(() => deriveEvaluationMetrics(form), [form])

  const acceptanceRate = useMemo(() => {
    if (!summary || summary.recommendationAcceptanceRate === null) return '-'
    return `${summary.recommendationAcceptanceRate}%`
  }, [summary])

  useEffect(() => {
    void loadBootstrap()
  }, [])

  async function loadBootstrap(options = {}) {
    const autoRecover = options.autoRecover !== false

    try {
      const hydration = await getThesisDemoHydrationState({ autoRecover })
      setHydrationState(hydration)

      await Promise.all([loadEntries(), loadPlanningSessions(hydration.sessions, hydration.preferredSession)])

      if (hydration.recovered) {
        setMessage('Thesis demo evidence was recovered automatically and the seeded planning session is ready for evaluation capture.')
      } else if (hydration.recoveryError) {
        setMessage(`Automatic recovery did not complete: ${hydration.recoveryError}`)
      } else if (hydration.needsRecovery) {
        setMessage(hydration.recoveryReason || 'No thesis demo session is ready yet. Load Thesis Demo Data to prefill deterministic evidence.')
      }
    } catch (err) {
      setMessage(`Bootstrap failed: ${String(err?.message || err)}`)
    }
  }

  async function loadEntries() {
    setLoading(true)
    try {
      const res = await fetch('/api/agentic/evaluation?limit=250')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load evaluation data')
      setEntries(json.evaluations || [])
      setSummary(json.summary || null)
    } catch (err) {
      setMessage(`Load failed: ${String(err?.message || err)}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadPlanningSessions(seedSessions = null, preferredSession = null) {
    try {
      let sessions = Array.isArray(seedSessions) ? seedSessions : []

      if (!sessions.length) {
        const res = await fetch('/api/planning/session?limit=50')
        const json = await res.json()
        if (!res.ok) throw new Error(json.message || 'Failed to load planning sessions')
        sessions = Array.isArray(json.sessions) ? json.sessions : []
      }

      setPlanningSessions(sessions)

      if (!sessions.length) {
        setForm((prev) => ({
          ...prev,
          planningSessionId: '',
          teamId: '',
          teamName: '',
          sprintId: '',
          sprintName: ''
        }))
        return
      }

      if (!form.planningSessionId && sessions.length) {
        const preferred = preferredSession || sessions.find((row) => String(row.id || '').startsWith('PLAN-THESIS-DEMO')) || sessions[0]
        if (preferred) {
          applyPlanningSession(preferred.id, sessions)
        }
      }
    } catch (err) {
      setMessage((prev) => prev || `Planning session load failed: ${String(err?.message || err)}`)
    }
  }

  function applyPlanningSession(sessionId, sessionList = planningSessions) {
    const selected = sessionList.find((row) => String(row.id) === String(sessionId))
    setForm((prev) => ({
      ...prev,
      planningSessionId: sessionId,
      teamId: selected?.team_id || '',
      teamName: selected?.team_name || '',
      sprintId: selected?.sprint_id || '',
      sprintName: selected?.sprint_name || ''
    }))
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function runDemoAction(action) {
    if (action === 'reset') {
      const confirmed = window.confirm('Reset demo data to default baseline?')
      if (!confirmed) return
    }

    setDemoBusy(action)
    setMessage('')
    try {
      if (action === 'load') {
        await loadThesisDemoData()
      } else {
        await resetThesisDemoData()
      }

      if (action === 'load') {
        setMessage('Thesis demo evaluation evidence loaded successfully.')
      } else {
        setMessage('Demo data reset to baseline defaults.')
      }

      await loadBootstrap({ autoRecover: false })
    } catch (err) {
      setMessage(`Demo data action failed: ${String(err?.message || err)}`)
    } finally {
      setDemoBusy('')
    }
  }

  async function submit(e) {
    e.preventDefault()

    const validation = validateEvaluationPayload(form)
    setValidationErrors(validation.errors || [])
    if (!validation.valid) {
      setMessage('Please resolve validation errors before saving.')
      return
    }

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
      const preserveContext = {
        planningSessionId: form.planningSessionId,
        teamId: form.teamId,
        teamName: form.teamName,
        sprintId: form.sprintId,
        sprintName: form.sprintName,
        scenarioId: form.scenarioId,
        scenarioName: form.scenarioName,
        participantRole: form.participantRole,
        evaluatorRole: form.evaluatorRole
      }

      setForm({ ...initialForm(), ...preserveContext, evaluatedAt: nowInputValue() })
      await loadEntries()
    } catch (err) {
      setMessage(`Save failed: ${String(err?.message || err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setForm(initialForm())
    setValidationErrors([])
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <p className="eyebrow">Chapter 4 Evidence Capture</p>
          <h1>Thesis Evaluation Evidence Console</h1>
          <p>
            Capture session metadata, planning performance metrics, TAM-style responses, and qualitative feedback
            for thesis evidence with JSON and CSV exports.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/planning-export-center">Export Center</Link>
          <Link href="/conceptual-framework">Conceptual Framework</Link>
          <Link href="/thesis-readiness-checklist">Supervisor Readiness Checklist</Link>
          <Link href="/chapter-alignment-notes">Chapter 4/5 Alignment Notes</Link>
          <a href="/api/agentic/chapter4-evidence?format=json" target="_blank" rel="noreferrer">Export JSON</a>
          <a href="/api/agentic/chapter4-evidence?format=csv" target="_blank" rel="noreferrer">Export CSV</a>
          <Link href="/">Home</Link>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel">
        <h2>Demo Data Controls</h2>
        <p className="muted">Load deterministic thesis records to avoid empty evidence views during supervisor demonstrations.</p>
        <p className="muted">
          Active profile: {hydrationState?.status?.activeProfile?.profile || 'unknown'} | Preferred session: {hydrationState?.preferredSession?.id || 'none'}
        </p>
        <div className="actions">
          <button type="button" onClick={() => void runDemoAction('load')} disabled={Boolean(demoBusy) || loading}>
            {demoBusy === 'load' ? 'Loading...' : 'Load Thesis Demo Data'}
          </button>
          <button type="button" className="secondary" onClick={() => void runDemoAction('reset')} disabled={Boolean(demoBusy) || loading}>
            {demoBusy === 'reset' ? 'Resetting...' : 'Reset Demo Data'}
          </button>
          <button type="button" className="ghost" onClick={() => void loadBootstrap()} disabled={loading || Boolean(demoBusy)}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Record Evaluation Entry</h2>

        <form onSubmit={submit}>
          <h3>1) Session Metadata</h3>
          <div className="grid three">
            <label>
              Planning Session
              <select
                value={form.planningSessionId}
                onChange={(e) => applyPlanningSession(e.target.value)}
              >
                <option value="">Select session</option>
                {planningSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.id} | {session.team_name || '-'} | {session.sprint_name || '-'}
                  </option>
                ))}
              </select>
            </label>
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
            <label>
              Evaluator ID
              <input value={form.evaluatorId} onChange={(e) => updateField('evaluatorId', e.target.value)} placeholder="EVAL-001" required />
            </label>
            <label>
              Evaluator Role
              <input value={form.evaluatorRole} onChange={(e) => updateField('evaluatorRole', e.target.value)} required />
            </label>
            <label>
              Evaluated At
              <input type="datetime-local" value={form.evaluatedAt} onChange={(e) => updateField('evaluatedAt', e.target.value)} />
            </label>
            <label>
              Team Name
              <input value={form.teamName} onChange={(e) => updateField('teamName', e.target.value)} placeholder="Dubai Digital Services Team" />
            </label>
            <label>
              Sprint Name
              <input value={form.sprintName} onChange={(e) => updateField('sprintName', e.target.value)} placeholder="Sprint 5 - Digital Services Wave 2" />
            </label>
          </div>

          <h3>2) Task and Performance Evidence</h3>
          <div className="grid four">
            <label>
              Manual Planning Time (minutes)
              <input type="number" min="0" step="0.1" value={form.baselineManualPlanningMinutes} onChange={(e) => updateField('baselineManualPlanningMinutes', e.target.value)} />
            </label>
            <label>
              AI-Assisted Planning Time (minutes)
              <input type="number" min="0" step="0.1" value={form.aiAssistedPlanningMinutes} onChange={(e) => updateField('aiAssistedPlanningMinutes', e.target.value)} />
            </label>
            <label>
              Task Completion Time (minutes)
              <input type="number" min="0" step="0.1" value={form.taskCompletionMinutes} onChange={(e) => updateField('taskCompletionMinutes', e.target.value)} />
            </label>
            <label>
              Task Success
              <select value={form.taskCompletionSuccess} onChange={(e) => updateField('taskCompletionSuccess', e.target.value)}>
                <option value="1">Success</option>
                <option value="0">Not Successful</option>
              </select>
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
              Dependency Issues Found
              <input type="number" min="0" value={form.dependencyIssuesIdentified} onChange={(e) => updateField('dependencyIssuesIdentified', e.target.value)} />
            </label>
            <label>
              Dependency Issues Validated
              <input type="number" min="0" value={form.dependencyIssuesValidated} onChange={(e) => updateField('dependencyIssuesValidated', e.target.value)} />
            </label>
            <label>
              Risks Found
              <input type="number" min="0" value={form.riskItemsIdentified} onChange={(e) => updateField('riskItemsIdentified', e.target.value)} />
            </label>
            <label>
              Risks Accepted
              <input type="number" min="0" value={form.riskRecommendationsAccepted} onChange={(e) => updateField('riskRecommendationsAccepted', e.target.value)} />
            </label>
            <label>
              Estimation Baseline
              <input type="number" min="0" step="0.1" value={form.estimationBaseline} onChange={(e) => updateField('estimationBaseline', e.target.value)} />
            </label>
            <label>
              AI-Supported Estimate
              <input type="number" min="0" step="0.1" value={form.aiSupportedEstimate} onChange={(e) => updateField('aiSupportedEstimate', e.target.value)} />
            </label>
            <label>
              Clarification Requests
              <input type="number" min="0" value={form.clarificationRequests} onChange={(e) => updateField('clarificationRequests', e.target.value)} />
            </label>
            <label>
              Average System Response (ms)
              <input type="number" min="0" value={form.systemResponseMs} onChange={(e) => updateField('systemResponseMs', e.target.value)} />
            </label>
            <label>
              Error Count
              <input type="number" min="0" value={form.errorCount} onChange={(e) => updateField('errorCount', e.target.value)} />
            </label>
          </div>

          <h3>3) TAM-Style Evidence (1-5)</h3>
          <div className="grid four">
            <label>
              Perceived Usefulness
              <input type="number" min="1" max="5" value={form.perceivedUsefulness} onChange={(e) => updateField('perceivedUsefulness', e.target.value)} />
            </label>
            <label>
              Perceived Ease of Use
              <input type="number" min="1" max="5" value={form.easeOfUse} onChange={(e) => updateField('easeOfUse', e.target.value)} />
            </label>
            <label>
              Trust or Confidence
              <input type="number" min="1" max="5" value={form.trust} onChange={(e) => updateField('trust', e.target.value)} />
            </label>
            <label>
              Intention to Use
              <input type="number" min="1" max="5" value={form.intentionToUse} onChange={(e) => updateField('intentionToUse', e.target.value)} />
            </label>
          </div>

          <h3>4) Qualitative Evidence</h3>
          <div className="grid two">
            <label>
              Evaluator Comments
              <textarea rows={3} value={form.evaluatorComments} onChange={(e) => updateField('evaluatorComments', e.target.value)} />
            </label>
            <label>
              Observations
              <textarea rows={3} value={form.observations} onChange={(e) => updateField('observations', e.target.value)} />
            </label>
            <label>
              Issues and Limitations
              <textarea rows={3} value={form.limitations} onChange={(e) => updateField('limitations', e.target.value)} />
            </label>
            <label>
              Notes
              <textarea rows={3} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
            </label>
          </div>

          <label>
            Interview Notes
            <textarea rows={4} value={form.interviewNotes} onChange={(e) => updateField('interviewNotes', e.target.value)} />
          </label>

          {validationErrors.length ? (
            <div className="errorList">
              <strong>Validation issues</strong>
              <ul>
                {validationErrors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Evaluation Entry'}</button>
            <button type="button" className="secondary" onClick={resetForm}>Reset Form</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Derived Metrics Preview</h2>
        <div className="stats eight">
          <div><strong>Time Reduction (min)</strong><span>{metricValue(derivedDraft.time_reduction_minutes)}</span></div>
          <div><strong>Time Reduction (%)</strong><span>{ratioText(derivedDraft.time_reduction_percent)}</span></div>
          <div><strong>Recommendation Acceptance</strong><span>{ratioText(derivedDraft.recommendation_acceptance_ratio)}</span></div>
          <div><strong>Dependency Validation</strong><span>{ratioText(derivedDraft.dependency_validation_ratio)}</span></div>
          <div><strong>Risk Acceptance</strong><span>{ratioText(derivedDraft.risk_acceptance_ratio)}</span></div>
          <div><strong>Estimation Variance</strong><span>{metricValue(derivedDraft.estimation_variance)}</span></div>
          <div><strong>Estimation Variance (%)</strong><span>{ratioText(derivedDraft.estimation_variance_percent)}</span></div>
          <div><strong>Task Success Flag</strong><span>{metricValue(derivedDraft.task_completion_success)}</span></div>
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Chapter 4 Evidence Snapshot</h2>
          <button type="button" className="ghost" onClick={() => void loadEntries()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="stats nine">
          <div><strong>Total Evaluations</strong><span>{metricValue(summary?.totalEvaluations)}</span></div>
          <div><strong>Task Success Rate</strong><span>{ratioText(summary?.taskCompletionSuccessRate)}</span></div>
          <div><strong>Avg PU</strong><span>{metricValue(summary?.avgPerceivedUsefulness)}</span></div>
          <div><strong>Avg PEOU</strong><span>{metricValue(summary?.avgEaseOfUse)}</span></div>
          <div><strong>Avg Trust</strong><span>{metricValue(summary?.avgTrust)}</span></div>
          <div><strong>Avg Intention</strong><span>{metricValue(summary?.avgIntentionToUse)}</span></div>
          <div><strong>Avg Time Reduction (%)</strong><span>{ratioText(summary?.avgTimeReductionPercent)}</span></div>
          <div><strong>Recommendation Acceptance</strong><span>{acceptanceRate}</span></div>
          <div><strong>Dependency Validation</strong><span>{ratioText(summary?.dependencyValidationRate)}</span></div>
        </div>

        {!entries.length ? (
          <p className="muted empty">
            No evaluation records found. Use Load Thesis Demo Data to prefill deterministic evidence,
            then capture additional supervisor-run entries.
          </p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Scenario</th>
                  <th>Evaluator</th>
                  <th>Role</th>
                  <th>Team or Sprint</th>
                  <th>Manual vs AI (min)</th>
                  <th>Acceptance %</th>
                  <th>Risk Accept %</th>
                  <th>TAM (PU, PEOU, Trust, IU)</th>
                  <th>Task Success</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id}>
                    <td>{toIsoLocal(row.created_at || row.evaluated_at)}</td>
                    <td>{row.scenario_id || '-'}<br />{row.scenario_name || '-'}</td>
                    <td>{row.evaluator_id || row.participant_id || '-'}</td>
                    <td>{row.evaluator_role || row.participant_role || '-'}</td>
                    <td>{row.team_name || '-'}<br />{row.sprint_name || '-'}</td>
                    <td>{metricValue(row.baseline_manual_planning_minutes)} / {metricValue(row.ai_assisted_planning_minutes)}</td>
                    <td>{ratioText(row.recommendation_acceptance_ratio)}</td>
                    <td>{ratioText(row.risk_acceptance_ratio)}</td>
                    <td>
                      {metricValue(row.perceived_usefulness)} / {metricValue(row.ease_of_use)} / {metricValue(row.trust)} / {metricValue(row.intention_to_use)}
                    </td>
                    <td>{String(row.task_completion_success) === '1' ? 'Success' : 'Not successful'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Thesis Evidence Summary Export</h2>
        <p className="muted">
          Use JSON for analysis pipelines and CSV for tabular chapter artifacts.
          Exports include scenario metadata, task metrics, TAM scores, qualitative fields, and derived ratios.
        </p>
        <div className="actions">
          <a href="/api/agentic/chapter4-evidence?format=json" target="_blank" rel="noreferrer">Open Chapter 4 JSON</a>
          <a href="/api/agentic/chapter4-evidence?format=csv" target="_blank" rel="noreferrer">Download Chapter 4 CSV</a>
          <a href="/api/planning/export?type=evaluation-metrics&format=csv" target="_blank" rel="noreferrer">Download Scenario Metrics CSV</a>
        </div>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1300px;
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

        .eyebrow {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #0a5b8a;
          font-weight: 700;
        }

        .hero h1 {
          margin: 8px 0 6px;
          font-size: 34px;
        }

        .hero p {
          margin: 0;
          color: #3d536d;
          max-width: 840px;
        }

        .heroLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: flex-start;
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
          margin: 12px 0 8px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          font-size: 17px;
        }

        form {
          display: grid;
          gap: 8px;
        }

        .grid {
          display: grid;
          gap: 8px;
        }

        .grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .grid.four {
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
          flex-wrap: wrap;
          margin-top: 8px;
        }

        button,
        .actions :global(a) {
          border: none;
          border-radius: 9px;
          padding: 8px 11px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        button.secondary {
          background: linear-gradient(135deg, #64748b, #475569);
        }

        button.ghost {
          background: #dbeafe;
          color: #1e3a8a;
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
          gap: 8px;
          margin-bottom: 10px;
        }

        .stats.eight {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .stats.nine {
          grid-template-columns: repeat(3, minmax(0, 1fr));
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
          min-width: 1100px;
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

        .muted {
          color: #4d647e;
          font-size: 13px;
          margin: 0;
        }

        .empty {
          padding: 6px 2px;
        }

        .errorList {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          border-radius: 10px;
          padding: 8px;
          font-size: 13px;
        }

        .errorList strong {
          display: block;
          margin-bottom: 4px;
        }

        .errorList ul {
          margin: 0;
          padding-left: 18px;
        }

        @media (max-width: 1080px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .grid.two,
          .grid.three,
          .grid.four,
          .stats.eight,
          .stats.nine {
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
