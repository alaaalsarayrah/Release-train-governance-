import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getThesisDemoHydrationState, loadThesisDemoData, resetThesisDemoData } from '../lib/thesis/demo-state'

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

const AGENT_LABELS = AGENTS.reduce((acc, item) => ({ ...acc, [item.key]: item.label }), {})

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

function toDecisionLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'Pending'
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function trimText(value, limit = 130) {
  const text = String(value || '').trim()
  if (!text) return '-'
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text
}

function summarizeOutputContext(output, parsed, planningBacklog = []) {
  const prioritized = Array.isArray(parsed?.artifacts?.prioritized_items) ? parsed.artifacts.prioritized_items : []
  if (prioritized.length) {
    const ids = prioritized.slice(0, 3).map((item) => item.id).filter(Boolean)
    return ids.length ? `Backlog focus: ${ids.join(', ')}` : 'Backlog focus available'
  }

  const estimates = Array.isArray(parsed?.artifacts?.estimation_table) ? parsed.artifacts.estimation_table : []
  if (estimates.length) {
    const ids = estimates.slice(0, 3).map((item) => item.id).filter(Boolean)
    return ids.length ? `Estimated items: ${ids.join(', ')}` : 'Estimation context available'
  }

  const graphNodes = Array.isArray(parsed?.artifacts?.dependency_graph?.nodes)
    ? parsed.artifacts.dependency_graph.nodes
    : []
  if (graphNodes.length) {
    const ids = graphNodes.slice(0, 3).map((node) => node.id).filter(Boolean)
    return ids.length ? `Dependency chain: ${ids.join(', ')}` : 'Dependency context available'
  }

  const impactedComponents = Array.isArray(parsed?.artifacts?.impacted_components)
    ? parsed.artifacts.impacted_components
    : []
  if (impactedComponents.length) {
    return `Architecture scope: ${impactedComponents.slice(0, 2).join(', ')}`
  }

  if (Array.isArray(parsed?.risks) && parsed.risks.length) {
    return `Risk focus: ${trimText(parsed.risks[0], 90)}`
  }

  if (planningBacklog.length) {
    const ids = planningBacklog.slice(0, 2).map((item) => item?.id).filter(Boolean)
    if (ids.length) return `Backlog context: ${ids.join(', ')}`
  }

  return `${AGENT_LABELS[output.agent_key] || output.agent_key} contribution`
}

function outputSummary(snapshot, fallback = '-') {
  const parsed = parseMaybe(snapshot, null)
  if (!parsed || typeof parsed !== 'object') return fallback
  return parsed.summary || fallback
}

function deriveAuditStatus(log) {
  const action = String(log?.action || '').toLowerCase()

  if (action.includes('decision recorded:')) {
    if (action.includes('request_clarification')) return 'request_clarification'
    if (action.includes('accept')) return 'accept'
    if (action.includes('modify')) return 'modify'
    if (action.includes('reject')) return 'reject'
  }

  if (action.includes('approved')) return 'approved'
  if (action.includes('rejected')) return 'rejected'
  if (action.includes('finalized')) return 'finalized'
  if (action.includes('fail') || action.includes('error')) return 'error'
  return 'info'
}

function summarizeAuditDetails(details, limit = 120) {
  if (!details) return '-'
  if (typeof details === 'string') return trimText(details, limit)
  return trimText(JSON.stringify(details), limit)
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
  const [demoDataBusy, setDemoDataBusy] = useState('')
  const [hydrationState, setHydrationState] = useState(null)
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [session, setSession] = useState(null)
  const [finalEstimateEdits, setFinalEstimateEdits] = useState({})
  const [riskFilter, setRiskFilter] = useState('All')
  const [scenarioRuns, setScenarioRuns] = useState([])
  const [activeRun, setActiveRun] = useState(null)
  const [recommendationStatusFilter, setRecommendationStatusFilter] = useState('All')
  const [recommendationReviewerFilter, setRecommendationReviewerFilter] = useState('All')
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditSessionId, setAuditSessionId] = useState('')
  const [auditStatusFilter, setAuditStatusFilter] = useState('All')
  const [auditReviewerFilter, setAuditReviewerFilter] = useState('All')
  const [auditFromDate, setAuditFromDate] = useState('')
  const [auditToDate, setAuditToDate] = useState('')
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

  function syncWorkspaceFromSession(nextSession, teamRows = teams, sprintRows = sprints) {
    if (!nextSession) return

    const context = parseMaybe(nextSession.planning_context, {}) || {}

    if (nextSession.team_name) setSelectedTeam(nextSession.team_name)
    if (nextSession.sprint_name) setSelectedSprint(nextSession.sprint_name)

    const contextCapacity = Number(context.capacityPoints)
    if (Number.isFinite(contextCapacity) && contextCapacity > 0) {
      setCapacityPoints(contextCapacity)
    }

    const contextBacklog = Array.isArray(context.backlogItems) ? context.backlogItems : []
    if (contextBacklog.length) {
      const selectedIds = contextBacklog
        .map((item) => item?.id)
        .filter(Boolean)

      if (selectedIds.length) {
        setSelectedBacklogIds(selectedIds)
      }
    }

    if (teamRows.length && !teamRows.find((row) => row.name === nextSession.team_name)) {
      setSelectedTeam(teamRows[0]?.name || '')
    }

    if (sprintRows.length && !sprintRows.find((row) => row.name === nextSession.sprint_name)) {
      setSelectedSprint(sprintRows[0]?.name || '')
    }
  }

  async function hydrateLatestSession(options = {}) {
    const autoRecover = options.autoRecover !== false
    const teamRows = options.teamRows || teams
    const sprintRows = options.sprintRows || sprints

    try {
      const hydration = await getThesisDemoHydrationState({ autoRecover })
      const nextTeams = hydration.teamSetup?.teams || teamRows
      const nextSprints = hydration.teamSetup?.sprints || sprintRows

      setHydrationState(hydration)
      setTeams(nextTeams)
      setSprints(nextSprints)
      setSelectedTeam(hydration.preferredSession?.team_name || hydration.activeSprint?.teamName || nextTeams[0]?.name || '')
      setSelectedSprint(hydration.preferredSession?.sprint_name || hydration.activeSprint?.name || nextSprints[0]?.name || '')

      if (!hydration.preferredSession?.id) {
        setSessionId('')
        setSession(null)
        setMessage(hydration.recoveryReason || 'No planning session found. Load thesis demo data to populate the workspace.')
        return false
      }

      await refreshSession(hydration.preferredSession.id, {
        syncContext: true,
        teamRows: nextTeams,
        sprintRows: nextSprints
      })

      if (hydration.recovered) {
        setMessage('Thesis demo data was recovered automatically and the workspace was rehydrated.')
      } else if (hydration.recoveryError) {
        setMessage(`Automatic recovery did not complete: ${hydration.recoveryError}`)
      }

      return true
    } catch (err) {
      setMessage(`Failed to hydrate latest session: ${String(err?.message || err)}`)
      return false
    }
  }

  async function bootstrap(options = {}) {
    const autoRecover = options.autoRecover !== false

    try {
      const runRes = await fetch('/api/evaluation/scenario-runner')
      const runJson = await runRes.json()
      setScenarioRuns(runJson.runs || [])

      await loadBacklog('local')
      await hydrateLatestSession({ autoRecover })
    } catch (err) {
      setMessage(`Failed to initialize workspace: ${String(err?.message || err)}`)
    }
  }

  async function runDemoDataAction(action) {
    if (action === 'reset') {
      const confirmed = window.confirm('Reset demo data to default baseline? This removes planning and evaluation demo records.')
      if (!confirmed) return
    }

    setDemoDataBusy(action)
    setMessage('')
    try {
      if (action === 'load') {
        await loadThesisDemoData()
      } else {
        await resetThesisDemoData()
      }

      await bootstrap({ autoRecover: false })
      setMessage(
        action === 'load'
          ? 'Thesis demo data loaded. Workspace hydrated with the latest seeded planning session.'
          : 'Demo data reset to baseline defaults.'
      )
    } catch (err) {
      setMessage(`Demo data action failed: ${String(err?.message || err)}`)
    } finally {
      setDemoDataBusy('')
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

  const planningContextBacklog = useMemo(() => {
    const context = parseMaybe(session?.planning_context, {})
    return Array.isArray(context?.backlogItems) ? context.backlogItems : []
  }, [session?.planning_context])

  const parsedOutputs = useMemo(() => {
    return (session?.outputs || []).map((output) => ({
      ...output,
      parsed: parseMaybe(output.output_json, {})
    }))
  }, [session?.outputs])

  const outputByKey = useMemo(() => {
    return parsedOutputs.reduce((acc, output) => {
      acc[output.agent_key] = output
      return acc
    }, {})
  }, [parsedOutputs])

  const latestDecisionByOutput = useMemo(() => {
    const byOutputId = {}
    const byAgentKey = {}

    for (const decision of session?.decisions || []) {
      const decisionTime = new Date(decision?.created_at || 0).getTime() || 0
      const decisionId = Number(decision?.id || 0)

      if (decision?.agent_output_id) {
        const key = String(decision.agent_output_id)
        const existing = byOutputId[key]
        const existingTime = new Date(existing?.created_at || 0).getTime() || 0
        const existingId = Number(existing?.id || 0)
        if (!existing || decisionTime > existingTime || (decisionTime === existingTime && decisionId > existingId)) {
          byOutputId[key] = decision
        }
      }

      if (decision?.agent_key) {
        const key = String(decision.agent_key)
        const existing = byAgentKey[key]
        const existingTime = new Date(existing?.created_at || 0).getTime() || 0
        const existingId = Number(existing?.id || 0)
        if (!existing || decisionTime > existingTime || (decisionTime === existingTime && decisionId > existingId)) {
          byAgentKey[key] = decision
        }
      }
    }

    return { byOutputId, byAgentKey }
  }, [session?.decisions])

  const recommendationRows = useMemo(() => {
    const rows = []

    for (const output of parsedOutputs) {
      const parsed = output.parsed || {}
      const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : []
      const decision = latestDecisionByOutput.byOutputId[String(output.id)] || latestDecisionByOutput.byAgentKey[output.agent_key] || null

      recommendations.forEach((recommendation, index) => {
        rows.push({
          id: `${output.id}-rec-${index}`,
          recommendation,
          agentKey: output.agent_key,
          agentLabel: AGENT_LABELS[output.agent_key] || output.agent_key,
          rationale: parsed.rationale || output.summary || '-',
          context: summarizeOutputContext(output, parsed, planningContextBacklog),
          status: decision?.decision || '',
          humanRationale: decision?.human_rationale || '',
          actor: decision?.actor || '',
          createdAt: decision?.created_at || ''
        })
      })
    }

    return rows
  }, [parsedOutputs, latestDecisionByOutput, planningContextBacklog])

  const decisionSummary = useMemo(() => {
    const counts = { pending: 0, accept: 0, modify: 0, reject: 0, request_clarification: 0 }

    for (const output of parsedOutputs) {
      const decision = latestDecisionByOutput.byOutputId[String(output.id)] || latestDecisionByOutput.byAgentKey[output.agent_key] || null
      const key = String(decision?.decision || '').toLowerCase()
      if (!key) {
        counts.pending += 1
      } else if (Object.prototype.hasOwnProperty.call(counts, key)) {
        counts[key] += 1
      } else {
        counts.pending += 1
      }
    }

    return counts
  }, [parsedOutputs, latestDecisionByOutput])

  const specialistContributions = useMemo(() => {
    const productOutput = outputByKey.product_owner_assistant
    const estimateOutput = outputByKey.estimation_advisor
    const dependencyOutput = outputByKey.dependency_analyst
    const architectureOutput = outputByKey.architect_advisor
    const riskOutput = outputByKey.risk_analyst
    const architectureNotes = Array.isArray(session?.architectureNotes) ? session.architectureNotes : []

    const dependencyHigh = (session?.dependencies || []).filter((item) => String(item.severity || '').toLowerCase() === 'high').length
    const riskHigh = (session?.risks || []).filter((item) => String(item.severity || '').toLowerCase() === 'high').length
    const sprintGoal = trimText(productOutput?.parsed?.summary || productOutput?.summary || session?.title || '-', 140)

    return [
      {
        area: 'Backlog Quality',
        source: AGENT_LABELS.product_owner_assistant,
        evidence: trimText(productOutput?.parsed?.summary || productOutput?.summary || 'No backlog quality analysis yet.'),
        detail: `${Array.isArray(productOutput?.parsed?.recommendations) ? productOutput.parsed.recommendations.length : 0} recommendations`
      },
      {
        area: 'Estimates',
        source: AGENT_LABELS.estimation_advisor,
        evidence: trimText(estimateOutput?.parsed?.summary || estimateOutput?.summary || 'No estimation analysis yet.'),
        detail: `AI ${estimationCapacity.totalAi} / Final ${estimationCapacity.totalFinal} points`
      },
      {
        area: 'Dependencies',
        source: AGENT_LABELS.dependency_analyst,
        evidence: trimText(dependencyOutput?.parsed?.summary || dependencyOutput?.summary || 'No dependency analysis yet.'),
        detail: `${session?.dependencies?.length || 0} dependencies, ${dependencyHigh} high severity`
      },
      {
        area: 'Risks',
        source: AGENT_LABELS.risk_analyst,
        evidence: trimText(riskOutput?.parsed?.summary || riskOutput?.summary || 'No risk analysis yet.'),
        detail: `${session?.risks?.length || 0} risks, ${riskHigh} high severity`
      },
      {
        area: 'Architecture and Solution Guidance',
        source: AGENT_LABELS.architect_advisor,
        evidence: trimText(architectureOutput?.parsed?.summary || architectureOutput?.summary || 'No architecture guidance yet.'),
        detail: architectureNotes.length
          ? `${architectureNotes.length} architecture note records`
          : `Sprint intent: ${sprintGoal}`
      }
    ]
  }, [outputByKey, session?.architectureNotes, session?.dependencies, session?.risks, session?.title, estimationCapacity])

  const decisionLedgerRows = useMemo(() => {
    return (session?.decisions || [])
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a?.created_at || 0).getTime() || 0
        const bTime = new Date(b?.created_at || 0).getTime() || 0
        return bTime - aTime
      })
  }, [session?.decisions])

  const recommendationReviewerOptions = useMemo(() => {
    return Array.from(new Set(recommendationRows.map((row) => String(row.actor || '').trim()).filter(Boolean))).sort()
  }, [recommendationRows])

  const filteredRecommendationRows = useMemo(() => {
    return recommendationRows.filter((row) => {
      const status = String(row.status || 'pending').toLowerCase()
      const actor = String(row.actor || '').trim()

      if (recommendationStatusFilter !== 'All' && status !== recommendationStatusFilter) return false
      if (recommendationReviewerFilter !== 'All' && actor !== recommendationReviewerFilter) return false
      return true
    })
  }, [recommendationRows, recommendationStatusFilter, recommendationReviewerFilter])

  const reviewLoopOverview = useMemo(() => {
    const reruns = auditLogs.filter((log) => String(log.action || '').toLowerCase().includes('re-run')).length
    return {
      generated: parsedOutputs.length,
      decided: Math.max(0, parsedOutputs.length - decisionSummary.pending),
      pending: decisionSummary.pending,
      clarifications: decisionSummary.request_clarification,
      reruns,
      finalizedBy: session?.finalized_by || '-',
      finalizedAt: session?.finalized_at ? new Date(session.finalized_at).toLocaleString() : '-'
    }
  }, [auditLogs, parsedOutputs.length, decisionSummary, session?.finalized_by, session?.finalized_at])

  const auditReviewerOptions = useMemo(() => {
    return Array.from(new Set(auditLogs.map((row) => String(row.actor || '').trim()).filter(Boolean))).sort()
  }, [auditLogs])

  const auditStatusOptions = useMemo(() => {
    return Array.from(new Set(auditLogs.map((row) => deriveAuditStatus(row)))).sort()
  }, [auditLogs])

  const filteredAuditLogs = useMemo(() => {
    const fromMs = auditFromDate ? new Date(`${auditFromDate}T00:00:00`).getTime() : null
    const toMs = auditToDate ? new Date(`${auditToDate}T23:59:59`).getTime() : null

    return auditLogs.filter((row) => {
      if (auditSessionId && String(row.br_id || '').trim() !== String(auditSessionId).trim()) return false

      const status = deriveAuditStatus(row)
      if (auditStatusFilter !== 'All' && status !== auditStatusFilter) return false

      const actor = String(row.actor || '').trim()
      if (auditReviewerFilter !== 'All' && actor !== auditReviewerFilter) return false

      if (fromMs || toMs) {
        const rowMs = new Date(row.created_at || 0).getTime()
        if (Number.isFinite(fromMs) && rowMs < fromMs) return false
        if (Number.isFinite(toMs) && rowMs > toMs) return false
      }

      return true
    })
  }, [auditLogs, auditSessionId, auditStatusFilter, auditReviewerFilter, auditFromDate, auditToDate])

  const auditCsvHref = useMemo(() => {
    const params = new URLSearchParams({ format: 'csv' })
    if (auditSessionId) params.set('brId', auditSessionId)
    if (auditReviewerFilter !== 'All') params.set('actor', auditReviewerFilter)
    if (auditFromDate) params.set('from', auditFromDate)
    if (auditToDate) params.set('to', auditToDate)
    return `/api/agentic/audit-logs?${params.toString()}`
  }, [auditSessionId, auditReviewerFilter, auditFromDate, auditToDate])

  useEffect(() => {
    const next = {}
    for (const row of session?.estimates || []) {
      next[row.id] = row.final_estimate ?? row.ai_estimate ?? ''
    }
    setFinalEstimateEdits(next)
  }, [session?.estimates])

  useEffect(() => {
    if (!sessionId) {
      setAuditSessionId('')
      setAuditLogs([])
      return
    }

    setAuditSessionId(sessionId)
    setAuditStatusFilter('All')
    setAuditReviewerFilter('All')
    setAuditFromDate('')
    setAuditToDate('')
    void loadAuditTimeline(sessionId, { reviewer: 'All', from: '', to: '' })
  }, [sessionId])

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
      syncWorkspaceFromSession(json.session)
      setMessage('Planning session created and selected agents executed successfully.')
    } catch (err) {
      setMessage(`Planning run failed: ${String(err?.message || err)}`)
    } finally {
      setRunning(false)
    }
  }

  async function refreshSession(id = sessionId, options = {}) {
    if (!id) {
      setSessionId('')
      setSession(null)
      setAuditSessionId('')
      setAuditLogs([])
      return
    }

    try {
      const res = await fetch(`/api/planning/session?sessionId=${encodeURIComponent(id)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to refresh session')
      setSessionId(id)
      setSession(json.session)
      if (options.syncContext !== false) {
        syncWorkspaceFromSession(json.session, options.teamRows || teams, options.sprintRows || sprints)
      }
    } catch (err) {
      setSessionId('')
      setSession(null)
      setAuditSessionId('')
      setAuditLogs([])
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
      await loadAuditTimeline(sessionId)
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
      await loadAuditTimeline(sessionId)
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
      await loadAuditTimeline(sessionId)
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
      await loadAuditTimeline(sessionId)
      setMessage('Estimation overrides saved.')
    } catch (err) {
      setMessage(`Estimate override save failed: ${String(err?.message || err)}`)
    }
  }

  async function loadAuditTimeline(targetSessionId = auditSessionId, overrides = {}) {
    const nextSessionId = String(targetSessionId || '').trim()
    if (!nextSessionId) {
      setAuditSessionId('')
      setAuditLogs([])
      return
    }

    const reviewer = overrides.reviewer ?? auditReviewerFilter
    const from = overrides.from ?? auditFromDate
    const to = overrides.to ?? auditToDate

    setAuditLoading(true)
    setAuditSessionId(nextSessionId)
    try {
      const params = new URLSearchParams({
        brId: nextSessionId,
        limit: '300'
      })

      if (reviewer && reviewer !== 'All') params.set('actor', reviewer)
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await fetch(`/api/agentic/audit-logs?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load audit timeline')

      setAuditLogs(Array.isArray(json.logs) ? json.logs : [])
    } catch (err) {
      setAuditLogs([])
      setMessage(`Audit timeline load failed: ${String(err?.message || err)}`)
    } finally {
      setAuditLoading(false)
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

  const productOutput = outputByKey.product_owner_assistant || null
  const dependencyOutput = outputByKey.dependency_analyst || null
  const architectureOutput = outputByKey.architect_advisor || null
  const architectureNotes = Array.isArray(session?.architectureNotes) ? session.architectureNotes : []
  const sprintGoalSummary = trimText(productOutput?.parsed?.summary || productOutput?.summary || session?.title || '-', 160)
  const dependencyHighCount = (session?.dependencies || []).filter((item) => String(item.severity || '').toLowerCase() === 'high').length
  const riskHighCount = (session?.risks || []).filter((item) => String(item.severity || '').toLowerCase() === 'high').length

  const filteredRisks = (session?.risks || []).filter((risk) => {
    if (riskFilter === 'All') return true
    return String(risk.severity || '').toLowerCase() === riskFilter.toLowerCase()
  })

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1>SAFe Sprint Planning Workspace (Thesis Prototype)</h1>
          <p>
            Primary thesis workspace for AI specialist planning support with capacity awareness,
            dependency and risk visibility, architecture guidance, and human governance decisions.
          </p>
        </div>
        <div className="links">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/conceptual-framework">Conceptual Framework</Link>
          <Link href="/evaluation">Evaluation Evidence</Link>
          <Link href="/thesis-readiness-checklist">Supervisor Readiness Checklist</Link>
          <Link href="/chapter-alignment-notes">Chapter 4/5 Alignment Notes</Link>
          <Link href="/planning-export-center">Export Center</Link>
          <Link href="/agentic-workflow">Supporting Workflow</Link>
          <Link href="/dashboard">Supporting Dashboard</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel">
        <h2>Demo Data Shortcuts</h2>
        <p className="muted">
          Keep this workspace presentation-ready by loading deterministic thesis data, or reset to the default baseline when needed.
        </p>
        <p className="muted">
          Active profile: {hydrationState?.status?.activeProfile?.profile || 'unknown'} | Preferred session: {hydrationState?.preferredSession?.id || 'none'}
        </p>
        <div className="inline">
          <button onClick={() => void runDemoDataAction('load')} disabled={Boolean(demoDataBusy)}>
            {demoDataBusy === 'load' ? 'Loading...' : 'Load Thesis Demo Data'}
          </button>
          <button className="secondary" onClick={() => void runDemoDataAction('reset')} disabled={Boolean(demoDataBusy)}>
            {demoDataBusy === 'reset' ? 'Resetting...' : 'Reset Demo Data'}
          </button>
          <button className="ghost" onClick={() => void hydrateLatestSession({ autoRecover: true })} disabled={Boolean(demoDataBusy)}>
            Refresh Latest Session
          </button>
        </div>
      </section>

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

          {sessionId ? <p className="muted">Session ID: {sessionId}</p> : (
            <p className="muted">No session loaded yet. Load thesis demo data or run selected agents to populate outputs and exports.</p>
          )}
        </article>

        <article>
          <h2>5) Export Intelligence Hub</h2>
          {!sessionId ? <p className="muted">Run a planning session to unlock export insights and packaged artifacts.</p> : (
            <>
              <div className="exportDeck">
                <article>
                  <strong>Executive Pack</strong>
                  <p>Sprint summary, risks, and dependency highlights for steering review.</p>
                  <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=sprint-summary&format=json`} target="_blank" rel="noreferrer">Open JSON Summary</a>
                </article>
                <article>
                  <strong>Delivery Controls</strong>
                  <p>CSV package for dependencies, risks, and estimation deltas.</p>
                  <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=dependencies&format=csv`} target="_blank" rel="noreferrer">Download Delivery CSV</a>
                </article>
                <article>
                  <strong>Governance Trace</strong>
                  <p>Human decision overrides and evaluation metrics for thesis evidence.</p>
                  <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=human-decisions&format=csv`} target="_blank" rel="noreferrer">Download Governance CSV</a>
                </article>
              </div>
              <div className="inline">
                <Link href={`/planning-export-center?sessionId=${encodeURIComponent(sessionId)}`}>
                  Open Export Center Dashboard
                </Link>
                <a href={`/api/planning/export?sessionId=${encodeURIComponent(sessionId)}&type=sprint-summary&format=csv`} target="_blank" rel="noreferrer">Sprint Summary CSV</a>
                <a href="/api/planning/export?type=evaluation-metrics&format=csv" target="_blank" rel="noreferrer">Evaluation Metrics CSV</a>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>5.1) Explainability Snapshot</h2>
        {!session ? (
          <p className="muted">Run or load a session to surface AI contribution and human governance evidence.</p>
        ) : (
          <>
            <div className="snapshotGrid">
              <article>
                <h3>Capacity Summary</h3>
                <p>Capacity: {estimationCapacity.capacity} points</p>
                <p>AI commitment: {estimationCapacity.totalAi} points</p>
                <p>Final human commitment: {estimationCapacity.totalFinal} points</p>
              </article>
              <article>
                <h3>Sprint Goal Summary</h3>
                <p>{sprintGoalSummary}</p>
              </article>
              <article>
                <h3>Estimate Comparison</h3>
                <p>Rows compared: {session?.estimates?.length || 0}</p>
                <p>AI delta: {estimationCapacity.aiDelta}</p>
                <p>Final delta: {estimationCapacity.finalDelta}</p>
              </article>
              <article>
                <h3>Dependency Findings</h3>
                <p>Total dependencies: {session?.dependencies?.length || 0}</p>
                <p>High severity dependencies: {dependencyHighCount}</p>
                <p>Graph nodes: {dependencyOutput?.parsed?.artifacts?.dependency_graph?.nodes?.length || 0}</p>
              </article>
              <article>
                <h3>Risk Findings</h3>
                <p>Total risks: {session?.risks?.length || 0}</p>
                <p>High severity risks: {riskHighCount}</p>
                <p>Visible in current filter: {filteredRisks.length}</p>
              </article>
              <article>
                <h3>Architecture Guidance</h3>
                <p>Architecture notes: {architectureNotes.length}</p>
                <p>{trimText(architectureOutput?.parsed?.summary || architectureOutput?.summary || 'No architecture summary available.', 120)}</p>
              </article>
              <article>
                <h3>AI Contribution Coverage</h3>
                <p>Agent outputs: {parsedOutputs.length}</p>
                <p>Major recommendations: {recommendationRows.length}</p>
              </article>
              <article>
                <h3>Human Decision Coverage</h3>
                <p>Pending outputs: {decisionSummary.pending}</p>
                <p>Accepted: {decisionSummary.accept}</p>
                <p>Modified: {decisionSummary.modify}</p>
                <p>Rejected: {decisionSummary.reject}</p>
              </article>
            </div>

            <h3>Specialist Contribution Map</h3>
            <div className="contribGrid">
              {specialistContributions.map((item) => (
                <article key={item.area} className="contribCard">
                  <div className="cardHead">
                    <strong>{item.area}</strong>
                    <span>{item.source}</span>
                  </div>
                  <p>{item.evidence}</p>
                  <p className="muted">{item.detail}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>5.2) Major Recommendations and Decision Status</h2>
        <p className="muted">Review recommendations with explicit status, reviewer, decision timestamp, and rationale traceability.</p>
        <div className="inline governanceFilters">
          <label>
            Status
            <select value={recommendationStatusFilter} onChange={(e) => setRecommendationStatusFilter(e.target.value)}>
              <option value="All">All</option>
              <option value="pending">Pending</option>
              <option value="accept">Accept</option>
              <option value="modify">Modify</option>
              <option value="reject">Reject</option>
              <option value="request_clarification">Request Clarification</option>
            </select>
          </label>
          <label>
            Reviewer
            <select value={recommendationReviewerFilter} onChange={(e) => setRecommendationReviewerFilter(e.target.value)}>
              <option value="All">All</option>
              {recommendationReviewerOptions.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
            </select>
          </label>
        </div>

        {!recommendationRows.length ? (
          <p className="muted">No recommendations available yet. Run selected agents to generate recommendation evidence.</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Recommendation</th>
                  <th>Agent Source</th>
                  <th>Rationale</th>
                  <th>Related Backlog or Context</th>
                  <th>Status</th>
                  <th>Reviewer</th>
                  <th>Decision Timestamp</th>
                  <th>Human Rationale</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecommendationRows.map((row) => {
                  const statusClass = row.status ? `status-${String(row.status).toLowerCase()}` : 'status-pending'
                  return (
                    <tr key={row.id}>
                      <td>{row.recommendation}</td>
                      <td>{row.agentLabel}</td>
                      <td>{trimText(row.rationale, 140)}</td>
                      <td>{trimText(row.context, 120)}</td>
                      <td>
                        <span className={`statusTag ${statusClass}`}>{toDecisionLabel(row.status)}</span>
                      </td>
                      <td>{row.actor || '-'}</td>
                      <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}</td>
                      <td>{row.humanRationale ? trimText(row.humanRationale, 110) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {recommendationRows.length && !filteredRecommendationRows.length ? (
          <p className="muted">No recommendation records match the current governance filters.</p>
        ) : null}
      </section>

      <section className="panel">
        <h2>5.3) Human Decision Ledger</h2>
        {!decisionLedgerRows.length ? (
          <p className="muted">No human decisions captured yet. Use the decision actions in agent output cards.</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Agent</th>
                  <th>Decision</th>
                  <th>Actor</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {decisionLedgerRows.slice(0, 20).map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                    <td>{AGENT_LABELS[item.agent_key] || item.agent_key || '-'}</td>
                    <td>
                      <span className={`statusTag status-${String(item.decision || 'pending').toLowerCase()}`}>
                        {toDecisionLabel(item.decision)}
                      </span>
                    </td>
                    <td>{item.actor || '-'}</td>
                    <td>{trimText(outputSummary(item.original_output_json), 90)}</td>
                    <td>{trimText(outputSummary(item.final_output_json), 90)}</td>
                    <td>{trimText(item.human_rationale || '-', 90)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="governance-review" className="panel">
        <h2>5.4) Governance and Review Loop with Audit Timeline</h2>
        <p className="muted">
          Formal oversight view showing review-loop progression, accountable actors, and timestamped audit evidence for thesis reporting.
        </p>

        <div className="governanceLoopGrid">
          <article className="governanceCard">
            <h3>Review Loop Progress</h3>
            <p>Generated recommendations: {reviewLoopOverview.generated}</p>
            <p>Decisions completed: {reviewLoopOverview.decided}</p>
            <p>Pending review: {reviewLoopOverview.pending}</p>
            <p>Clarification loops: {reviewLoopOverview.clarifications}</p>
          </article>
          <article className="governanceCard">
            <h3>Governance Activity</h3>
            <p>Audit events loaded: {auditLogs.length}</p>
            <p>Agent re-runs: {reviewLoopOverview.reruns}</p>
            <p>Finalized by: {reviewLoopOverview.finalizedBy}</p>
            <p>Finalized at: {reviewLoopOverview.finalizedAt}</p>
          </article>
        </div>

        <div className="inline governanceFilters">
          <label>
            Session ID
            <input
              value={auditSessionId}
              onChange={(e) => setAuditSessionId(e.target.value)}
              placeholder="PLAN-..."
            />
          </label>
          <label>
            Status
            <select value={auditStatusFilter} onChange={(e) => setAuditStatusFilter(e.target.value)}>
              <option value="All">All</option>
              {auditStatusOptions.map((status) => (
                <option key={status} value={status}>{toDecisionLabel(status)}</option>
              ))}
            </select>
          </label>
          <label>
            Reviewer
            <select value={auditReviewerFilter} onChange={(e) => setAuditReviewerFilter(e.target.value)}>
              <option value="All">All</option>
              {auditReviewerOptions.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
            </select>
          </label>
          <label>
            From Date
            <input type="date" value={auditFromDate} onChange={(e) => setAuditFromDate(e.target.value)} />
          </label>
          <label>
            To Date
            <input type="date" value={auditToDate} onChange={(e) => setAuditToDate(e.target.value)} />
          </label>
        </div>

        <div className="inline">
          <button onClick={() => void loadAuditTimeline(auditSessionId)}>Load Audit Timeline</button>
          <button
            className="ghost"
            onClick={() => {
              setAuditStatusFilter('All')
              setAuditReviewerFilter('All')
              setAuditFromDate('')
              setAuditToDate('')
              void loadAuditTimeline(auditSessionId, { reviewer: 'All', from: '', to: '' })
            }}
          >
            Reset Filters
          </button>
          <a href={auditCsvHref} target="_blank" rel="noreferrer">Export Audit CSV</a>
        </div>

        {auditLoading ? <p className="muted">Loading audit timeline...</p> : null}
        {!auditLoading && !filteredAuditLogs.length ? (
          <p className="muted">No audit entries match the current governance filters.</p>
        ) : null}

        {filteredAuditLogs.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Reviewer or Actor</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.slice(0, 120).map((row) => {
                  const status = deriveAuditStatus(row)
                  return (
                    <tr key={row.id}>
                      <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
                      <td>{row.stage || '-'}</td>
                      <td><span className={`statusTag status-${status}`}>{toDecisionLabel(status)}</span></td>
                      <td>{row.actor || '-'}</td>
                      <td>{row.action || '-'}</td>
                      <td>{summarizeAuditDetails(row.details)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>6) Agent Output Panels + Human Decisions</h2>
        {!parsedOutputs.length ? (
          <p className="muted">No outputs yet. Run selected planning agents.</p>
        ) : (
          <div className="cards">
            {parsedOutputs.map((output) => {
              const parsed = output.parsed || {}
              const decision = latestDecisionByOutput.byOutputId[String(output.id)] || latestDecisionByOutput.byAgentKey[output.agent_key] || null
              const decisionKey = String(decision?.decision || '').toLowerCase()
              const decisionClass = decisionKey ? `status-${decisionKey}` : 'status-pending'
              const contextText = summarizeOutputContext(output, parsed, planningContextBacklog)

              return (
                <article key={output.id} className="card">
                  <div className="cardHead">
                    <strong>{AGENT_LABELS[output.agent_key] || output.agent_key}</strong>
                    <span className={`statusTag ${decisionClass}`}>{toDecisionLabel(decisionKey)}</span>
                  </div>
                  <p className="muted">Source Key: {output.agent_key}</p>
                  <p>Confidence: {toNumber(parsed.confidence, 0).toFixed(2)}</p>
                  <p>{parsed.summary || output.summary}</p>
                  <p><strong>Rationale:</strong> {parsed.rationale || '-'}</p>
                  <p><strong>Related Context:</strong> {contextText}</p>

                  <p className="muted">
                    <strong>Latest Human Decision:</strong>{' '}
                    {decision
                      ? `${toDecisionLabel(decision.decision)} by ${decision.actor || 'Workflow Operator'}`
                      : 'Pending reviewer action'}
                  </p>

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
                      <button
                        key={`${output.id}-${d.key}`}
                        className={decisionKey === d.key ? 'activeDecisionButton' : ''}
                        onClick={() => void recordDecision(output, d.key)}
                      >
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

      <section id="dependency-risk-architecture" className="panel">
        <h2>7) Dependency Table + Graph View</h2>
        {!(session?.dependencies || []).length ? (
          <p className="muted">No dependencies available yet. Run or load a planning session to populate the dependency register.</p>
        ) : null}
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

        <DependencyGraph graph={dependencyOutput?.parsed?.artifacts?.dependency_graph} />
      </section>

      <section className="panel">
        <h2>7.1) Sprint Risk Register</h2>
        {!filteredRisks.length ? (
          <p className="muted">No risks captured yet. Run risk analysis or load thesis demo data to populate this register.</p>
        ) : null}
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
        <h2>7.2) Architecture and Solution Guidance</h2>
        {architectureNotes.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Impacted Components</th>
                  <th>Constraints</th>
                  <th>Recommended Actions</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {architectureNotes.map((note) => (
                  <tr key={note.id}>
                    <td>{Array.isArray(note.impacted_components) && note.impacted_components.length ? note.impacted_components.join(', ') : '-'}</td>
                    <td>{Array.isArray(note.constraints) && note.constraints.length ? note.constraints.join(', ') : '-'}</td>
                    <td>{Array.isArray(note.recommended_actions) && note.recommended_actions.length ? note.recommended_actions.join(', ') : '-'}</td>
                    <td>{trimText(note.rationale || '-', 140)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <p className="muted">No structured architecture notes yet. Showing current architect advisor guidance.</p>
            <p><strong>Summary:</strong> {architectureOutput?.parsed?.summary || architectureOutput?.summary || '-'}</p>
            <p><strong>Rationale:</strong> {architectureOutput?.parsed?.rationale || '-'}</p>
            {Array.isArray(architectureOutput?.parsed?.recommendations) && architectureOutput.parsed.recommendations.length ? (
              <>
                <h3>Recommended Actions</h3>
                <ul>
                  {architectureOutput.parsed.recommendations.map((item, index) => (
                    <li key={`arch-rec-${index}`}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
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
        {!scenarioRuns.length ? (
          <p className="muted">No scenario runs recorded yet. Use the scenario buttons above or load thesis demo data.</p>
        ) : null}
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

        button.secondary {
          background: #0f766e;
        }

        button.ghost {
          background: #dbeafe;
          color: #1e3a8a;
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

        .snapshotGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .snapshotGrid article {
          border: 1px solid #d7e3f2;
          border-radius: 12px;
          background: #fff;
          padding: 10px;
        }

        .snapshotGrid article p {
          margin: 0 0 4px;
          color: #334155;
          font-size: 13px;
        }

        .contribGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .contribCard {
          border: 1px solid #d7e3f2;
          border-radius: 12px;
          padding: 10px;
          background: #fff;
        }

        .governanceLoopGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .governanceCard {
          border: 1px solid #d7e3f2;
          border-radius: 12px;
          padding: 10px;
          background: #fff;
        }

        .governanceCard p {
          margin: 0 0 4px;
          color: #334155;
          font-size: 13px;
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

        .statusTag {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .status-pending {
          background: #f8fafc;
          color: #475569;
          border-color: #cbd5e1;
        }

        .status-accept {
          background: #ecfdf5;
          color: #166534;
          border-color: #86efac;
        }

        .status-modify {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #93c5fd;
        }

        .status-reject {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fca5a5;
        }

        .status-request_clarification {
          background: #fffbeb;
          color: #92400e;
          border-color: #fcd34d;
        }

        .status-approved {
          background: #ecfdf5;
          color: #166534;
          border-color: #86efac;
        }

        .status-rejected {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fca5a5;
        }

        .status-finalized {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #93c5fd;
        }

        .status-info {
          background: #f8fafc;
          color: #475569;
          border-color: #cbd5e1;
        }

        .status-error {
          background: #fff1f2;
          color: #9f1239;
          border-color: #fda4af;
        }

        .activeDecisionButton {
          background: #0f766e;
          box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35);
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

        .exportDeck {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-bottom: 10px;
        }

        .exportDeck article {
          border: 1px solid #c8dbf1;
          border-radius: 12px;
          background: linear-gradient(180deg, #ffffff, #f4f9ff);
          padding: 10px;
          display: grid;
          gap: 6px;
        }

        .exportDeck article strong {
          color: #10365f;
        }

        .exportDeck article p {
          margin: 0;
          color: #44627f;
          font-size: 12px;
        }

        .exportDeck a {
          border: 1px solid #d5e2f3;
          border-radius: 10px;
          padding: 8px;
          text-decoration: none;
          color: #1e3a8a;
          font-weight: 600;
          background: #f8fbff;
          text-align: center;
        }

        .inline a {
          border: 1px solid #c6d9f0;
          border-radius: 9px;
          padding: 8px 11px;
          color: #0f3b63;
          background: #f8fbff;
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
        }

        .governanceFilters {
          align-items: flex-end;
        }

        .governanceFilters label {
          min-width: 170px;
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
          .snapshotGrid,
          .contribGrid,
          .governanceLoopGrid,
          .exportDeck,
          .grid4 {
            grid-template-columns: 1fr;
          }

          .governanceFilters label {
            min-width: 100%;
          }
        }
      `}</style>
    </main>
  )
}
