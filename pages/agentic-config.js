import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AgenticConfigPage() {
  const [personas, setPersonas] = useState([])
  const [logs, setLogs] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      const [personaRes, logRes] = await Promise.all([
        fetch('/api/agentic/personas'),
        fetch('/api/agentic/audit-logs?limit=12')
      ])

      const personaJson = await personaRes.json()
      const logJson = await logRes.json()

      if (!personaRes.ok) throw new Error(personaJson.message || 'Failed to load personas')
      if (!logRes.ok) throw new Error(logJson.message || 'Failed to load audit logs')

      setPersonas(personaJson.personas || [])
      setLogs(logJson.logs || [])
      setMessage('Persona governance snapshot loaded')
    } catch (err) {
      setMessage(`Persona governance load failed: ${String(err.message || err)}`)
      setPersonas([])
      setLogs([])
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Persona Governance Hub</h1>
          <p>
            View runtime personas and latest governance evidence. Edit model assignments and
            system instructions in the Administrator Console.
          </p>
        </div>
        <div className="links">
          <Link href="/">Home</Link>
          <Link href="/agentic-workflow">Workflow Console</Link>
          <Link href="/administrator">Open Administrator</Link>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel">
        <div className="head">
          <h2>Active Personas</h2>
          <button onClick={() => void loadData()}>Refresh</button>
        </div>
        {personas.length === 0 ? <p className="muted">No personas found.</p> : (
          <div className="grid">
            {personas.map((persona) => (
              <article className="card" key={persona.key}>
                <div className="titleRow">
                  <strong>{persona.name || persona.key}</strong>
                  <span className={`pill ${persona.active === false ? 'bad' : 'good'}`}>
                    {persona.active === false ? 'Disabled' : 'Active'}
                  </span>
                </div>
                <p>{persona.personaTitle || 'Role not set'}</p>
                <p><strong>Model:</strong> {persona.model || '-'}</p>
                <p><strong>Key:</strong> {persona.key}</p>
                <p className="muted">{persona.description || 'No description provided.'}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Latest Audit Events</h2>
        {logs.length === 0 ? <p className="muted">No audit events available.</p> : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>BR</th>
                  <th>Stage</th>
                  <th>Actor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.br_id}</td>
                    <td>{log.stage}</td>
                    <td>{log.actor}</td>
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
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
          color: #10253b;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          position: relative;
        }

        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 10% 12%, rgba(20, 143, 180, 0.14), transparent 42%),
            radial-gradient(circle at 83% 14%, rgba(57, 118, 218, 0.14), transparent 45%),
            linear-gradient(180deg, #f7fbff, #eef4ff);
        }

        .hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        h1 {
          margin: 0;
          font-size: 33px;
        }

        .hero p {
          margin: 8px 0 0;
          color: #425a74;
          max-width: 740px;
        }

        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .links :global(a) {
          text-decoration: none;
          color: #0d3a64;
          border: 1px solid #c9dcf1;
          border-radius: 999px;
          background: #fff;
          padding: 7px 13px;
          font-weight: 700;
        }

        .banner {
          border: 1px solid #9dd8f0;
          background: #edf8ff;
          color: #134f80;
          border-radius: 10px;
          padding: 9px;
          margin-bottom: 12px;
          font-weight: 600;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
          padding: 12px;
          margin-bottom: 12px;
        }

        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        h2 {
          margin: 0;
        }

        button {
          border: none;
          border-radius: 10px;
          padding: 8px 11px;
          color: #fff;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
          font-weight: 700;
          cursor: pointer;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .card {
          border: 1px solid #d4e2f3;
          border-radius: 12px;
          background: #fbfdff;
          padding: 10px;
          display: grid;
          gap: 4px;
        }

        .titleRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .pill {
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
        }

        .pill.good {
          color: #0e6743;
          background: #e8f9ef;
          border-color: #9fd6bb;
        }

        .pill.bad {
          color: #8a2929;
          background: #fff1ef;
          border-color: #efb7b1;
        }

        .muted {
          color: #506883;
        }

        .tableWrap {
          overflow: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        th,
        td {
          text-align: left;
          border-bottom: 1px solid #e2ecf8;
          padding: 8px;
          white-space: nowrap;
        }

        @media (max-width: 980px) {
          .hero {
            flex-direction: column;
          }

          .links {
            justify-content: flex-start;
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}
