import { useRef, useState } from 'react'
import Link from 'next/link'
import AdoConfig from '../components/AdoConfig'

export default function BrdWorkflow() {
  const [step, setStep] = useState(1) // 1: upload, 2: preview, 3: sync, 4: results
  const [file, setFile] = useState(null)
  const [requirements, setRequirements] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState([])
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  async function uploadAndParse() {
    if (!file) {
      setError('Choose a file first')
      return
    }

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message)
        return
      }

      const parseRes = await fetch('/api/parse-brd')
      const data = await parseRes.json()
      setRequirements(data.requirements || [])
      setStep(2)
      setError('')
    } catch (err) {
      setError(String(err))
    }
  }

  async function syncToAdo() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-ado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements })
      })
      const data = await res.json()
      setSyncResults(data.results || [])
      setStep(4)
      setError('')
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>BRD to Azure DevOps Workflow</h1>
          <p>Upload BRD, extract requirement stories, configure ADO, and create backlog items.</p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/agentic-workflow">Workflow Console</Link>
        </div>
      </header>

      <section className="panel steps">
        <span className={step >= 1 ? 'active' : ''}>1. Upload</span>
        <span className={step >= 2 ? 'active' : ''}>2. Review</span>
        <span className={step >= 3 ? 'active' : ''}>3. Configure</span>
        <span className={step >= 4 ? 'active' : ''}>4. Sync Result</span>
      </section>

      {step === 1 ? (
        <section className="panel">
          <h2>Step 1: Upload BRD</h2>
          <div className="formBlock">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.doc"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            {file ? <p>Selected: {file.name}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <button onClick={uploadAndParse}>Upload and Parse BRD</button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel">
          <h2>Step 2: Review Requirements</h2>
          <p className="muted">Found {requirements.length} requirement(s).</p>

          <div className="reqGrid">
            {requirements.map((req, i) => (
              <article key={i} className="reqCard">
                <h4>{req.title}</h4>
                <p>{req.description}</p>
                {req.acceptanceCriteria?.length ? (
                  <div>
                    <strong>Acceptance Criteria</strong>
                    <ul>
                      {req.acceptanceCriteria.map((ac, j) => (
                        <li key={j}>{ac}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="actions">
            <button onClick={() => setStep(3)}>Continue to ADO Config</button>
            <button className="secondary" onClick={() => setStep(1)}>Upload Different File</button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="panel">
          <h2>Step 3: Configure ADO</h2>
          <AdoConfig />
          <div className="actions">
            <button onClick={syncToAdo} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync to ADO'}</button>
            <button className="secondary" onClick={() => setStep(2)}>Back</button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="panel">
          <h2>Step 4: Sync Results</h2>
          <div className="resultGrid">
            {syncResults.map((r, i) => (
              <article key={i} className={`resultCard ${r.status === 'Created' ? 'ok' : 'fail'}`}>
                <strong>{r.title}</strong>
                <p>{r.status === 'Created' ? `Story #${r.workItemId} created` : `Failed: ${r.error}`}</p>
              </article>
            ))}
          </div>
          <div className="summary">
            <strong>Summary:</strong> {syncResults.filter((r) => r.status === 'Created').length} of {syncResults.length} stories created.
          </div>
          <button onClick={() => setStep(1)}>Upload Another BRD</button>
        </section>
      ) : null}

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1160px;
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
            radial-gradient(circle at 10% 10%, rgba(20, 143, 180, 0.12), transparent 40%),
            radial-gradient(circle at 82% 10%, rgba(57, 118, 218, 0.14), transparent 44%),
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

        .steps {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
        }

        .steps span {
          border: 1px solid #d7e4f5;
          border-radius: 999px;
          padding: 7px 10px;
          text-align: center;
          color: #4d647e;
          background: #f8fbff;
        }

        .steps .active {
          color: #0f5f8f;
          border-color: #93c5fd;
          background: #dbeafe;
        }

        .formBlock {
          display: grid;
          gap: 10px;
        }

        .reqGrid {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }

        .reqCard {
          border: 1px solid #d7e4f5;
          border-radius: 12px;
          background: #fbfdff;
          padding: 10px;
          border-left: 4px solid #258ec4;
        }

        .reqCard h4 {
          margin: 0;
        }

        .reqCard p {
          margin: 8px 0 0;
          color: #3f5873;
          font-size: 13px;
        }

        .reqCard strong {
          font-size: 12px;
          color: #3e5671;
        }

        .reqCard ul {
          margin-top: 6px;
          font-size: 12px;
          color: #3f5873;
        }

        .actions {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
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

        input[type='file'] {
          padding: 8px;
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          background: #fff;
        }

        .resultGrid {
          display: grid;
          gap: 8px;
        }

        .resultCard {
          border: 1px solid #d7e4f5;
          border-radius: 11px;
          padding: 10px;
          background: #fff;
        }

        .resultCard.ok {
          border-left: 4px solid #10b981;
          background: #ecfdf5;
        }

        .resultCard.fail {
          border-left: 4px solid #ef4444;
          background: #fef2f2;
        }

        .resultCard p {
          margin: 6px 0 0;
          font-size: 13px;
          color: #3f5873;
        }

        .summary {
          margin-top: 10px;
          border: 1px solid #d7e4f5;
          border-radius: 10px;
          background: #f8fbff;
          padding: 10px;
          font-size: 13px;
          color: #3f5873;
        }

        .muted {
          color: #4d647e;
          font-size: 13px;
        }

        .error {
          color: #991b1b;
          font-size: 13px;
          margin-top: 6px;
        }

        @media (max-width: 900px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .steps {
            grid-template-columns: repeat(2, minmax(0, 1fr));
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
