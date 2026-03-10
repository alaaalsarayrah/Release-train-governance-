import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

function requestStatusMeta(status) {
  const normalized = String(status || 'Pending').toLowerCase()
  if (normalized === 'approved') return { label: 'Approved', tone: 'good' }
  if (normalized === 'rejected') return { label: 'Rejected', tone: 'bad' }
  return { label: 'Pending', tone: 'warn' }
}

function stageStatusMeta(status) {
  const normalized = String(status || 'Not Started').toLowerCase()
  if (normalized === 'completed') return { label: 'Completed', tone: 'good' }
  if (normalized === 'running') return { label: 'Running', tone: 'warn' }
  if (normalized === 'failed') return { label: 'Failed', tone: 'bad' }
  return { label: 'Not Started', tone: 'muted' }
}

export default function Dashboard() {
  const [requests, setRequests] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sessionIdentity, setSessionIdentity] = useState(null)
  const [reqModalOpen, setReqModalOpen] = useState(false)
  const [reqActive, setReqActive] = useState(null)
  const [reqSubmitting, setReqSubmitting] = useState(false)
  const [stage1RunningId, setStage1RunningId] = useState(null)
  const [streamBrId, setStreamBrId] = useState('')
  const [streamEvents, setStreamEvents] = useState([])
  const streamRef = useRef(null)

  const actorLabel = sessionIdentity
    ? sessionIdentity.role
      ? `${sessionIdentity.name} (${sessionIdentity.role})`
      : sessionIdentity.name
    : 'Workflow Operator'

  async function loadSessionIdentity() {
    try {
      const res = await fetch('/api/session-identity')
      const json = await res.json()
      setSessionIdentity(json.identity || null)
    } catch {
      setSessionIdentity(null)
    }
  }

  async function loadRequests(signal) {
    const res = await fetch('/api/business-request', signal ? { signal } : undefined)
    const json = await res.json()
    setRequests(json.requests || [])
  }

  function disconnectEventStream() {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
  }

  function connectEventStream(brId) {
    disconnectEventStream()
    setStreamBrId(brId)
    setStreamEvents([])

    const source = new EventSource(`/api/orchestrator/events-stream?brId=${encodeURIComponent(brId)}`)
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        setStreamEvents((prev) => [...prev, payload])
      } catch {
        // Ignore malformed events to keep the stream alive.
      }
    }

    source.onerror = () => {
      // Browser auto-retries SSE unless closed.
    }

    streamRef.current = source
  }

  useEffect(() => {
    const controller = new AbortController()
    loadRequests(controller.signal)
      .then(() => setLoading(false))
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(String(e))
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    void loadSessionIdentity()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      void loadRequests()
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      disconnectEventStream()
    }
  }, [])

  const displayedRequests = (requests || []).filter((row) => {
    if (statusFilter === 'All') return true
    return String(row.status || 'Pending') === statusFilter
  })

  const summary = useMemo(() => {
    const rows = requests || []
    return {
      total: rows.length,
      pending: rows.filter((r) => String(r.status || 'Pending') === 'Pending').length,
      approved: rows.filter((r) => String(r.status || '') === 'Approved').length,
      rejected: rows.filter((r) => String(r.status || '') === 'Rejected').length,
      stage1Running: rows.filter((r) => String(r.stage1_status || '') === 'Running').length,
      stage1Done: rows.filter((r) => String(r.stage1_status || '') === 'Completed').length
    }
  }, [requests])

  async function updateRequest(id, status, reason = '') {
    try {
      await fetch('/api/business-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          decision_reason: reason,
          actor: actorLabel,
          auditStage: 'Business Approval',
          auditAction: status === 'Approved' ? 'Business request approved' : 'Business request rejected'
        })
      })
      await loadRequests()
    } catch (e) {
      console.error(e)
    }
  }

  async function runStage1(id) {
    setStage1RunningId(id)
    connectEventStream(id)

    try {
      const response = await fetch('/api/orchestrator/stage1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, actor: actorLabel })
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.message || 'Stage 1 failed')
      }

      await loadRequests()
      alert('Stage 1 completed successfully')
    } catch (err) {
      console.error(err)
      alert('Stage 1 failed: ' + (err.message || err))
      await loadRequests()
    } finally {
      setStage1RunningId(null)
    }
  }

  function rejectRequest(id) {
    const reason = prompt('Enter rejection reason:')
    if (reason !== null) void updateRequest(id, 'Rejected', reason)
  }

  function openReqForm(item) {
    setReqActive(item)
    setReqModalOpen(true)
  }

  async function submitRequirement(e) {
    e.preventDefault()
    if (!reqActive) return

    const form = e.target
    const requirementDetails = {
      demand: form.demand?.value || '',
      resourcePlanning: form.resourcePlanning?.value || '',
      budget: form.budget?.value || '',
      deliveryMethod: form.deliveryMethod?.value || '',
      details: form.details?.value || ''
    }

    const fileInput = form.file
    const file = fileInput.files && fileInput.files[0]
    setReqSubmitting(true)

    try {
      let uploadedUrl = null
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const uj = await up.json()
        if (!up.ok) throw new Error(uj.message || 'Upload failed')
        uploadedUrl = uj.url
      }

      const patch = await fetch('/api/business-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reqActive.id,
          requirement_created: true,
          requirement_doc: uploadedUrl,
          requirement_details: JSON.stringify(requirementDetails),
          actor: actorLabel,
          auditStage: 'Requirements',
          auditAction: 'Requirements submitted from dashboard'
        })
      })
      const pj = await patch.json()
      if (!patch.ok) throw new Error(pj.message || 'Update failed')

      setReqModalOpen(false)
      setReqActive(null)
      await loadRequests()
    } catch (err) {
      console.error(err)
      alert('Save failed: ' + (err.message || err))
    } finally {
      setReqSubmitting(false)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Business Request Operations</h1>
          <p>
            Approve incoming requests, run Stage 1 orchestration, and monitor execution in real time.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/agentic-workflow">Workflow Console</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/agentic-config">Personas & Audit</Link>
          <Link href="/evaluation">Evaluation</Link>
          <Link href="/teams">Teams</Link>
        </div>
      </header>

      {loading ? <div className="notice">Loading business requests...</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      {requests ? (
        <>
          <section className="summaryGrid">
            <article>
              <h3>Total Requests</h3>
              <p>{summary.total}</p>
            </article>
            <article>
              <h3>Pending</h3>
              <p>{summary.pending}</p>
            </article>
            <article>
              <h3>Approved</h3>
              <p>{summary.approved}</p>
            </article>
            <article>
              <h3>Rejected</h3>
              <p>{summary.rejected}</p>
            </article>
            <article>
              <h3>Stage 1 Running</h3>
              <p>{summary.stage1Running}</p>
            </article>
            <article>
              <h3>Stage 1 Complete</h3>
              <p>{summary.stage1Done}</p>
            </article>
          </section>

          <section className="panel">
            <div className="toolbar">
              <div className="filterWrap">
                <label htmlFor="statusFilter">Status Filter</label>
                <select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="filterWrap">
                <label>Session Actor</label>
                <div className="identityBadge">
                  <span>{actorLabel}</span>
                  <span className="identityHint">Managed in Administrator</span>
                </div>
              </div>

              <div className="feedState">
                <span className="feedLabel">Live Feed</span>
                <strong>{streamBrId ? streamBrId : 'Off'}</strong>
              </div>
            </div>

            <div className="tableWrap">
              <table className="gridTable">
                <thead>
                  <tr>
                    <th>BR ID</th>
                    <th>Description</th>
                    <th>Unit</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Requirements</th>
                    <th>Team</th>
                    <th>Sprint</th>
                    <th>Epic</th>
                    <th>User Story</th>
                    <th>Decision</th>
                    <th>Stage 1</th>
                    <th>Stage 1 ADO</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRequests.map((r) => {
                    const status = requestStatusMeta(r.status)
                    const stage1 = stageStatusMeta(r.stage1_status)
                    const requirementPending =
                      (r.status === 'Approved' || r.status === 'approved') && !r.requirement_created

                    return (
                      <tr key={r.id}>
                        <td>
                          <Link className="idLink" href={`/br-details/${encodeURIComponent(r.id)}`}>
                            {r.id}
                          </Link>
                        </td>
                        <td>{r.description}</td>
                        <td>{r.unit}</td>
                        <td>{r.urgency}</td>
                        <td>
                          <span className={`pill ${status.tone}`}>{status.label}</span>
                        </td>
                        <td>
                          {r.requirement_created ? (
                            <span className="pill good">Completed</span>
                          ) : requirementPending ? (
                            <span className="pill warn">Awaiting</span>
                          ) : (
                            <span className="pill muted">-</span>
                          )}
                        </td>
                        <td>{r.team_name || '-'}</td>
                        <td>{r.sprint_name || '-'}</td>
                        <td>{r.epic_status || 'Not Created'}</td>
                        <td>{r.user_story_status || 'Not Created'}</td>
                        <td className="decisionCell">{r.decision_reason || '-'}</td>
                        <td>
                          <span className={`pill ${stage1.tone}`}>{stage1.label}</span>
                        </td>
                        <td>{r.stage1_ado_work_item_id || '-'}</td>
                        <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                        <td>
                          <div className="actionCol">
                            {r.status === 'Pending' ? (
                              <>
                                <button
                                  className="miniBtn ok"
                                  onClick={() => void updateRequest(r.id, 'Approved')}
                                  title="Approve"
                                  aria-label={`Approve ${r.id}`}
                                >
                                  Approve Request
                                </button>
                                <button
                                  className="miniBtn bad"
                                  onClick={() => rejectRequest(r.id)}
                                  title="Reject"
                                  aria-label={`Reject ${r.id}`}
                                >
                                  Reject Request
                                </button>
                              </>
                            ) : null}

                            {requirementPending ? (
                              <>
                                {String(r.stage1_status || 'Not Started') === 'Completed' ? (
                                  <button className="miniBtn" onClick={() => openReqForm(r)}>
                                    Add Requirements
                                  </button>
                                ) : (
                                  <button
                                    className="miniBtn"
                                    onClick={() => void runStage1(r.id)}
                                    disabled={
                                      stage1RunningId === r.id ||
                                      String(r.stage1_status || '') === 'Running'
                                    }
                                  >
                                    {stage1RunningId === r.id || String(r.stage1_status || '') === 'Running'
                                      ? 'Running Stage 1...'
                                      : 'Run Stage 1'}
                                  </button>
                                )}

                                <button className="miniBtn secondary" onClick={() => connectEventStream(r.id)}>
                                  Watch Feed
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {streamBrId ? (
        <section className="panel feedPanel">
          <div className="feedHead">
            <h3>Real-Time Orchestrator Feed: {streamBrId}</h3>
            <button
              className="miniBtn secondary"
              onClick={() => {
                disconnectEventStream()
                setStreamBrId('')
                setStreamEvents([])
              }}
            >
              Close Feed
            </button>
          </div>

          {streamEvents.length === 0 ? (
            <p className="muted">Waiting for events...</p>
          ) : (
            <div className="eventList">
              {streamEvents.map((event) => (
                <article key={event.id} className="eventItem">
                  <div className="eventMeta">
                    #{event.id} | {event.stage} | {event.event_type} |{' '}
                    {new Date(event.created_at).toLocaleTimeString()}
                  </div>
                  <div>{event.message}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {reqModalOpen && reqActive ? (
        <div className="modalBack" onClick={() => setReqModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Requirements for {reqActive.id}</h3>
            <p className="descLine">
              <strong>Description:</strong> {reqActive.description}
            </p>

            <form onSubmit={submitRequirement}>
              <label>
                Demand Information
                <textarea
                  name="demand"
                  rows={2}
                  placeholder="Functional and non-functional requirements"
                  required
                />
              </label>

              <label>
                Resource Planning
                <textarea
                  name="resourcePlanning"
                  rows={2}
                  placeholder="Team size, skills, timeline, dependencies"
                  required
                />
              </label>

              <label>
                Budget
                <input
                  type="text"
                  name="budget"
                  placeholder="e.g., 50,000 - 100,000"
                  required
                />
              </label>

              <label>
                Delivery Method
                <select name="deliveryMethod" required>
                  <option value="">Select delivery method</option>
                  <option value="Waterfall">Waterfall</option>
                  <option value="Agile">Agile</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </label>

              <label>
                Additional Details
                <textarea
                  name="details"
                  rows={3}
                  placeholder="Any additional notes or specifications"
                  required
                />
              </label>

              <label>
                Upload Document (PDF or DOCX)
                <input type="file" name="file" accept=".pdf,.doc,.docx" />
              </label>

              <div className="modalActions">
                <button
                  type="button"
                  className="miniBtn secondary"
                  onClick={() => setReqModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="miniBtn" disabled={reqSubmitting}>
                  {reqSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
            radial-gradient(circle at 14% 8%, rgba(20, 143, 180, 0.13), transparent 42%),
            radial-gradient(circle at 84% 16%, rgba(57, 118, 218, 0.14), transparent 46%),
            linear-gradient(180deg, #f8fbff, #eef4ff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 14px;
        }

        .hero h1 {
          margin: 0;
          font-size: 33px;
        }

        .hero p {
          margin: 8px 0 0;
          color: #3d536d;
          max-width: 820px;
        }

        .heroLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
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

        .notice {
          border: 1px solid #8be1dc;
          background: #ecfeff;
          color: #134e4a;
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 12px;
        }

        .notice.error {
          border-color: #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-bottom: 12px;
        }

        .summaryGrid article {
          border: 1px solid #d6e3f4;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 12px 30px rgba(17, 24, 39, 0.06);
          padding: 11px;
        }

        .summaryGrid h3 {
          margin: 0;
          font-size: 13px;
          color: #3d536d;
        }

        .summaryGrid p {
          margin: 5px 0 0;
          font-size: 28px;
          font-weight: 700;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          margin-bottom: 14px;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .filterWrap {
          display: grid;
          gap: 4px;
        }

        .filterWrap label {
          font-size: 12px;
          color: #48617d;
          font-weight: 700;
        }

        .feedState {
          border: 1px solid #d6e3f4;
          border-radius: 10px;
          background: #f8fbff;
          padding: 8px 10px;
          display: grid;
          align-content: center;
          min-width: 150px;
        }

        .identityBadge {
          min-height: 36px;
          border: 1px solid #d6e3f4;
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

        .identityHint {
          color: #4e6680;
          font-size: 11px;
          font-weight: 700;
        }

        .feedLabel {
          font-size: 11px;
          color: #4e6680;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        select,
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

        .tableWrap {
          overflow: auto;
        }

        .gridTable {
          width: 100%;
          min-width: 1300px;
          border-collapse: collapse;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          font-size: 13px;
        }

        .gridTable th {
          text-align: left;
          padding: 10px 8px;
          border-bottom: 1px solid #dce8f6;
          color: #344d69;
          font-weight: 700;
          background: #f7fbff;
        }

        .gridTable td {
          border-bottom: 1px solid #e8eff9;
          padding: 9px 8px;
          vertical-align: top;
        }

        .gridTable tbody tr:hover {
          background: #fafdff;
        }

        .idLink {
          color: #0b4c8f;
          text-decoration: none;
          font-weight: 700;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 2px 9px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
        }

        .pill.good {
          color: #0f5b3f;
          background: #dcfce7;
          border-color: #86efac;
        }

        .pill.bad {
          color: #7f1d1d;
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .pill.warn {
          color: #854d0e;
          background: #fef3c7;
          border-color: #fcd34d;
        }

        .pill.muted {
          color: #475569;
          background: #e2e8f0;
          border-color: #cbd5e1;
        }

        .decisionCell {
          max-width: 260px;
          white-space: normal;
          color: #3d536d;
        }

        .actionCol {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .miniBtn {
          border: none;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          font-weight: 700;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
        }

        .miniBtn.ok {
          background: linear-gradient(135deg, #0f9f4c, #0b8151);
        }

        .miniBtn.bad {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
        }

        .miniBtn {
          padding: 6px 10px;
          font-size: 12px;
        }

        .miniBtn.secondary {
          background: linear-gradient(135deg, #475569, #334155);
        }

        .miniBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .feedPanel h3 {
          margin: 0;
          font-size: 20px;
        }

        .feedHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .eventList {
          max-height: 290px;
          overflow: auto;
          display: grid;
          gap: 8px;
        }

        .eventItem {
          border: 1px solid #d8e4f5;
          border-radius: 10px;
          background: #f8fbff;
          padding: 8px 10px;
        }

        .eventMeta {
          color: #586f88;
          font-size: 11px;
          margin-bottom: 3px;
        }

        .muted {
          color: #586f88;
        }

        .modalBack {
          position: fixed;
          inset: 0;
          background: rgba(4, 14, 23, 0.45);
          display: grid;
          place-items: center;
          z-index: 999;
          padding: 16px;
          overflow: auto;
        }

        .modal {
          width: min(760px, 100%);
          border: 1px solid #d8e4f5;
          border-radius: 14px;
          background: #fff;
          padding: 14px;
        }

        .modal h3 {
          margin: 0;
        }

        .descLine {
          margin: 6px 0 10px;
          color: #4b647f;
          font-size: 13px;
        }

        form {
          display: grid;
          gap: 9px;
          max-height: 70vh;
          overflow: auto;
        }

        label {
          display: grid;
          gap: 4px;
          color: #35506b;
          font-size: 12px;
          font-weight: 700;
        }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        @media (max-width: 1180px) {
          .summaryGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 920px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .heroLinks {
            justify-content: flex-start;
          }

          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .toolbar {
            flex-direction: column;
            align-items: flex-start;
          }

          .feedState {
            width: 100%;
            min-width: 0;
          }

          .feedHead {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
