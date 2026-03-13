import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function RequirementsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeItem, setActiveItem] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const controller = new AbortController()
    void fetchItems(controller.signal)
    return () => controller.abort()
  }, [])

  async function fetchItems(signal) {
    setLoading(true)
    try {
      const res = await fetch('/api/business-request', { signal })
      const json = await res.json()
      const all = json.requests || []
      const awaiting = all.filter((x) => {
        const isApproved = x.status === 'Approved' || x.status === 'approved'
        const stage1Completed = String(x.stage1_status || '') === 'Completed'
        return isApproved && stage1Completed && !x.requirement_created
      })
      setItems(awaiting)
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function openForm(item) {
    setActiveItem(item)
    setShowForm(true)
  }

  async function submitRequirement(e) {
    e.preventDefault()
    if (!activeItem) return

    const form = e.target
    const requirementDetails = {
      demand: form.demand.value,
      resourcePlanning: form.resourcePlanning.value,
      budget: form.budget.value,
      deliveryMethod: form.deliveryMethod.value,
      details: form.details.value
    }

    const fileInput = form.file
    const file = fileInput.files && fileInput.files[0]
    setSubmitting(true)

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
          id: activeItem.id,
          requirement_created: true,
          requirement_doc: uploadedUrl,
          requirement_details: JSON.stringify(requirementDetails),
          auditStage: 'Requirements',
          auditAction: 'Requirements added from requirements page'
        })
      })
      const pj = await patch.json()
      if (!patch.ok) throw new Error(pj.message || 'Update failed')

      alert('Requirement saved successfully')
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      alert('Save failed: ' + (err.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Requirements Intake</h1>
          <p>Upload requirement details and documents for approved requests that completed Stage 1 analysis.</p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/teams">Teams</Link>
        </div>
      </header>

      <section className="panel">
        <h2>Awaiting Requirements</h2>
        {loading ? <p className="muted">Loading...</p> : null}

        {!loading ? (
          items.length === 0 ? (
            <p className="muted">No awaiting items.</p>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>BR ID</th>
                    <th>Description</th>
                    <th>Unit</th>
                    <th>Team</th>
                    <th>Sprint</th>
                    <th>Epic</th>
                    <th>User Story</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.id}</td>
                      <td>{it.description}</td>
                      <td>{it.unit}</td>
                      <td>{it.team_name || '-'}</td>
                      <td>{it.sprint_name || '-'}</td>
                      <td>{it.epic_status || 'Not Created'}</td>
                      <td>{it.user_story_status || 'Not Created'}</td>
                      <td>{it.created_at || ''}</td>
                      <td>
                        <button onClick={() => openForm(it)}>Add Requirements</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>

      {showForm && activeItem ? (
        <div className="modalBack" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Requirements for {activeItem.id}</h3>
            <p className="muted"><strong>Description:</strong> {activeItem.description}</p>

            <form onSubmit={submitRequirement}>
              <label>
                Demand Information
                <textarea name="demand" rows={2} placeholder="Functional and non-functional requirements" required />
              </label>
              <label>
                Resource Planning
                <textarea name="resourcePlanning" rows={2} placeholder="Team size, skills, timeline, dependencies" required />
              </label>
              <label>
                Budget
                <input type="text" name="budget" placeholder="e.g., 50,000 - 100,000" required />
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
                <textarea name="details" rows={3} placeholder="Any additional notes or specifications" required />
              </label>
              <label>
                Upload Document (PDF or DOCX)
                <input type="file" name="file" accept=".pdf,.doc,.docx" />
              </label>

              <div className="actions">
                <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1200px;
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

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          margin-bottom: 14px;
        }

        .panel h2 {
          margin: 0 0 8px;
        }

        .muted {
          color: #4d647e;
        }

        .tableWrap {
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 940px;
          border-collapse: collapse;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
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

        button {
          border: none;
          border-radius: 9px;
          padding: 7px 10px;
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

        form {
          margin-top: 8px;
          display: grid;
          gap: 8px;
          max-height: 70vh;
          overflow: auto;
        }

        label {
          display: grid;
          gap: 4px;
          font-size: 12px;
          color: #35506b;
          font-weight: 700;
        }

        input,
        textarea,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          padding: 8px;
          font-size: 13px;
          color: #10223a;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          background: #fff;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        @media (max-width: 900px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .actions {
            flex-direction: column;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
