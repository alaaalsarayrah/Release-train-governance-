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
    const timeoutHandle = setTimeout(() => controller.abort(), 45000)

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

  const demandOutput = parseMaybeJson(selected?.demand_output)
  const requirementDetails = parseMaybeJson(selected?.requirement_details)
  const demandReviewPending = String(selected?.demand_review_status || '').toLowerCase().includes('pending')
  const brdReviewPending = String(selected?.requirement_review_status || '').toLowerCase().includes('pending')
  const readyForScoping = String(selected?.workflow_current_stage || '').toLowerCase().includes('ready for epic scoping')

  return (
    <main className="shell">
      <div className="glow" aria-hidden="true" />
      <header className="top">
        <div>
          <h1>Agentic SDLC Workflow Console</h1>
          <p>
            Brain Orchestrator, Demander, and Business Analyst personas collaborate across demand and BRD stages.
          </p>
        </div>
        <div className="links">
          <Link href="/">Home</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/agentic-config">Persona Config</Link>
          <Link href="/evaluation">Evaluation</Link>
          <Link href="/dashboard">Dashboard</Link>
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
                </div>

                {readyForScoping ? (
                  <div className="state-note success">
                    This request is already approved and moved to Ready for Epic Scoping. No active approval action is required.
                  </div>
                ) : null}

                <div className="action-row">
                  <button
                    type="button"
                    className="miniBtn"
                    onClick={() => void runAction('generate-demand')}
                    disabled={busyAction === 'generate-demand'}
                  >
                    {busyAction === 'generate-demand' ? 'Generating Demand...' : 'Run AI_Demand'}
                  </button>

                  <button
                    type="button"
                    className="miniBtn ok"
                    onClick={() => void sendReviewDecision('review-demand', 'approve')}
                    disabled={busyAction === 'review-demand' || !demandReviewPending}
                    title={demandReviewPending ? 'Approve demand output' : `Demand review is ${selected?.demand_review_status || 'not pending'}`}
                  >
                    {busyDecision === 'review-demand:approve'
                      ? 'Approving Demand...'
                      : demandReviewPending
                        ? 'Approve Demand'
                        : 'Demand Review Closed'}
                  </button>

                  <button
                    type="button"
                    className="miniBtn bad"
                    onClick={() => void sendReviewDecision('review-demand', 'reject')}
                    disabled={busyAction === 'review-demand' || !demandReviewPending}
                    title={demandReviewPending ? 'Reject demand output' : `Demand review is ${selected?.demand_review_status || 'not pending'}`}
                  >
                    {busyDecision === 'review-demand:reject'
                      ? 'Rejecting Demand...'
                      : demandReviewPending
                        ? 'Reject Demand'
                        : 'Demand Review Closed'}
                  </button>

                  <button
                    type="button"
                    className="miniBtn"
                    onClick={() => void runAction('generate-brd')}
                    disabled={busyAction === 'generate-brd'}
                  >
                    {busyAction === 'generate-brd' ? 'Generating BRD...' : 'Generate BRD Draft'}
                  </button>

                  <button
                    type="button"
                    className="miniBtn ok"
                    onClick={() => void sendReviewDecision('review-brd', 'approve')}
                    disabled={busyAction === 'review-brd' || !brdReviewPending}
                    title={brdReviewPending ? 'Approve BRD review' : `BRD review is ${selected?.requirement_review_status || 'not pending'}`}
                  >
                    {busyDecision === 'review-brd:approve'
                      ? 'Approving BRD...'
                      : brdReviewPending
                        ? 'Approve BRD Review'
                        : 'BRD Review Closed'}
                  </button>

                  <button
                    type="button"
                    className="miniBtn bad"
                    onClick={() => void sendReviewDecision('review-brd', 'reject')}
                    disabled={busyAction === 'review-brd' || !brdReviewPending}
                    title={brdReviewPending ? 'Reject BRD review' : `BRD review is ${selected?.requirement_review_status || 'not pending'}`}
                  >
                    {busyDecision === 'review-brd:reject'
                      ? 'Rejecting BRD...'
                      : brdReviewPending
                        ? 'Reject BRD Review'
                        : 'BRD Review Closed'}
                  </button>
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
                  <div>
                    <h4>Demand Output</h4>
                    <pre>{demandOutput ? JSON.stringify(demandOutput, null, 2) : 'No demand output yet.'}</pre>
                  </div>
                  <div>
                    <h4>BRD Details</h4>
                    <pre>{requirementDetails ? JSON.stringify(requirementDetails, null, 2) : 'No BRD details yet.'}</pre>
                    {selected.requirement_doc ? (
                      <p>
                        BRD File: <a href={selected.requirement_doc} target="_blank" rel="noreferrer">{selected.requirement_doc}</a>
                      </p>
                    ) : null}
                  </div>
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

        .action-row .miniBtn {
          min-height: 42px;
          border-radius: 14px;
          font-size: 13px;
          box-shadow: 0 10px 18px rgba(20, 68, 122, 0.2);
        }

        .action-row .miniBtn:hover:not(:disabled) {
          box-shadow: 0 14px 24px rgba(20, 68, 122, 0.25);
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
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

        .action-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-bottom: 12px;
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
          gap: 10px;
          grid-template-columns: 1fr 1fr;
        }

        .output-grid h4 {
          margin: 0 0 6px;
        }

        pre {
          margin: 0;
          white-space: pre-wrap;
          max-height: 260px;
          overflow: auto;
          border-radius: 11px;
          border: 1px solid #dbe6f6;
          background: #f7fbff;
          padding: 10px;
          font-family: 'IBM Plex Mono', Consolas, monospace;
          font-size: 12px;
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

          .output-grid {
            grid-template-columns: 1fr;
          }

          .top {
            flex-direction: column;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
