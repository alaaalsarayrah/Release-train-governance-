import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ThesisAnalyze() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/parse-thesis')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setData({ error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Thesis Analysis</h1>
          <p>Review extracted summary, abstract, table of contents, and detected chapter headings.</p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/thesis">Thesis Upload</Link>
          <button onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </header>

      {loading ? <section className="panel"><p className="muted">Parsing thesis...</p></section> : null}
      {!loading && !data ? <section className="panel"><p className="muted">No data.</p></section> : null}

      {data && data.error ? (
        <section className="panel">
          <h2>Error</h2>
          <pre className="error">{data.error}</pre>
        </section>
      ) : null}

      {data && !data.error ? (
        <section className="panel">
          <h2>Summary</h2>
          <p>{data.summary || 'Not found'}</p>

          <h2>Abstract</h2>
          <pre>{data.abstract || 'Not found'}</pre>

          <h2>Table of Contents</h2>
          <ol>
            {(data.toc || []).map((line, i) => <li key={i}>{line}</li>)}
          </ol>

          <h2>Chapters / Headings</h2>
          <ul>
            {(data.chapters || []).map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </section>
      ) : null}

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 980px;
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
          align-items: flex-start;
        }

        .heroLinks :global(a),
        .heroLinks button {
          text-decoration: none;
          color: #0d3a64;
          border: 1px solid #c9dcf1;
          border-radius: 999px;
          background: #fff;
          padding: 7px 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        .panel h2 {
          margin: 0 0 8px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .panel h2:not(:first-child) {
          margin-top: 14px;
        }

        .panel p {
          margin-top: 0;
          color: #3f5873;
          font-size: 13px;
          white-space: pre-wrap;
        }

        .panel pre {
          border: 1px solid #d7e4f5;
          border-radius: 10px;
          background: #f8fbff;
          padding: 8px;
          white-space: pre-wrap;
          font-size: 12px;
          color: #3f5873;
          margin: 0;
        }

        .panel ol,
        .panel ul {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 5px;
          color: #3f5873;
          font-size: 13px;
        }

        .error {
          color: #991b1b;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .muted {
          color: #4d647e;
          font-size: 13px;
          margin: 0;
        }

        @media (max-width: 900px) {
          .shell {
            padding: 14px;
          }

          .hero {
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
