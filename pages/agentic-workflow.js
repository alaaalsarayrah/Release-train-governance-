import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

function parseMaybeJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function toneForStatus(status) {
  const normalized = String(status || 'pending').toLowerCase()
  if (normalized.includes('approved')) return 'good'
  if (normalized.includes('rejected')) return 'bad'
  return 'neutral'
}

function toneForStage(stage) {
  const normalized = String(stage || '').toLowerCase()
  if (normalized.includes('ready') || normalized.includes('scoping')) return 'good'
  if (normalized.includes('rework') || normalized.includes('rejected')) return 'bad'
  if (normalized.includes('draft') || normalized.includes('review')) return 'info'
  return 'neutral'
}

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  const normalized = String(value).toLowerCase().trim()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return fallback
}

function defaultDorChecks(selected) {
  return {
    brdApproved: String(selected?.requirement_review_status || '').toLowerCase() === 'approved',
    wsjfRanked: true,
    dependenciesReviewed: true,
    capacityPlanned: true,
    architectureRunwayReady: true,
    nfrAligned: true
  }
}

function defaultDodChecks(selected) {
  return {
    acceptanceCriteriaReady: String(selected?.user_story_status || '').toLowerCase().includes('created'),
    testEvidenceReady: String(selected?.task_status || '').toLowerCase().includes('created'),
    releasePlanReady: String(selected?.sprint_status || '').toLowerCase().includes('prepared'),
    observabilityReady: false,
    securityReviewComplete: false,
    opsHandoverReady: false
  }
}

function normalizeCapacity(value) {
  const parsed = parseMaybeJson(value) || {}
  return {
    business: Number(parsed.business ?? parsed.businessPercent ?? 60) || 0,
    enabler: Number(parsed.enabler ?? parsed.enablerPercent ?? 20) || 0,
    defectRisk: Number(parsed.defectRisk ?? parsed.defect_risk ?? parsed.defectRiskPercent ?? 20) || 0,
    maxDeviation: Number(parsed.maxDeviation ?? parsed.max_deviation ?? 35) || 35
  }
}

function normalizeReviewOutcome(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('approved')) return 'approved'
  if (normalized.includes('rejected')) return 'rejected'
  if (normalized.includes('pending')) return 'pending'
  return 'none'
}

function deriveWorkflowStages(item) {
  if (!item) return []

  const status = String(item.status || '').toLowerCase()
  const demandStatus = String(item.demand_status || '').toLowerCase()
  const demandReview = String(item.demand_review_status || '').toLowerCase()
  const brdStatus = String(item.requirement_status || '').toLowerCase()
  const brdReview = String(item.requirement_review_status || '').toLowerCase()
  const sprintStatus = String(item.sprint_status || '').toLowerCase()
  const currentStage = String(item.workflow_current_stage || '').toLowerCase()

  const sprintPrepared = sprintStatus.includes('prepared') || sprintStatus.includes('assigned to')
  const sprintRunning = sprintStatus.includes('in progress') || currentStage.includes('sprint running')
  const sprintCompleted = sprintStatus.includes('completed') || currentStage.includes('release governance')
  const deliveryClosed = currentStage.includes('closed - value delivered')

  return [
    {
      key: 'request-submitted',
      label: 'Business Request Submitted',
      detail: item.id,
      state: 'done'
    },
    {
      key: 'request-approved',
      label: 'Business Request Approved',
      detail: item.status || 'Pending',
      state: status === 'approved' ? 'done' : (status === 'rejected' ? 'blocked' : 'active')
    },
    {
      key: 'demand-generated',
      label: 'Demand Intelligence Drafted',
      detail: item.demand_status || 'Not Started',
      state: demandStatus.includes('generated') || demandStatus.includes('approved')
        ? 'done'
        : (demandStatus.includes('running') ? 'active' : 'todo')
    },
    {
      key: 'demand-reviewed',
      label: 'Brain Demand Gate',
      detail: item.demand_review_status || 'Not Reviewed',
      state: demandReview.includes('approved')
        ? 'done'
        : (demandReview.includes('rejected') ? 'blocked' : (demandReview.includes('pending') ? 'active' : 'todo'))
    },
    {
      key: 'brd-drafted',
      label: 'BRD Drafted by Analyst Agent',
      detail: item.requirement_status || 'Not Started',
      state: brdStatus.includes('draft') || brdStatus.includes('submitted') || brdStatus.includes('approved')
        ? 'done'
        : (brdStatus.includes('running') ? 'active' : 'todo')
    },
    {
      key: 'brd-reviewed',
      label: 'Brain BRD Gate',
      detail: item.requirement_review_status || 'Not Reviewed',
      state: brdReview.includes('approved')
        ? 'done'
        : (brdReview.includes('rejected') ? 'blocked' : (brdReview.includes('pending') ? 'active' : 'todo'))
    },
    {
      key: 'ado-backlog',
      label: 'ADO Backlog Hierarchy Synced',
      detail: Number(item.synced_to_ado || 0) ? 'Synced' : 'Not Synced',
      state: Number(item.synced_to_ado || 0) ? 'done' : 'todo'
    },
    {
      key: 'sprint-ready',
      label: 'Sprint Prepared with SAFe Guardrails',
      detail: item.sprint_status || 'Not Prepared',
      state: sprintPrepared || sprintRunning || sprintCompleted || deliveryClosed ? 'done' : 'todo'
    },
    {
      key: 'sprint-running',
      label: 'Sprint Execution Running',
      detail: sprintRunning ? 'In Progress' : (sprintCompleted ? 'Completed' : 'Not Started'),
      state: sprintRunning ? 'active' : ((sprintCompleted || deliveryClosed) ? 'done' : 'todo')
    },
    {
      key: 'sprint-close',
      label: 'Sprint Closed',
      detail: sprintCompleted ? 'Completed' : 'Pending',
      state: sprintCompleted || deliveryClosed ? 'done' : 'todo'
    },
    {
      key: 'release-signoff',
      label: 'Release Governance Sign-off',
      detail: deliveryClosed ? 'Closed - Value Delivered' : 'Pending',
      state: deliveryClosed ? 'done' : (currentStage.includes('release governance') ? 'active' : 'todo')
    }
  ]
}

export default function AgenticWorkflowPage() {
  const [requests, setRequests] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [logs, setLogs] = useState([])
  const [busyAction, setBusyAction] = useState('')
  const [busyDecision, setBusyDecision] = useState('')
  const [message, setMessage] = useState('')
  const [requestQuery, setRequestQuery] = useState('')
  const [sessionIdentity, setSessionIdentity] = useState(null)
  const [brdSummary, setBrdSummary] = useState('')
  const [brdDetails, setBrdDetails] = useState('')
  const [brdFile, setBrdFile] = useState(null)
  const [adoTeamName, setAdoTeamName] = useState('')
  const [adoSprintName, setAdoSprintName] = useState('')
  const [safePiName, setSafePiName] = useState('PI-2026-Q1')
  const [safeArtName, setSafeArtName] = useState('Digital ART')
  const [dorState, setDorState] = useState(defaultDorChecks(null))
  const [dodState, setDodState] = useState(defaultDodChecks(null))
  const [capacityState, setCapacityState] = useState({ business: 60, enabler: 20, defectRisk: 20, maxDeviation: 35 })
  const [savingSafe, setSavingSafe] = useState(false)

  const actorLabel = sessionIdentity
    ? sessionIdentity.role
      ? `${sessionIdentity.name} (${sessionIdentity.role})`
      : sessionIdentity.name
    : 'Workflow Operator'

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) || null,
    [requests, selectedId]
  )

  const filteredRequests = useMemo(() => {
    const query = requestQuery.trim().toLowerCase()
    if (!query) return requests

    return requests.filter((item) => {
      const fields = [
        item.id,
        item.description,
        item.status,
        item.workflow_current_stage,
        item.unit,
        item.urgency
      ]
      return fields.some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [requests, requestQuery])

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    if (!selectedId) return
    void loadLogs(selectedId)
  }, [selectedId])

  useEffect(() => {
    if (!selected) return
    setAdoTeamName(selected.team_name || '')
    setAdoSprintName(selected.sprint_name || '')
    setSafePiName(selected.safe_pi_name || 'PI-2026-Q1')
    setSafeArtName(selected.safe_art_name || 'Digital ART')

    const dorStored = parseMaybeJson(selected.safe_dor_checks) || {}
    const dodStored = parseMaybeJson(selected.safe_dod_checks) || {}
    const dorDefaults = defaultDorChecks(selected)
    const dodDefaults = defaultDodChecks(selected)

    setDorState({
      brdApproved: asBool(dorStored.brdApproved, dorDefaults.brdApproved),
      wsjfRanked: asBool(dorStored.wsjfRanked, dorDefaults.wsjfRanked),
      dependenciesReviewed: asBool(dorStored.dependenciesReviewed, dorDefaults.dependenciesReviewed),
      capacityPlanned: asBool(dorStored.capacityPlanned, dorDefaults.capacityPlanned),
      architectureRunwayReady: asBool(dorStored.architectureRunwayReady, dorDefaults.architectureRunwayReady),
      nfrAligned: asBool(dorStored.nfrAligned, dorDefaults.nfrAligned)
    })

    setDodState({
      acceptanceCriteriaReady: asBool(dodStored.acceptanceCriteriaReady, dodDefaults.acceptanceCriteriaReady),
      testEvidenceReady: asBool(dodStored.testEvidenceReady, dodDefaults.testEvidenceReady),
      releasePlanReady: asBool(dodStored.releasePlanReady, dodDefaults.releasePlanReady),
      observabilityReady: asBool(dodStored.observabilityReady, dodDefaults.observabilityReady),
      securityReviewComplete: asBool(dodStored.securityReviewComplete, dodDefaults.securityReviewComplete),
      opsHandoverReady: asBool(dodStored.opsHandoverReady, dodDefaults.opsHandoverReady)
    })

    setCapacityState(normalizeCapacity(selected.safe_capacity_guardrails))
  }, [selected])

  useEffect(() => {
    void loadSessionIdentity()
  }, [])

  async function loadSessionIdentity() {
    try {
      const res = await fetch('/api/session-identity')
      const json = await res.json()
      setSessionIdentity(json.identity || null)
    } catch {
      setSessionIdentity(null)
    }
  }

  async function refreshAll() {
    try {
      const res = await fetch('/api/business-request')
      const json = await res.json()
      const items = json.requests || []
      setRequests(items)
      if (!selectedId && items[0]?.id) setSelectedId(items[0].id)
    } catch (err) {
      setMessage(`Failed to load requests: ${err.message || err}`)
    }
  }

  async function loadLogs(brId) {
    try {
      const res = await fetch(`/api/agentic/audit-logs?brId=${encodeURIComponent(brId)}&limit=120`)
      const json = await res.json()
      setLogs(json.logs || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function runAction(action, payload = {}) {
    if (!selected) return
    setBusyAction(action)
    setMessage('')
    const controller = new AbortController()
    const longAction = action === 'sync-backlog' || action === 'prepare-sprint' || action === 'review-brd'
    const timeoutHandle = setTimeout(() => controller.abort(), longAction ? 240000 : 45000)

    try {
      const res = await fetch('/api/agentic/workflow-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          action,
          id: selected.id,
          triggeredBy: actorLabel,
          ...payload
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Workflow action failed')

      setMessage(`Action completed: ${action}`)
      await refreshAll()
      await loadLogs(selected.id)

      if (action === 'submit-brd') {
        setBrdSummary('')
        setBrdDetails('')
        setBrdFile(null)
      }
    } catch (err) {
      const isAbort = err?.name === 'AbortError'
      setMessage(isAbort ? `Action timed out: ${action}. Please retry.` : `Action failed: ${err.message || err}`)
    } finally {
      clearTimeout(timeoutHandle)
      setBusyAction('')
    }
  }

  async function sendReviewDecision(action, decision) {
    const reason = window.prompt(`Optional ${decision} reason/comment:`, '')
    setBusyDecision(`${action}:${decision}`)
    try {
      await runAction(action, { decision, reason: reason || '' })
    } finally {
      setBusyDecision('')
    }
  }

  async function submitBrdFromForm() {
    if (!selected) return
    let uploadedUrl = ''

    if (brdFile) {
      const fd = new FormData()
      fd.append('file', brdFile)
      const upload = await fetch('/api/upload', { method: 'POST', body: fd })
      const uploadJson = await upload.json()
      if (!upload.ok) throw new Error(uploadJson.message || 'BRD upload failed')
      uploadedUrl = uploadJson.url || ''
    }

    await runAction('submit-brd', {
      brdUrl: uploadedUrl,
      brdSummary,
      brdDetails
    })
  }

  async function saveSafeControls() {
    if (!selected) return
    setSavingSafe(true)
    setMessage('')
    try {
      const payload = {
        id: selected.id,
        safe_pi_name: safePiName,
        safe_art_name: safeArtName,
        safe_dor_checks: JSON.stringify(dorState),
        safe_dod_checks: JSON.stringify(dodState),
        safe_capacity_guardrails: JSON.stringify(capacityState),
        actor: actorLabel,
        auditStage: 'SAFe Governance',
        auditAction: 'Updated PI/ART, DoR/DoD and capacity guardrails'
      }

      const res = await fetch('/api/business-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to save SAFe controls')

      setMessage('SAFe controls saved')
      await refreshAll()
      await loadLogs(selected.id)
    } catch (err) {
      setMessage(`Failed to save SAFe controls: ${err.message || err}`)
    } finally {
      setSavingSafe(false)
    }
  }

  const demandOutput = parseMaybeJson(selected?.demand_output)
  const requirementDetails = parseMaybeJson(selected?.requirement_details)
  const adoSyncSummary = parseMaybeJson(selected?.ado_sync_summary)
  const wsjfSummary = parseMaybeJson(selected?.safe_wsjf_summary) || adoSyncSummary?.wsjfSummary || null
  const dependencyMetrics = parseMaybeJson(selected?.safe_dependency_metrics) || adoSyncSummary?.dependencyMetrics || null
  const capacityActual = adoSyncSummary?.capacityActual || null
  const wsjfTop = Array.isArray(wsjfSummary?.rankings) ? wsjfSummary.rankings[0] : null
  const capacityTotal = Number(capacityState.business || 0) + Number(capacityState.enabler || 0) + Number(capacityState.defectRisk || 0)
  const demandReviewOutcome = normalizeReviewOutcome(selected?.demand_review_status)
  const brdReviewOutcome = normalizeReviewOutcome(selected?.requirement_review_status)
  const workflowStages = deriveWorkflowStages(selected)
  const sprintLower = String(selected?.sprint_status || '').toLowerCase()
  const workflowLower = String(selected?.workflow_current_stage || '').toLowerCase()
  const safeActionPayload = {
    piName: safePiName,
    artName: safeArtName,
    dorChecks: dorState,
    dodChecks: dodState,
    capacityGuardrails: {
      business: Number(capacityState.business || 0),
      enabler: Number(capacityState.enabler || 0),
      defectRisk: Number(capacityState.defectRisk || 0),
      maxDeviation: Number(capacityState.maxDeviation || 35)
    }
  }
  const adoLinks = adoSyncSummary?.links || {
    boardUrl: selected?.ado_board_url || null,
    dashboardsUrl: selected?.ado_dashboard_url || null,
    backlogUrl: null,
    sprintsUrl: null
  }
  const demandReviewPending = String(selected?.demand_review_status || '').toLowerCase().includes('pending')
  const brdReviewPending = String(selected?.requirement_review_status || '').toLowerCase().includes('pending')
  const readyForScoping = String(selected?.workflow_current_stage || '').toLowerCase().includes('ready for epic scoping')
  const backlogSynced = Boolean(Number(selected?.synced_to_ado || 0))
  const canBacklogSync = String(selected?.requirement_review_status || '').toLowerCase() === 'approved'
  const canPrepareSprint = backlogSynced || String(selected?.user_story_status || '').toLowerCase().includes('created')
  const canStartSprint = String(selected?.sprint_status || '').toLowerCase().includes('prepared')
  const canCompleteSprint = sprintLower.includes('in progress') || workflowLower.includes('sprint running')
  const canCloseDelivery = sprintLower.includes('completed') || workflowLower.includes('release governance')

  return (
    <main className="shell">
      <div className="glow" aria-hidden="true" />
      <header className="top">
        <div>
          <h1>Supporting Demand and BRD Governance Console</h1>
          <p>
            Supporting upstream module for preparing demand and BRD artifacts that feed the primary SAFe sprint planning thesis flow.
          </p>
        </div>
        <div className="links">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/evaluation">Evaluation</Link>
          <Link href="/planning-export-center">Export Center</Link>
          <Link href="/dashboard">Supporting Dashboard</Link>
          <Link href="/agentic-config">Persona Config</Link>
          <Link href="/teams">Teams</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel">
        <div className="head">
          <h2>Business Requests</h2>
          <div className="head-actions">
            <div className="actor-badge">
              <span>{actorLabel}</span>
              <span className="actor-note">Managed in Administrator</span>
            </div>
            <button onClick={() => void refreshAll()} disabled={Boolean(busyAction)}>
              Refresh
            </button>
          </div>
        </div>

        <div className="request-grid">
          <div className="left-list">
            <div className="left-head">
              <div className="left-count">
                Showing {filteredRequests.length} of {requests.length}
              </div>
              <input
                value={requestQuery}
                onChange={(e) => setRequestQuery(e.target.value)}
                placeholder="Search BR ID, description, status, stage"
                aria-label="Search business requests"
              />
            </div>

            <div className="left-scroll">
              {filteredRequests.length === 0 ? (
                <div className="empty-list">No business requests match your search.</div>
              ) : (
                filteredRequests.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`item ${selectedId === item.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="item-title-row">
                      <div className="item-title">{item.id}</div>
                      <div className="item-time">{item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}</div>
                    </div>
                    <div className="item-sub">{item.description || 'No description'}</div>
                    <div className="chips">
                      <span className={`chip status ${toneForStatus(item.status)}`}>{item.status || 'Pending'}</span>
                      <span className={`chip stage ${toneForStage(item.workflow_current_stage)}`}>
                        {item.workflow_current_stage || 'Business Request'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="details">
            {!selected ? <p>Select a business request.</p> : (
              <>
                <h3>{selected.id}</h3>
                <p className="desc">{selected.description}</p>
                <div className="status-grid">
                  <div><strong>Demand</strong><span>{selected.demand_status || 'Not Started'}</span></div>
                  <div><strong>Demand Review</strong><span>{selected.demand_review_status || 'Not Reviewed'}</span></div>
                  <div><strong>BRD</strong><span>{selected.requirement_status || 'Not Started'}</span></div>
                  <div><strong>BRD Review</strong><span>{selected.requirement_review_status || 'Not Reviewed'}</span></div>
                  <div><strong>Current Stage</strong><span>{selected.workflow_current_stage || 'Business Request'}</span></div>
                  <div><strong>BRD Version</strong><span>{selected.requirement_brd_version || 0}</span></div>
                  <div><strong>Epic Status</strong><span>{selected.epic_status || 'Not Created'}</span></div>
                  <div><strong>Feature Status</strong><span>{selected.feature_status || 'Not Created'}</span></div>
                  <div><strong>User Stories</strong><span>{selected.user_story_status || 'Not Created'}</span></div>
                  <div><strong>Tasks</strong><span>{selected.task_status || 'Not Created'}</span></div>
                  <div><strong>Sprint Status</strong><span>{selected.sprint_status || 'Not Prepared'}</span></div>
                  <div><strong>Story Points</strong><span>{selected.story_points_total || 0}</span></div>
                </div>

                <div className="workflow-rail">
                  <div className="workflow-rail-head">
                    <h4>End-to-End Workflow Lifecycle</h4>
                    <span>{selected.workflow_current_stage || 'Business Request'}</span>
                  </div>
                  <div className="workflow-stage-grid">
                    {workflowStages.map((stage, index) => (
                      <article key={stage.key} className={`workflow-stage ${stage.state}`}>
                        <span className="stage-index">{index + 1}</span>
                        <div>
                          <strong>{stage.label}</strong>
                          <p>{stage.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                {readyForScoping ? (
                  <div className="state-note success">
                    This request is already approved and moved to Ready for Epic Scoping. No active approval action is required.
                  </div>
                ) : null}

                <div className="ado-targets">
                  <label>
                    Squad Team
                    <input
                      value={adoTeamName}
                      onChange={(e) => setAdoTeamName(e.target.value)}
                      placeholder="e.g. Dubai Team"
                    />
                  </label>
                  <label>
                    Sprint
                    <input
                      value={adoSprintName}
                      onChange={(e) => setAdoSprintName(e.target.value)}
                      placeholder="e.g. Sprint 1"
                    />
                  </label>
                </div>

                <div className="safe-card">
                  <h4>SAFe Governance Controls</h4>
                  <div className="safe-grid">
                    <label>
                      PI Name
                      <input
                        value={safePiName}
                        onChange={(e) => setSafePiName(e.target.value)}
                        placeholder="e.g. PI-2026-Q2"
                      />
                    </label>
                    <label>
                      ART Name
                      <input
                        value={safeArtName}
                        onChange={(e) => setSafeArtName(e.target.value)}
                        placeholder="e.g. Digital ART"
                      />
                    </label>
                  </div>

                  <div className="safe-checklists">
                    <div className="checklist-card">
                      <h5 className="checklist-title">Definition of Ready (Gate: Prepare Sprint)</h5>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dorState.brdApproved}
                          onChange={(e) => setDorState((prev) => ({ ...prev, brdApproved: e.target.checked }))}
                        />
                        <span className="checkText">BRD approved</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dorState.wsjfRanked}
                          onChange={(e) => setDorState((prev) => ({ ...prev, wsjfRanked: e.target.checked }))}
                        />
                        <span className="checkText">WSJF ranking completed</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dorState.dependenciesReviewed}
                          onChange={(e) => setDorState((prev) => ({ ...prev, dependenciesReviewed: e.target.checked }))}
                        />
                        <span className="checkText">Dependencies reviewed</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dorState.capacityPlanned}
                          onChange={(e) => setDorState((prev) => ({ ...prev, capacityPlanned: e.target.checked }))}
                        />
                        <span className="checkText">Capacity plan agreed</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dorState.architectureRunwayReady}
                          onChange={(e) => setDorState((prev) => ({ ...prev, architectureRunwayReady: e.target.checked }))}
                        />
                        <span className="checkText">Architecture runway ready</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dorState.nfrAligned}
                          onChange={(e) => setDorState((prev) => ({ ...prev, nfrAligned: e.target.checked }))}
                        />
                        <span className="checkText">NFR coverage aligned</span>
                      </label>
                    </div>

                    <div className="checklist-card">
                      <h5 className="checklist-title">Definition of Done (Gate: Start Sprint)</h5>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dodState.acceptanceCriteriaReady}
                          onChange={(e) => setDodState((prev) => ({ ...prev, acceptanceCriteriaReady: e.target.checked }))}
                        />
                        <span className="checkText">Acceptance criteria ready</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dodState.testEvidenceReady}
                          onChange={(e) => setDodState((prev) => ({ ...prev, testEvidenceReady: e.target.checked }))}
                        />
                        <span className="checkText">Test evidence plan ready</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dodState.releasePlanReady}
                          onChange={(e) => setDodState((prev) => ({ ...prev, releasePlanReady: e.target.checked }))}
                        />
                        <span className="checkText">Release plan ready</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dodState.observabilityReady}
                          onChange={(e) => setDodState((prev) => ({ ...prev, observabilityReady: e.target.checked }))}
                        />
                        <span className="checkText">Observability/monitoring ready</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dodState.securityReviewComplete}
                          onChange={(e) => setDodState((prev) => ({ ...prev, securityReviewComplete: e.target.checked }))}
                        />
                        <span className="checkText">Security review complete</span>
                      </label>
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={dodState.opsHandoverReady}
                          onChange={(e) => setDodState((prev) => ({ ...prev, opsHandoverReady: e.target.checked }))}
                        />
                        <span className="checkText">Operations handover ready</span>
                      </label>
                    </div>
                  </div>

                  <h5>Capacity Guardrails (Prepare Sprint Validation)</h5>
                  <div className="safe-grid">
                    <label>
                      Business %
                      <input
                        type="number"
                        value={capacityState.business}
                        onChange={(e) => setCapacityState((prev) => ({ ...prev, business: Number(e.target.value || 0) }))}
                      />
                    </label>
                    <label>
                      Enabler %
                      <input
                        type="number"
                        value={capacityState.enabler}
                        onChange={(e) => setCapacityState((prev) => ({ ...prev, enabler: Number(e.target.value || 0) }))}
                      />
                    </label>
                    <label>
                      Defect/Risk %
                      <input
                        type="number"
                        value={capacityState.defectRisk}
                        onChange={(e) => setCapacityState((prev) => ({ ...prev, defectRisk: Number(e.target.value || 0) }))}
                      />
                    </label>
                    <label>
                      Max Deviation %
                      <input
                        type="number"
                        value={capacityState.maxDeviation}
                        onChange={(e) => setCapacityState((prev) => ({ ...prev, maxDeviation: Number(e.target.value || 35) }))}
                      />
                    </label>
                    <label>
                      Total %
                      <input value={capacityTotal} readOnly />
                    </label>
                  </div>

                  <div className="safe-metrics">
                    <span><strong>Top WSJF:</strong> {wsjfTop ? `${wsjfTop.featureTitle} (${wsjfTop.wsjfScore})` : '-'}</span>
                    <span><strong>Blocked:</strong> {dependencyMetrics?.blockedStories || 0}</span>
                    <span><strong>Cross-Team:</strong> {dependencyMetrics?.crossTeamLinks || 0}</span>
                    <span><strong>Aging:</strong> {dependencyMetrics?.agingBlockers || 0}</span>
                    <span><strong>Heat:</strong> {dependencyMetrics?.heatScore || 0}</span>
                    <span><strong>Flow Load:</strong> {capacityActual?.totalPoints || 0} pts</span>
                    <span><strong>Guardrail Tolerance:</strong> {capacityState.maxDeviation || 35}%</span>
                  </div>

                  <button
                    type="button"
                    className="miniBtn"
                    onClick={() => void saveSafeControls()}
                    disabled={savingSafe}
                  >
                    {savingSafe ? 'Saving Controls...' : 'Save SAFe Controls'}
                  </button>
                </div>

                <div className="action-board">
                  <article className="action-group">
                    <h5>1) Demand Intelligence</h5>
                    <button
                      type="button"
                      className="miniBtn"
                      onClick={() => void runAction('generate-demand')}
                      disabled={busyAction === 'generate-demand'}
                    >
                      {busyAction === 'generate-demand' ? 'Generating Demand...' : 'Run AI Demand'}
                    </button>

                    {demandReviewPending ? (
                      <div className="review-row">
                        <button
                          type="button"
                          className="miniBtn ok"
                          onClick={() => void sendReviewDecision('review-demand', 'approve')}
                          disabled={busyAction === 'review-demand'}
                        >
                          {busyDecision === 'review-demand:approve' ? 'Approving Demand...' : 'Approve Demand'}
                        </button>
                        <button
                          type="button"
                          className="miniBtn bad"
                          onClick={() => void sendReviewDecision('review-demand', 'reject')}
                          disabled={busyAction === 'review-demand'}
                        >
                          {busyDecision === 'review-demand:reject' ? 'Requesting Rework...' : 'Request Rework'}
                        </button>
                      </div>
                    ) : (
                      <p className={`review-pill ${demandReviewOutcome}`}>
                        Demand review outcome: {selected?.demand_review_status || 'Not Reviewed'}
                      </p>
                    )}
                  </article>

                  <article className="action-group">
                    <h5>2) BRD Governance</h5>
                    <button
                      type="button"
                      className="miniBtn"
                      onClick={() => void runAction('generate-brd')}
                      disabled={busyAction === 'generate-brd'}
                    >
                      {busyAction === 'generate-brd' ? 'Generating BRD...' : 'Generate BRD Draft'}
                    </button>

                    {brdReviewPending ? (
                      <div className="review-row">
                        <button
                          type="button"
                          className="miniBtn ok"
                          onClick={() => void sendReviewDecision('review-brd', 'approve')}
                          disabled={busyAction === 'review-brd'}
                        >
                          {busyDecision === 'review-brd:approve' ? 'Approving BRD...' : 'Approve BRD Review'}
                        </button>
                        <button
                          type="button"
                          className="miniBtn bad"
                          onClick={() => void sendReviewDecision('review-brd', 'reject')}
                          disabled={busyAction === 'review-brd'}
                        >
                          {busyDecision === 'review-brd:reject' ? 'Requesting BRD Rework...' : 'Request BRD Rework'}
                        </button>
                      </div>
                    ) : (
                      <p className={`review-pill ${brdReviewOutcome}`}>
                        BRD review outcome: {selected?.requirement_review_status || 'Not Reviewed'}
                      </p>
                    )}
                  </article>

                  <article className="action-group">
                    <h5>3) ADO Portfolio Flow</h5>
                    <button
                      type="button"
                      className="miniBtn"
                      onClick={() => void runAction('sync-backlog', {
                        teamName: adoTeamName,
                        sprintName: adoSprintName,
                        ...safeActionPayload
                      })}
                      disabled={busyAction === 'sync-backlog' || !canBacklogSync}
                      title={canBacklogSync ? 'Create Epic/Feature/User Stories/Tasks in ADO backlog' : 'BRD review must be approved first'}
                    >
                      {busyAction === 'sync-backlog' ? 'Syncing Backlog...' : 'Sync Epic/Feature/Stories'}
                    </button>

                    <button
                      type="button"
                      className="miniBtn"
                      onClick={() => void runAction('prepare-sprint', {
                        teamName: adoTeamName,
                        sprintName: adoSprintName,
                        ...safeActionPayload
                      })}
                      disabled={busyAction === 'prepare-sprint' || !canPrepareSprint}
                      title={canPrepareSprint ? 'Provision team sprint settings and board readiness in ADO' : 'Backlog sync required first'}
                    >
                      {busyAction === 'prepare-sprint' ? 'Preparing Sprint...' : 'Prepare Sprint in ADO'}
                    </button>
                  </article>

                  <article className="action-group">
                    <h5>4) Sprint and Release Closure</h5>
                    <button
                      type="button"
                      className="miniBtn ok"
                      onClick={() => void runAction('start-sprint', {
                        teamName: adoTeamName,
                        sprintName: adoSprintName,
                        ...safeActionPayload
                      })}
                      disabled={busyAction === 'start-sprint' || !canStartSprint}
                      title={canStartSprint ? 'Mark sprint as running after readiness checks' : 'Prepare sprint first'}
                    >
                      {busyAction === 'start-sprint' ? 'Starting Sprint...' : 'Start Sprint'}
                    </button>

                    <button
                      type="button"
                      className="miniBtn"
                      onClick={() => void runAction('complete-sprint', {
                        teamName: adoTeamName,
                        sprintName: adoSprintName,
                        ...safeActionPayload
                      })}
                      disabled={busyAction === 'complete-sprint' || !canCompleteSprint}
                      title={canCompleteSprint ? 'Close sprint execution and open release governance stage' : 'Start sprint first'}
                    >
                      {busyAction === 'complete-sprint' ? 'Completing Sprint...' : 'Complete Sprint'}
                    </button>

                    <button
                      type="button"
                      className="miniBtn ok"
                      onClick={() => void runAction('close-delivery', {
                        teamName: adoTeamName,
                        sprintName: adoSprintName,
                        ...safeActionPayload
                      })}
                      disabled={busyAction === 'close-delivery' || !canCloseDelivery}
                      title={canCloseDelivery ? 'Finalize release governance and close delivery loop' : 'Complete sprint first'}
                    >
                      {busyAction === 'close-delivery' ? 'Closing Delivery...' : 'Close Delivery'}
                    </button>
                  </article>
                </div>

                <div className="ado-links">
                  <span className="muted-note">ADO Visibility:</span>
                  {adoLinks.backlogUrl ? <a href={adoLinks.backlogUrl} target="_blank" rel="noreferrer">Backlog</a> : null}
                  {adoLinks.boardUrl ? <a href={adoLinks.boardUrl} target="_blank" rel="noreferrer">Board</a> : null}
                  {adoLinks.sprintsUrl ? <a href={adoLinks.sprintsUrl} target="_blank" rel="noreferrer">Sprints</a> : null}
                  {adoLinks.dashboardsUrl ? <a href={adoLinks.dashboardsUrl} target="_blank" rel="noreferrer">Dashboards</a> : null}
                </div>

                <div className="submit-card">
                  <h4>Business Analyst Submit/Update BRD</h4>
                  <p className="muted-note">
                    If a BRD draft is already generated, you can submit for Brain review even with empty fields.
                  </p>
                  <label>
                    BRD Summary
                    <input value={brdSummary} onChange={(e) => setBrdSummary(e.target.value)} placeholder="Short BRD summary" />
                  </label>
                  <label>
                    BRD Details
                    <textarea rows={4} value={brdDetails} onChange={(e) => setBrdDetails(e.target.value)} placeholder="Detailed BRD notes / updates" />
                  </label>
                  <label>
                    Upload BRD File (optional)
                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setBrdFile(e.target.files?.[0] || null)} />
                  </label>
                  <button
                    type="button"
                    className="miniBtn"
                    onClick={() => void submitBrdFromForm()}
                    disabled={busyAction === 'submit-brd'}
                  >
                    {busyAction === 'submit-brd' ? 'Submitting...' : 'Submit BRD for Brain Review'}
                  </button>
                </div>

                <div className="output-grid">
                  <article className="output-card">
                    <div className="output-head">
                      <h4>Demand Output</h4>
                      <span>{demandOutput ? 'JSON Ready' : 'Pending'}</span>
                    </div>
                    <pre>{demandOutput ? JSON.stringify(demandOutput, null, 2) : 'No demand output yet.'}</pre>
                  </article>
                  <article className="output-card">
                    <div className="output-head">
                      <h4>BRD Details</h4>
                      <span>{requirementDetails ? 'JSON Ready' : 'Pending'}</span>
                    </div>
                    <pre>{requirementDetails ? JSON.stringify(requirementDetails, null, 2) : 'No BRD details yet.'}</pre>
                    {selected.requirement_doc ? (
                      <p className="output-link">
                        BRD File: <a href={selected.requirement_doc} target="_blank" rel="noreferrer">{selected.requirement_doc}</a>
                      </p>
                    ) : null}
                  </article>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Audit Trail</h2>
          <button onClick={() => selectedId && void loadLogs(selectedId)} disabled={!selectedId || Boolean(busyAction)}>
            Reload Logs
          </button>
        </div>
        {logs.length === 0 ? <p>No audit logs for this request yet.</p> : (
          <div className="log-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Stage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.actor}</td>
                    <td>{log.stage}</td>
                    <td>{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1250px;
          margin: 0 auto;
          padding: 24px;
          position: relative;
          color: #10223a;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .glow {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 8% 12%, rgba(38, 173, 210, 0.14), transparent 44%),
            radial-gradient(circle at 85% 10%, rgba(75, 116, 255, 0.15), transparent 48%),
            linear-gradient(180deg, #f8fbff, #edf3ff);
        }

        .top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
        }

        .top h1 {
          margin: 0;
          font-size: 33px;
        }

        .top p {
          margin: 8px 0 0;
          color: #3d536d;
        }

        .links {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .links :global(a) {
          text-decoration: none;
          color: #0e3b66;
          border: 1px solid #c8dbf0;
          border-radius: 999px;
          background: #fff;
          padding: 7px 13px;
          font-weight: 700;
        }

        .banner {
          margin-bottom: 12px;
          border: 1px solid #8fe4df;
          background: #ecfeff;
          color: #134e4a;
          border-radius: 10px;
          padding: 10px;
        }

        .panel {
          border-radius: 16px;
          border: 1px solid #d7e3f3;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          margin-bottom: 14px;
          padding: 14px;
        }

        .muted-note {
          margin: 0 0 8px;
          color: #4d647e;
          font-size: 12px;
          line-height: 1.35;
        }

        .head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .head-actions {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .actor-badge {
          min-height: 36px;
          min-width: 220px;
          border: 1px solid #d7e3f3;
          border-radius: 10px;
          background: #f8fbff;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #314a67;
        }

        .actor-note {
          color: #4e6680;
          font-size: 11px;
          font-weight: 700;
        }

        .head h2 {
          margin: 0;
        }

        button {
          border: 1px solid rgba(18, 60, 103, 0.2);
          border-radius: 12px;
          padding: 9px 13px;
          cursor: pointer;
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.01em;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
          box-shadow: 0 8px 16px rgba(20, 68, 122, 0.22);
          transition: transform 130ms ease, box-shadow 130ms ease, filter 130ms ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 20px rgba(20, 68, 122, 0.27);
          filter: saturate(1.05);
        }

        button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 6px 12px rgba(20, 68, 122, 0.2);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.62;
          box-shadow: none;
          transform: none;
        }

        .miniBtn {
          min-height: 38px;
        }

        .miniBtn.ok {
          background: linear-gradient(135deg, #118a43, #0b6d3f);
          border-color: rgba(12, 104, 60, 0.45);
          box-shadow: 0 8px 16px rgba(12, 104, 60, 0.24);
        }

        .miniBtn.bad {
          background: linear-gradient(135deg, #c62828, #9f1d1d);
          border-color: rgba(135, 29, 29, 0.5);
          box-shadow: 0 8px 16px rgba(135, 29, 29, 0.25);
        }

        .request-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 320px 1fr;
        }

        .left-list {
          display: grid;
          gap: 8px;
        }

        .left-head {
          display: grid;
          gap: 6px;
          border: 1px solid #d2e0f4;
          border-radius: 12px;
          background: #f8fbff;
          padding: 8px;
        }

        .left-count {
          color: #48617d;
          font-size: 12px;
          font-weight: 700;
        }

        .left-scroll {
          display: grid;
          gap: 8px;
          max-height: 62vh;
          overflow: auto;
          padding-right: 2px;
        }

        .empty-list {
          border: 1px dashed #c4d5ea;
          border-radius: 12px;
          background: #f8fbff;
          color: #4d647e;
          font-size: 13px;
          padding: 12px;
        }

        .item {
          text-align: left;
          background: linear-gradient(180deg, #fafdff, #f3f8ff);
          border: 1px solid #c6d9ee;
          color: #10223a;
          border-radius: 16px;
          padding: 12px;
          display: grid;
          gap: 7px;
          box-shadow: 0 3px 10px rgba(30, 65, 110, 0.08);
          transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
        }

        .item:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: #95badc;
          box-shadow: 0 10px 18px rgba(30, 65, 110, 0.12);
        }

        .item.active {
          border-color: #2f84ba;
          box-shadow: 0 0 0 2px rgba(47, 132, 186, 0.2), 0 12px 24px rgba(24, 76, 128, 0.16);
        }

        .item-title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .item-title-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }

        .item-time {
          font-size: 12px;
          color: #5a7590;
          font-weight: 700;
          white-space: nowrap;
        }

        .item-sub {
          font-size: 13px;
          color: #415c78;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid transparent;
          letter-spacing: 0.01em;
          backdrop-filter: blur(1px);
        }

        .chip.status.good {
          background: linear-gradient(180deg, #e7f8ef, #d7f2e4);
          color: #116b43;
          border-color: #a7ddbf;
        }

        .chip.status.bad {
          background: linear-gradient(180deg, #feecea, #fde0de);
          color: #8d2424;
          border-color: #f0b6b2;
        }

        .chip.status.neutral {
          background: linear-gradient(180deg, #f3f8ff, #eaf3ff);
          color: #25547d;
          border-color: #c2dbf1;
        }

        .chip.stage.good {
          background: linear-gradient(180deg, #e9f8f2, #dcf2ea);
          color: #14644a;
          border-color: #a9d9c8;
        }

        .chip.stage.bad {
          background: linear-gradient(180deg, #fff0ef, #fee5e3);
          color: #8b2a2a;
          border-color: #efbfbb;
        }

        .chip.stage.info {
          background: linear-gradient(180deg, #edf4ff, #e3efff);
          color: #1e4f87;
          border-color: #bdd5f5;
        }

        .chip.stage.neutral {
          background: linear-gradient(180deg, #eef3fa, #e5edf8);
          color: #415f80;
          border-color: #c7d6e8;
        }

        .workflow-rail {
          border: 1px solid #d2e0f4;
          border-radius: 12px;
          background: #f7fbff;
          padding: 10px;
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
        }

        .workflow-rail-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .workflow-rail-head h4 {
          margin: 0;
          font-size: 15px;
        }

        .workflow-rail-head span {
          font-size: 12px;
          color: #385470;
          font-weight: 700;
        }

        .workflow-stage-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 8px;
        }

        .workflow-stage {
          border-radius: 11px;
          border: 1px solid #d4e2f3;
          background: #fff;
          padding: 9px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .workflow-stage strong {
          display: block;
          font-size: 12px;
          color: #143555;
        }

        .workflow-stage p {
          margin: 3px 0 0;
          font-size: 12px;
          color: #4a6380;
        }

        .stage-index {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #153c63;
          background: #e5f1ff;
          flex: 0 0 auto;
        }

        .workflow-stage.done {
          border-color: #9ed9c0;
          background: #f1fcf6;
        }

        .workflow-stage.done .stage-index {
          background: #c6f1da;
          color: #0f5a3d;
        }

        .workflow-stage.active {
          border-color: #9bc5ea;
          background: #eff6ff;
        }

        .workflow-stage.blocked {
          border-color: #f0b8b5;
          background: #fff2f1;
        }

        .workflow-stage.blocked .stage-index {
          background: #ffd7d3;
          color: #8b2727;
        }

        .action-board {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          margin-bottom: 12px;
        }

        .action-group {
          border-radius: 12px;
          border: 1px solid #d4e2f3;
          background: #fbfdff;
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .action-group h5 {
          margin: 0;
          font-size: 13px;
          color: #34516d;
        }

        .action-board .miniBtn {
          min-height: 42px;
          border-radius: 14px;
          font-size: 13px;
          box-shadow: 0 10px 18px rgba(20, 68, 122, 0.2);
        }

        .action-board .miniBtn:hover:not(:disabled) {
          box-shadow: 0 14px 24px rgba(20, 68, 122, 0.25);
        }

        .review-row {
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr 1fr;
        }

        .review-pill {
          margin: 0;
          border-radius: 999px;
          border: 1px solid #c5d8ee;
          background: #eef5ff;
          color: #254f79;
          font-size: 12px;
          font-weight: 700;
          padding: 7px 10px;
          text-align: center;
        }

        .review-pill.approved {
          border-color: #9ad6b8;
          background: #ecfbf2;
          color: #0d6843;
        }

        .review-pill.rejected {
          border-color: #efb9b4;
          background: #fff1ef;
          color: #8a2929;
        }

        .submit-card .miniBtn {
          width: fit-content;
        }

        .details h3 {
          margin: 0;
          font-size: 21px;
        }

        .desc {
          margin-top: 8px;
          color: #3d536d;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin: 10px 0 12px;
        }

        .status-grid div {
          border-radius: 11px;
          border: 1px solid #d2e0f4;
          background: #f8fbff;
          padding: 8px;
          display: grid;
          gap: 3px;
          font-size: 12px;
        }

        .status-grid strong {
          color: #3d536d;
        }

        .status-grid span {
          color: #10223a;
          font-weight: 700;
        }

        .ado-targets {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }

        .safe-card {
          border: 1px solid #cbdff7;
          background: linear-gradient(180deg, #fcfeff, #f3f8ff);
          border-radius: 16px;
          padding: 14px;
          display: grid;
          gap: 10px;
          margin-bottom: 12px;
          box-shadow: 0 14px 28px rgba(18, 43, 71, 0.08);
        }

        .safe-card h4,
        .safe-card h5 {
          margin: 0;
        }

        .safe-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }

        .safe-checklists {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .checklist-card {
          border: 1px solid #d6e6fa;
          border-radius: 14px;
          background: #ffffff;
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .checklist-title {
          font-size: 14px;
          color: #173b5f;
          margin-bottom: 2px;
        }

        .checkRow {
          display: grid;
          grid-template-columns: 20px 1fr;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #2b4867;
          border: 1px solid #e3edf9;
          border-radius: 10px;
          background: #f8fbff;
          padding: 6px 8px;
        }

        .checkRow input {
          width: 16px;
          height: 16px;
          margin: 0;
          accent-color: #0f6cc9;
        }

        .checkText {
          line-height: 1.35;
        }

        .safe-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 8px;
          border: 1px solid #d2e0f4;
          border-radius: 12px;
          background: #f8fbff;
          padding: 10px;
          font-size: 12px;
          color: #34516d;
        }

        .safe-metrics span {
          border: 1px solid #deebfb;
          border-radius: 10px;
          background: #fff;
          padding: 6px 8px;
        }

        .ado-links {
          border: 1px solid #d2e0f4;
          border-radius: 12px;
          background: #f8fbff;
          padding: 8px 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-bottom: 12px;
        }

        .ado-links a {
          text-decoration: none;
          color: #0e3b66;
          font-weight: 700;
          border: 1px solid #c8dbf0;
          border-radius: 999px;
          background: #fff;
          padding: 4px 10px;
          font-size: 12px;
        }

        .state-note {
          border-radius: 12px;
          border: 1px solid #cde8d9;
          background: #ecfdf3;
          color: #0f5132;
          padding: 10px 12px;
          margin-bottom: 12px;
          font-size: 13px;
          font-weight: 700;
        }

        .submit-card {
          border: 1px solid #d3e4f8;
          background: #fbfdff;
          border-radius: 12px;
          padding: 10px;
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
        }

        .submit-card h4 {
          margin: 0;
        }

        label {
          font-size: 12px;
          color: #35506b;
          font-weight: 700;
          display: grid;
          gap: 4px;
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          padding: 8px;
          font-size: 13px;
          color: #10223a;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        .output-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        }

        .output-card {
          border: 1px solid #d5e4f8;
          border-radius: 14px;
          background: linear-gradient(180deg, #fcfeff, #f5f9ff);
          padding: 10px;
          display: grid;
          gap: 8px;
          box-shadow: 0 10px 20px rgba(16, 43, 74, 0.06);
        }

        .output-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .output-head h4 {
          margin: 0;
        }

        .output-head span {
          font-size: 11px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #1a4f84;
          border: 1px solid #c5dbf6;
          border-radius: 999px;
          background: #edf5ff;
          padding: 4px 9px;
        }

        pre {
          margin: 0;
          white-space: pre-wrap;
          max-height: 320px;
          overflow: auto;
          border-radius: 12px;
          border: 1px solid #d7e3f6;
          background: #f4f8ff;
          padding: 12px;
          font-family: 'IBM Plex Mono', Consolas, monospace;
          font-size: 12px;
          line-height: 1.45;
          color: #173b5f;
        }

        .output-link {
          margin: 0;
          font-size: 12px;
          color: #36536f;
          overflow-wrap: anywhere;
        }

        .output-link a {
          color: #0f4f95;
          font-weight: 700;
          text-decoration: none;
        }

        .log-wrap {
          overflow: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          font-size: 13px;
        }

        th,
        td {
          text-align: left;
          border-bottom: 1px solid #e2ecf8;
          padding: 8px;
          white-space: nowrap;
        }

        @media (max-width: 1050px) {
          .request-grid {
            grid-template-columns: 1fr;
          }

          .head {
            flex-direction: column;
            align-items: flex-start;
          }

          .head-actions {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
          }

          .actor-badge {
            min-width: 0;
          }

          .status-grid {
            grid-template-columns: 1fr 1fr;
          }

          .ado-targets {
            grid-template-columns: 1fr;
          }

          .safe-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .workflow-stage-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .review-row {
            grid-template-columns: 1fr;
          }

          .safe-checklists {
            grid-template-columns: 1fr;
          }

          .output-grid {
            grid-template-columns: 1fr;
          }

          .top {
            flex-direction: column;
          }
        }

        @media (max-width: 720px) {
          .workflow-stage-grid {
            grid-template-columns: 1fr;
          }

          .safe-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
