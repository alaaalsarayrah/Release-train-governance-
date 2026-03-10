import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const AGENTS = [
  { key: 'product_owner_assistant', label: 'Product Owner Assistant' },
  { key: 'estimation_advisor', label: 'Estimation Advisor' },
  { key: 'dependency_analyst', label: 'Dependency Analyst' },
  { key: 'architect_advisor', label: 'Architect Advisor' },
  { key: 'risk_analyst', label: 'Risk Analyst' }
]

const DECISIONS = [
  { key: 'accept', label: 'Accept' },
  { key: 'modify', label: 'Modify' },
  { key: 'reject', label: 'Reject' },
  { key: 'request_clarification', label: 'Request Clarification' }
]

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function parseMaybe(value, fallback) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function DependencyGraph({ graph }) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes.slice(0, 8) : []
  const edges = Array.isArray(graph?.edges) ? graph.edges.slice(0, 16) : []

  if (!nodes.length) return <p className="muted">No dependency graph generated.</p>

  const width = 880
  const height = 180
  const positions = nodes.map((node, index) => {
    const x = 70 + index * Math.max(80, Math.floor((width - 140) / Math.max(1, nodes.length - 1)))
    const y = index % 2 === 0 ? 55 : 125
    return { id: node.id, label: node.label || node.id, x, y }
  })

  const byId = new Map(positions.map((p) => [p.id, p]))

  return (
    <div className="graphWrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Dependency graph">
        {edges.map((edge, idx) => {
          const a = byId.get(edge.source)
          const b = byId.get(edge.target)
          if (!a || !b) return null
          const stroke = String(edge.severity || '').toLowerCase().includes('high') ? '#ef4444' : '#1d4ed8'
          return (
            <line
              key={`${edge.source}-${edge.target}-${idx}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth="2"
              markerEnd="url(#arrow)"
              opacity="0.8"
            />
          )
        })}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#334155" />
          </marker>
        </defs>

        {positions.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r="19" fill="#e0f2fe" stroke="#0369a1" strokeWidth="1.5" />
            <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="#0f172a">
              {node.id.slice(0, 8)}
            </text>
            <text x={node.x} y={node.y + 34} textAnchor="middle" fontSize="10" fill="#334155">
              {(node.label || '').slice(0, 16)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default function SprintPlanningWorkspace() {
  const [teams, setTeams] = useState([])
  const [sprints, setSprints] = useState([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedSprint, setSelectedSprint] = useState('')
  const [capacityPoints, setCapacityPoints] = useState(30)
  const [backlogSource, setBacklogSource] = useState('local')
  const [backlogItems, setBacklogItems] = useState([])
  const [selectedBacklogIds, setSelectedBacklogIds] = useState([])
  const [agentSelection, setAgentSelection] = useState(() =>
    AGENTS.reduce((acc, item) => ({ ...acc, [item.key]: true }), {})
  )

  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [session, setSession] = useState(null)
  const [finalEstimateEdits, setFinalEstimateEdits] = useState({})
  const [riskFilter, setRiskFilter] = useState('All')
  const [scenarioRuns, setScenarioRuns] = useState([])
  const [activeRun, setActiveRun] = useState(null)
  const [scenarioMetrics, setScenarioMetrics] = useState({
    recommendationsShown: 0,
    acceptedCount: 0,
    modifiedCount: 0,
    rejectedCount: 0,
    clarificationRequests: 0,
    perceivedUsefulness: 4,
    easeOfUse: 4,
    trust: 4,
    intentionToUse: 4,
    notes: ''
  })

  useEffect(() => {
    void bootstrap()
  }, [])

  async function bootstrap() {
    try {
      const [teamRes, runRes] = await Promise.all([
        fetch('/api/team-setup'),
        fetch('/api/evaluation/scenario-runner')
      ])

      const teamJson = await teamRes.json()
      const runJson = await runRes.json()

      const teamRows = teamJson.teams || []
      const sprintRows = teamJson.sprints || []
      setTeams(teamRows)
      setSprints(sprintRows)
      setSelectedTeam(teamRows[0]?.name || '')
      setSelectedSprint(sprintRows[0]?.name || '')
      setScenarioRuns(runJson.runs || [])

      await loadBacklog('local')
    } catch (err) {
      setMessage(`Failed to initialize workspace: ${String(err?.message || err)}`)
    }
  }

  async function loadBacklog(source = backlogSource) {
    setMessage('')
    setBacklogSource(source)
    try {
      const res = await fetch(`/api/planning/backlog?source=${encodeURIComponent(source)}&top=80`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load backlog')

      const items = Array.isArray(json.items) ? json.items : []
      setBacklogItems(items)
      setSelectedBacklogIds(items.slice(0, 8).map((i) => i.id))
      if (json.warning) setMessage(json.warning)
    } catch (err) {
      setBacklogItems([])
      setSelectedBacklogIds([])
      setMessage(`Backlog load failed: ${String(err?.message || err)}`)
    }
  }

  function toggleBacklogItem(itemId) {
    setSelectedBacklogIds((prev) => (
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    ))
  }

  function toggleAgent(agentKey) {
    setAgentSelection((prev) => ({ ...prev, [agentKey]: !prev[agentKey] }))
  }

  const selectedBacklogItems = useMemo(
    () => backlogItems.filter((item) => selectedBacklogIds.includes(item.id)),
    [backlogItems, selectedBacklogIds]
  )

  const selectedAgents = useMemo(
    () => AGENTS.filter((item) => agentSelection[item.key]).map((item) => item.key),
    [agentSelection]
  )

  const estimationCapacity = useMemo(() => {
    const estimateRows = Array.isArray(session?.estimates) ? session.estimates : []
    const totalAi = estimateRows.reduce((acc, row) => acc + toNumber(row.ai_estimate, 0), 0)
    const totalFinal = estimateRows.reduce((acc, row) => acc + toNumber(row.final_estimate, 0), 0)
    return {
      capacity: Number(capacityPoints || 0),
      totalAi,
      totalFinal,
      aiDelta: Number(capacityPoints || 0) - totalAi,
      finalDelta: Number(capacityPoints || 0) - totalFinal
    }
  }, [session?.estimates, capacityPoints])

  useEffect(() => {
    const next = {}
    for (const row of session?.estimates || []) {
      next[row.id] = row.final_estimate ?? row.ai_estimate ?? ''
    }
    setFinalEstimateEdits(next)
  }, [session?.estimates])

  function buildPlanningContext() {
    return {
      team: teams.find((t) => t.name === selectedTeam) || { name: selectedTeam },
      sprint: sprints.find((s) => s.name === selectedSprint) || { name: selectedSprint },
      capacityPoints: Number(capacityPoints || 0),
      backlogItems: selectedBacklogItems,
      existingOutputs: (session?.outputs || []).map((o) => ({
        agent_key: o.agent_key,
        summary: o.summary,
        confidence: o.confidence,
        artifacts: parseMaybe(o.output_json, {})?.artifacts || {}
      }))
    }
  }

  async function runPlanning() {
    if (!selectedAgents.length) {
      setMessage('Select at least one planning agent.')
      return
    }

    setRunning(true)
    setMessage('')

    try {
      const planningContext = buildPlanningContext()
      const res = await fetch('/api/planning/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${selectedTeam} - ${selectedSprint} Sprint Planning`,
          teamName: selectedTeam,
          sprintName: selectedSprint,
          selectedAgents,
          planningContext,
          runAgents: true
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Planning run failed')
      setSessionId(json.sessionId)
      setSession(json.session)
      setMessage('Planning session created and selected agents executed successfully.')
    } catch (err) {
      setMessage(`Planning run failed: ${String(err?.message || err)}`)
    } finally {
      setRunning(false)
    }
  }

  async function refreshSession(id = sessionId) {
    if (!id) return
    try {
      const res = await fetch(`/api/planning/session?sessionId=${encodeURIComponent(id)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to refresh session')
      setSession(json.session)
    } catch (err) {
      setMessage(`Session refresh failed: ${String(err?.message || err)}`)
    }
  }

  async function rerunAgent(agentKey) {
    if (!sessionId) return
    setRunning(true)
    try {
      const res = await fetch('/api/planning/run-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          agentKey,
          planningContext: buildPlanningContext()
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Agent run failed')
      setSession(json.session)
      setMessage(`${agentKey} re-run completed.`)
    } catch (err) {
      setMessage(`Agent run failed: ${String(err?.message || err)}`)
    } finally {
      setRunning(false)
    }
  }

  async function recordDecision(output, decision) {
    if (!sessionId) return

    let finalOutput = output.output_json
    let rationale = ''

    if (decision === 'modify') {
      const editedSummary = window.prompt('Provide modified summary:', output.summary || '')
      if (editedSummary === null) return
      finalOutput = {
        ...(parseMaybe(output.output_json, {}) || {}),
        summary: editedSummary
      }
      rationale = window.prompt('Optional human rationale for modification:', '') || ''
    }

    if (decision === 'reject' || decision === 'request_clarification') {
      rationale = window.prompt('Optional rationale/comment:', '') || ''
    }

    try {
      const res = await fetch('/api/planning/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          agentOutputId: output.id,
          agentKey: output.agent_key,
          decision,
          finalOutput,
          humanRationale: rationale
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Decision save failed')
      setSession(json.session)
      setMessage(`Decision saved: ${decision}`)
    } catch (err) {
      setMessage(`Decision save failed: ${String(err?.message || err)}`)
    }
  }

  async function finalizeSession() {
    if (!sessionId) return
    try {
      const res = await fetch('/api/planning/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Finalize failed')
      setSession(json.session)
      setMessage('Sprint planning session finalized.')
    } catch (err) {
      setMessage(`Finalize failed: ${String(err?.message || err)}`)
    }
  }

  async function saveEstimateOverrides() {
    if (!sessionId) return
    const rows = Array.isArray(session?.estimates) ? session.estimates : []
    if (!rows.length) {
      setMessage('No estimation rows to save.')
      return
    }

    try {
      const decisions = rows.map((row) => ({
        backlog_item_id: row.backlog_item_id,
        backlog_item_title: row.backlog_item_title,
        ai_estimate: row.ai_estimate,
        final_estimate: Number(finalEstimateEdits[row.id] ?? row.final_estimate ?? row.ai_estimate ?? 0),
        confidence: row.confidence,
        assumptions: row.assumptions || []
      }))

      const res = await fetch('/api/planning/estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, decisions })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to save estimate overrides')
      await refreshSession(sessionId)
      setMessage('Estimation overrides saved.')
    } catch (err) {
      setMessage(`Estimate override save failed: ${String(err?.message || err)}`)
    }
  }

  async function startScenario(scenarioKey) {
    try {
      const res = await fetch('/api/evaluation/scenario-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          scenarioKey,
          participantRole: 'Product Owner'
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to start scenario')
      setActiveRun({ runId: json.runId, scenario: json.scenario, startedAt: new Date().toISOString() })
      setMessage(`Scenario started: ${json.scenario.name}`)
    } catch (err) {
      setMessage(`Scenario start failed: ${String(err?.message || err)}`)
    }
  }

  async function completeScenario() {
    if (!activeRun?.runId) return
    try {
      const res = await fetch('/api/evaluation/scenario-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          runId: activeRun.runId,
          startedAt: activeRun.startedAt,
          ...scenarioMetrics
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to complete scenario')
      setActiveRun(null)

      const refresh = await fetch('/api/evaluation/scenario-runner')
      const refreshJson = await refresh.json()
      setScenarioRuns(refreshJson.runs || [])
      setMessage('Scenario run completed and recorded for Chapter 4 evidence.')
    } catch (err) {
      setMessage(`Scenario completion failed: ${String(err?.message || err)}`)
    }
  }

  const dependencyOutput = (session?.outputs || [])
    .map((o) => ({ ...o, output_json: parseMaybe(o.output_json, {}) }))
    .find((o) => o.agent_key === 'dependency_analyst')

  const filteredRisks = (session?.risks || []).filter((risk) => {
    if (riskFilter === 'All') return true
    return String(risk.severity || '').toLowerCase() === riskFilter.toLowerCase()
  })

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1>Sprint Planning Workspace</h1>
          <p>
            Thesis-aligned multi-agent SAFe planning workspace with orchestrated specialist agents,
            explainability, human override, and evaluation evidence capture.
          </p>
        </div>
        <div className="links">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/agentic-workflow">Workflow Console</Link>
          <Link href="/evaluation">Evaluation</Link>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel twoCol">
        <article>
          <h2>1) Team and Sprint Selector</h2>
          <label>
            Team
            <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
              {teams.map((team) => <option key={team.id || team.name} value={team.name}>{team.name}</option>)}
            </select>
          </label>
          <label>
            Sprint
            <select value={selectedSprint} onChange={(e) => setSelectedSprint(e.target.value)}>
              {sprints.map((sprint) => <option key={sprint.id || sprint.name} value={sprint.name}>{sprint.name}</option>)}
            </select>
          </label>
        </article>

        <article>
          <h2>2) Sprint Capacity Panel</h2>
          <label>
            Capacity (Story Points)
            <input
              type="number"
              min="1"
              value={capacityPoints}
              onChange={(e) => setCapacityPoints(Number(e.target.value || 0))}
            />
          </label>
          <div className="stats">
            <span>AI Total: {estimationCapacity.totalAi}</span>
            <span>Final Total: {estimationCapacity.totalFinal}</span>
            <span>AI Delta: {estimationCapacity.aiDelta}</span>
            <span>Final Delta: {estimationCapacity.finalDelta}</span>
          </div>
        </article>
      </section>

      <section className="panel">
        <h2>3) Backlog Item Loader</h2>
        <div className="inline">
          <button onClick={() => void loadBacklog('local')}>Load Local Backlog</button>
          <button onClick={() => void loadBacklog('ado')}>Load Azure DevOps Backlog</button>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>ID</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Business Value</th>
              </tr>
            </thead>
            <tbody>
              {backlogItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedBacklogIds.includes(item.id)}
                      onChange={() => toggleBacklogItem(item.id)}
                    />
                  </td>
                  <td>{item.id}</td>
                  <td>{item.title}</td>
                  <td>{item.priority || '-'}</td>
                  <td>{item.businessValue ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel twoCol">
        <article>
          <h2>4) Planning Agent Controls</h2>
          <div className="chips">
            {AGENTS.map((agent) => (
              <label key={agent.key} className="chip">
                <input
                  type="checkbox"
                  checked={Boolean(agentSelection[agent.key])}
                  onChange={() => toggleAgent(agent.key)}
                />
                {agent.label}
              </label>
            ))}
          </div>

          <div className="inline">
            <button onClick={() => void runPlanning()} disabled={running}>
              {running ? 'Running...' : 'Run Selected Agents'}
            </button>
            <button onClick={() => void refreshSession()} disabled={!sessionId}>Refresh Session</button>
            <button onClick={() => void finalizeSession()} disabled={!sessionId}>Finalize Sprint Summary</button>
          </div>

          {sessionId ? <p className="muted">Session ID: {sessionId}</p> : null}
        </article>

        <article>
          <h2>5) Export Actions</h2>
          {!sessionId ? <p className="muted">Run a planning session to enable exports.</p> : (
            <div className="exportLinks">
              <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=sprint-summary&format=json`} target="_blank" rel="noreferrer">Sprint Summary (JSON)</a>
              <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=sprint-summary&format=csv`} target="_blank" rel="noreferrer">Sprint Summary (CSV)</a>
              <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=dependencies&format=csv`} target="_blank" rel="noreferrer">Dependency Summary (CSV)</a>
              <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=risks&format=csv`} target="_blank" rel="noreferrer">Risk Register (CSV)</a>
              <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=architecture&format=json`} target="_blank" rel="noreferrer">Architecture Note (JSON)</a>
              <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=estimation&format=csv`} target="_blank" rel="noreferrer">Estimation Comparison (CSV)</a>
              <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=human-decisions&format=csv`} target="_blank" rel="noreferrer">Human Override Logs (CSV)</a>
              <a href="/api/planning/export?type=evaluation-metrics&format=csv" target="_blank" rel="noreferrer">Evaluation Metrics (CSV)</a>
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>6) Agent Output Panels + Human Decisions</h2>
        {!(session?.outputs || []).length ? (
          <p className="muted">No outputs yet. Run selected planning agents.</p>
        ) : (
          <div className="cards">
            {session.outputs.map((output) => {
              const parsed = parseMaybe(output.output_json, {})
              return (
                <article key={output.id} className="card">
                  <div className="cardHead">
                    <strong>{output.agent_key}</strong>
                    <span>Confidence: {toNumber(parsed.confidence, 0).toFixed(2)}</span>
                  </div>
                  <p>{parsed.summary || output.summary}</p>
                  <p><strong>Rationale:</strong> {parsed.rationale || '-'}</p>

                  {Array.isArray(parsed.recommendations) && parsed.recommendations.length ? (
                    <>
                      <h4>Recommendations</h4>
                      <ul>{parsed.recommendations.map((r, i) => <li key={`${output.id}-rec-${i}`}>{r}</li>)}</ul>
                    </>
                  ) : null}

                  {Array.isArray(parsed.risks) && parsed.risks.length ? (
                    <>
                      <h4>Risks</h4>
                      <ul>{parsed.risks.map((r, i) => <li key={`${output.id}-risk-${i}`}>{r}</li>)}</ul>
                    </>
                  ) : null}

                  {Array.isArray(parsed.follow_up_questions) && parsed.follow_up_questions.length ? (
                    <>
                      <h4>Follow-up Questions</h4>
                      <ul>{parsed.follow_up_questions.map((q, i) => <li key={`${output.id}-q-${i}`}>{q}</li>)}</ul>
                    </>
                  ) : null}

                  <div className="inline">
                    <button onClick={() => void rerunAgent(output.agent_key)} disabled={running}>Re-run</button>
                    {DECISIONS.map((d) => (
                      <button key={`${output.id}-${d.key}`} onClick={() => void recordDecision(output, d.key)}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>7) Dependency Table + Graph View</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Target</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Threatens Sprint</th>
                <th>Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {(session?.dependencies || []).map((dep) => (
                <tr key={dep.id}>
                  <td>{dep.source_item}</td>
                  <td>{dep.target_item}</td>
                  <td>{dep.dependency_type}</td>
                  <td>{dep.severity}</td>
                  <td>{dep.threatens_sprint ? 'Yes' : 'No'}</td>
                  <td>{dep.mitigation || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DependencyGraph graph={dependencyOutput?.output_json?.artifacts?.dependency_graph} />
      </section>

      <section className="panel">
        <h2>7.1) Sprint Risk Register</h2>
        <div className="inline">
          <label>
            Severity Filter
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option>All</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Risk ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Probability</th>
                <th>Impact</th>
                <th>Severity</th>
                <th>Mitigation</th>
                <th>Owner</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRisks.map((risk) => (
                <tr key={risk.id}>
                  <td>{risk.risk_id}</td>
                  <td>{risk.title}</td>
                  <td>{risk.category}</td>
                  <td>{risk.probability}</td>
                  <td>{risk.impact}</td>
                  <td>{risk.severity}</td>
                  <td>{risk.mitigation}</td>
                  <td>{risk.owner}</td>
                  <td>{risk.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>8) Final Sprint Summary</h2>
        {session?.final_summary ? (
          <pre>{JSON.stringify(parseMaybe(session.final_summary, session.final_summary), null, 2)}</pre>
        ) : (
          <p className="muted">Finalize session to generate sprint summary.</p>
        )}
      </section>

      <section className="panel">
        <h2>8.1) Estimation Comparison (AI vs Final Human)</h2>
        {!session?.estimates?.length ? (
          <p className="muted">No estimation rows generated yet.</p>
        ) : (
          <>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>AI Estimate</th>
                    <th>Final Human Estimate</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {session.estimates.map((row) => (
                    <tr key={row.id}>
                      <td>{row.backlog_item_title || row.backlog_item_id}</td>
                      <td>{row.ai_estimate ?? '-'}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={finalEstimateEdits[row.id] ?? ''}
                          onChange={(e) => setFinalEstimateEdits((prev) => ({
                            ...prev,
                            [row.id]: e.target.value
                          }))}
                        />
                      </td>
                      <td>{toNumber(row.confidence, 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inline">
              <button onClick={() => void saveEstimateOverrides()}>Save Human Overrides</button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>9) Thesis Evaluation Scenario Runner</h2>
        <p className="muted">
          Run predefined scenarios, record participant actions and TAM scores, and export Chapter 4 metrics.
        </p>

        <div className="inline">
          <button onClick={() => void startScenario('backlog-refinement')}>Start Backlog Refinement Scenario</button>
          <button onClick={() => void startScenario('sprint-preparation')}>Start Sprint Preparation Scenario</button>
          <button onClick={() => void startScenario('dependency-risk-review')}>Start Dependency and Risk Review Scenario</button>
        </div>

        {activeRun ? (
          <div className="scenarioCard">
            <h3>Active Run: {activeRun.scenario?.name}</h3>
            <div className="grid4">
              <label>Recommendations Shown<input type="number" value={scenarioMetrics.recommendationsShown} onChange={(e) => setScenarioMetrics((p) => ({ ...p, recommendationsShown: Number(e.target.value || 0) }))} /></label>
              <label>Accepted<input type="number" value={scenarioMetrics.acceptedCount} onChange={(e) => setScenarioMetrics((p) => ({ ...p, acceptedCount: Number(e.target.value || 0) }))} /></label>
              <label>Modified<input type="number" value={scenarioMetrics.modifiedCount} onChange={(e) => setScenarioMetrics((p) => ({ ...p, modifiedCount: Number(e.target.value || 0) }))} /></label>
              <label>Rejected<input type="number" value={scenarioMetrics.rejectedCount} onChange={(e) => setScenarioMetrics((p) => ({ ...p, rejectedCount: Number(e.target.value || 0) }))} /></label>
              <label>Clarifications<input type="number" value={scenarioMetrics.clarificationRequests} onChange={(e) => setScenarioMetrics((p) => ({ ...p, clarificationRequests: Number(e.target.value || 0) }))} /></label>
              <label>PU (1-5)<input type="number" min="1" max="5" value={scenarioMetrics.perceivedUsefulness} onChange={(e) => setScenarioMetrics((p) => ({ ...p, perceivedUsefulness: Number(e.target.value || 0) }))} /></label>
              <label>EOU (1-5)<input type="number" min="1" max="5" value={scenarioMetrics.easeOfUse} onChange={(e) => setScenarioMetrics((p) => ({ ...p, easeOfUse: Number(e.target.value || 0) }))} /></label>
              <label>Trust (1-5)<input type="number" min="1" max="5" value={scenarioMetrics.trust} onChange={(e) => setScenarioMetrics((p) => ({ ...p, trust: Number(e.target.value || 0) }))} /></label>
              <label>Intention (1-5)<input type="number" min="1" max="5" value={scenarioMetrics.intentionToUse} onChange={(e) => setScenarioMetrics((p) => ({ ...p, intentionToUse: Number(e.target.value || 0) }))} /></label>
            </div>
            <label>
              Notes
              <textarea rows={3} value={scenarioMetrics.notes} onChange={(e) => setScenarioMetrics((p) => ({ ...p, notes: e.target.value }))} />
            </label>
            <div className="inline"><button onClick={() => void completeScenario()}>Complete Scenario Run</button></div>
          </div>
        ) : null}

        <h3>Recent Scenario Runs</h3>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Scenario</th>
                <th>Accepted</th>
                <th>Modified</th>
                <th>Rejected</th>
                <th>PU</th>
                <th>Trust</th>
                <th>Duration(s)</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRuns.slice(0, 12).map((run) => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td>{run.scenario_name}</td>
                  <td>{run.accepted_count}</td>
                  <td>{run.modified_count}</td>
                  <td>{run.rejected_count}</td>
                  <td>{run.perceived_usefulness ?? '-'}</td>
                  <td>{run.trust ?? '-'}</td>
                  <td>{run.duration_seconds ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .shell {
          max-width: 1360px;
          margin: 0 auto;
          padding: 20px;
          color: #0f172a;
          font-family: 'Segoe UI', sans-serif;
        }

        .top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }

        .top h1 {
          margin: 0 0 8px;
          font-size: 34px;
        }

        .top p {
          margin: 0;
          color: #334155;
          max-width: 940px;
        }

        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: flex-start;
        }

        .links :global(a) {
          border: 1px solid #d0deef;
          text-decoration: none;
          border-radius: 999px;
          padding: 7px 12px;
          color: #0f3b63;
          background: #fff;
          font-weight: 600;
          white-space: nowrap;
        }

        .banner {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          border-radius: 10px;
          padding: 9px 12px;
          margin-bottom: 12px;
          color: #1e3a8a;
        }

        .panel {
          border: 1px solid #d8e3f1;
          border-radius: 14px;
          background: #fbfdff;
          padding: 12px;
          margin-bottom: 12px;
        }

        .panel h2 {
          margin: 0 0 8px;
        }

        .panel h3 {
          margin: 0 0 8px;
          font-size: 16px;
        }

        .twoCol {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .inline {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        label {
          display: grid;
          gap: 4px;
          margin-bottom: 8px;
          color: #334155;
          font-size: 13px;
        }

        input,
        select,
        textarea {
          border: 1px solid #c4d5ea;
          border-radius: 9px;
          padding: 8px;
          font-size: 13px;
          background: #fff;
        }

        button {
          border: none;
          border-radius: 9px;
          padding: 8px 11px;
          background: #1d4ed8;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .tableWrap {
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          font-size: 13px;
        }

        th,
        td {
          padding: 7px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          vertical-align: top;
        }

        th {
          color: #334155;
          background: #f8fafc;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          border: 1px solid #d5e2f3;
          border-radius: 999px;
          padding: 6px 10px;
          background: #f8fbff;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .card {
          border: 1px solid #d7e3f2;
          border-radius: 12px;
          padding: 10px;
          background: #fff;
        }

        .cardHead {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }

        ul {
          margin: 0;
          padding-left: 18px;
          color: #334155;
        }

        .muted {
          color: #64748b;
        }

        pre {
          white-space: pre-wrap;
          background: #0b1220;
          color: #dbeafe;
          padding: 10px;
          border-radius: 10px;
          font-size: 12px;
          overflow: auto;
        }

        .exportLinks {
          display: grid;
          gap: 6px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .exportLinks a {
          border: 1px solid #d5e2f3;
          border-radius: 10px;
          padding: 8px;
          text-decoration: none;
          color: #1e3a8a;
          font-weight: 600;
          background: #f8fbff;
          text-align: center;
        }

        .graphWrap {
          overflow: auto;
          border: 1px solid #d5e2f3;
          border-radius: 10px;
          background: #fff;
          margin-top: 10px;
          padding: 6px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin-top: 8px;
        }

        .stats span {
          border: 1px solid #dbe6f4;
          border-radius: 8px;
          padding: 6px;
          background: #fff;
          font-size: 12px;
        }

        .scenarioCard {
          border: 1px solid #dbe6f4;
          background: #fff;
          border-radius: 10px;
          padding: 10px;
          margin-top: 10px;
        }

        .grid4 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        @media (max-width: 980px) {
          .top {
            flex-direction: column;
          }

          .twoCol,
          .cards,
          .exportLinks,
          .grid4 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}
