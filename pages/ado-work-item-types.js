import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AdoWorkItemTypesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ado-work-item-types')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load ADO work item types')
      setData(json)
    } catch (err) {
      setError(String(err.message || err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <h1>ADO Work Item Types</h1>
          <p>Transparency view for process detection, strict mapping, and fallback guardrails used by backlog sync.</p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/teams">Teams</Link>
          <Link href="/scrum-master">Scrum Master</Link>
        </div>
      </header>

      <section className="panel">
        <div className="inline">
          <button onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {data ? (
          <>
            <p><strong>Organization:</strong> {data.organization}</p>
            <p><strong>Project:</strong> {data.project}</p>
            <p><strong>Detected Process:</strong> {data.processHint}</p>
            <p><strong>Generated:</strong> {data.generatedAt}</p>
          </>
        ) : null}
      </section>

      {data ? (
        <>
          <section className="panel">
            <h2>Strict Mapping</h2>
            <ul>
              <li><strong>Epic Type:</strong> {data.typeMapping?.epicType || '-'}</li>
              <li><strong>Feature Type:</strong> {data.typeMapping?.featureType || '-'}</li>
              <li><strong>Story Type:</strong> {data.typeMapping?.storyType || '-'}</li>
              <li><strong>Task Type:</strong> {data.typeMapping?.taskType || '-'}</li>
            </ul>
          </section>

          <section className="panel">
            <h2>Guardrail Warnings</h2>
            {data.guardrails?.length ? (
              <ul>
                {data.guardrails.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            ) : (
              <p>No guardrail warnings detected for current mapping.</p>
            )}
          </section>

          <section className="panel">
            <h2>Supported Types</h2>
            <div className="typeGrid">
              {(data.supportedTypes || []).map((name) => <span key={name} className="chip">{name}</span>)}
            </div>
          </section>
        </>
      ) : null}

      <style jsx>{`
        .shell {
          max-width: 980px;
          margin: 0 auto;
          padding: 24px;
          color: #11253d;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .hero h1 {
          margin: 0;
        }

        .hero p {
          margin: 6px 0 0;
          color: #3d536d;
        }

        .heroLinks {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .heroLinks :global(a) {
          text-decoration: none;
          border: 1px solid #c9dcf1;
          border-radius: 999px;
          background: #fff;
          padding: 7px 13px;
          color: #0d3a64;
          font-weight: 700;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 14px;
          background: #fff;
          padding: 12px;
          margin-bottom: 12px;
        }

        .panel h2 {
          margin: 0 0 8px;
        }

        ul {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 6px;
        }

        .inline {
          display: flex;
          gap: 8px;
        }

        button {
          border: none;
          border-radius: 9px;
          padding: 8px 12px;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error {
          color: #b91c1c;
        }

        .typeGrid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .chip {
          border: 1px solid #d6e3f4;
          border-radius: 999px;
          background: #f8fbff;
          padding: 4px 10px;
          font-size: 12px;
        }
      `}</style>
    </main>
  )
}
