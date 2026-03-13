import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function SDLCFlow() {
  const [showForm, setShowForm] = useState(false)
  const [generatedId, setGeneratedId] = useState('')
  const [metrics, setMetrics] = useState({
    pendingApproval: 0,
    demandPendingBrainReview: 0,
    brdPendingBrainReview: 0
  })
  const businessUnits = ['Sales', 'HR', 'Engineering', 'Finance', 'Marketing']
  const router = useRouter()

  async function submitForm(e) {
    e.preventDefault()
    const form = e.target
    const data = {
      brid: form.brid.value,
      description: form.description.value,
      unit: form.unit.value,
      urgency: form.urgency.value,
      date: form.date.value,
      justif: form.justif.value
    }
    try {
      const res = await fetch('/api/business-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Request save failed')
      alert('Business request created successfully.')
      await refreshMetrics()
      setShowForm(false)
    } catch (err) {
      alert(`Creation failed: ${err.message || err}`)
    }
  }

  async function refreshMetrics() {
    try {
      const res = await fetch('/api/business-request')
      const json = await res.json()
      const all = json.requests || []

      setMetrics({
        pendingApproval: all.filter((x) => (x.status || 'Pending') === 'Pending').length,
        demandPendingBrainReview: all.filter((x) => String(x.demand_review_status || '') === 'Pending Brain Review').length,
        brdPendingBrainReview: all.filter((x) => String(x.requirement_review_status || '') === 'Pending Brain Review').length
      })
    } catch (err) {
      console.error('Failed to refresh SDLC metrics', err)
    }
  }

  useEffect(() => {
    void refreshMetrics()
    const interval = setInterval(() => {
      void refreshMetrics()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const phases = [
    { label: 'Business Request', icon: 'BR', accent: '#2f7ac4' },
    { label: 'Demand Analysis (AI_Demand)', icon: 'DM', accent: '#1480a7' },
    { label: 'Brain Review: Demand', icon: 'RV', accent: '#e98537' },
    { label: 'BRD Draft (AI_Requirement)', icon: 'BA', accent: '#25796b' },
    { label: 'Brain Review: BRD', icon: 'RV', accent: '#a367d9' },
    { label: 'Backlog Ready for Sprint Planning', icon: 'SP', accent: '#3d6ad4' }
  ]

  return (
    <div className="flow-shell">
      <div className="hero-block">
        <div>
          <h2>Supporting Upstream Workflow (Demand and BRD)</h2>
          <p>
            Optional upstream path that prepares and governs demand and BRD artifacts before entering
            the primary SAFe sprint planning thesis workspace.
          </p>
        </div>
        <div className="hero-actions">
          <button onClick={() => { setGeneratedId(`BR-${Date.now()}`); setShowForm(true) }}>Create Business Request</button>
          <button onClick={() => router.push('/agentic-workflow')}>Open Supporting Workflow</button>
        </div>
      </div>

      <section className="lane">
        {phases.map((phase) => (
          <div key={phase.label} className="phase-card" style={{ '--accent': phase.accent }}>
            <span className="phase-icon">{phase.icon}</span>
            <span className="phase-label">{phase.label}</span>
          </div>
        ))}
      </section>

      <section className="metrics">
        <article>
          <h4>Pending Approval</h4>
          <p>{metrics.pendingApproval}</p>
        </article>
        <article>
          <h4>Demand Awaiting Brain</h4>
          <p>{metrics.demandPendingBrainReview}</p>
        </article>
        <article>
          <h4>BRD Awaiting Brain</h4>
          <p>{metrics.brdPendingBrainReview}</p>
        </article>
      </section>

      {showForm ? (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Business Request</h3>
            <form onSubmit={submitForm}>
              <label>
                BR ID
                <input name="brid" value={generatedId} readOnly />
              </label>
              <label>
                Description
                <textarea name="description" rows={3} required />
              </label>
              <label>
                Business Unit
                <select name="unit" required>
                  <option value="">Select unit</option>
                  {businessUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label>
                Urgency
                <select name="urgency" defaultValue="Medium">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </label>
              <label>
                Desired Date
                <input type="date" name="date" />
              </label>
              <label>
                Justification
                <textarea name="justif" rows={2} />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .flow-shell {
          --ink: #12253d;
          --muted: #4a6078;
          --line: #d9e3ef;
          width: 100%;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          color: var(--ink);
          display: grid;
          gap: 14px;
        }

        .hero-block {
          border: 1px solid var(--line);
          background:
            radial-gradient(circle at top right, rgba(34, 157, 197, 0.15), transparent 45%),
            radial-gradient(circle at bottom left, rgba(94, 118, 224, 0.15), transparent 45%),
            #fbfdff;
          border-radius: 16px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
        }

        .hero-block h2 {
          margin: 0 0 8px;
          font-size: 30px;
        }

        .hero-block p {
          margin: 0;
          color: var(--muted);
          max-width: 760px;
        }

        .hero-actions {
          display: grid;
          gap: 8px;
          min-width: 220px;
        }

        .hero-actions button,
        .modal-actions button {
          border: none;
          border-radius: 10px;
          padding: 8px 10px;
          color: #fff;
          font-weight: 700;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
          cursor: pointer;
        }

        .lane {
          border: 1px solid var(--line);
          border-radius: 16px;
          background: #fff;
          padding: 14px;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
        }

        .phase-card {
          border: 1px solid color-mix(in srgb, var(--accent) 34%, white);
          background: color-mix(in srgb, var(--accent) 8%, white);
          border-radius: 12px;
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .phase-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: #fff;
          background: var(--accent);
          font-size: 11px;
          font-weight: 700;
        }

        .phase-label {
          font-size: 12px;
          line-height: 1.35;
          color: #22354d;
          font-weight: 700;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .metrics article {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 10px;
          background: #fff;
        }

        .metrics h4 {
          margin: 0;
          font-size: 13px;
          color: var(--muted);
        }

        .metrics p {
          margin: 6px 0 0;
          font-size: 25px;
          font-weight: 700;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(4, 14, 23, 0.45);
          display: grid;
          place-items: center;
          z-index: 999;
          padding: 16px;
        }

        .modal {
          width: min(620px, 100%);
          border-radius: 14px;
          border: 1px solid var(--line);
          background: #fff;
          padding: 14px;
        }

        .modal h3 {
          margin: 0 0 10px;
        }

        form {
          display: grid;
          gap: 8px;
        }

        label {
          display: grid;
          gap: 4px;
          font-size: 12px;
          font-weight: 700;
          color: #35506b;
        }

        input,
        textarea,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #c4d5eb;
          border-radius: 9px;
          padding: 8px;
          color: #12253d;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        .modal-actions {
          margin-top: 4px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        @media (max-width: 1020px) {
          .hero-block {
            flex-direction: column;
          }

          .hero-actions {
            width: 100%;
            min-width: 0;
          }

          .lane {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .metrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </div>
  )
}
