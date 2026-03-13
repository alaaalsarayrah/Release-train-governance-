import Link from 'next/link'

export default function Bibliography() {
  const entries = [
    {
      id: 1,
      cite: 'Castelvecchi, D. (2023). Agentic AI systems.',
      note: 'Discussion of agency and autonomous decision-making in AI.'
    },
    {
      id: 2,
      cite: 'Schwaber, K., & Sutherland, J. (2020). The Scrum Guide.',
      note: 'Core Scrum principles and role descriptions.'
    },
    {
      id: 3,
      cite: 'Amershi, S. et al. (2019). Guidelines for human-AI interaction.',
      note: 'Design patterns for collaborative AI systems.'
    }
  ]

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Bibliography and Selected Readings</h1>
          <p>Starter references for your thesis corpus. Expand this list with final literature review citations.</p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/thesis-analyze">Thesis Analysis</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </header>

      <section className="panel">
        <ol>
          {entries.map((entry) => (
            <li key={entry.id}>
              <article className="entry">
                <strong>{entry.cite}</strong>
                <p>{entry.note}</p>
              </article>
            </li>
          ))}
        </ol>
      </section>

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
        }

        ol {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 10px;
        }

        .entry {
          border: 1px solid #d7e4f5;
          border-radius: 12px;
          background: #fbfdff;
          padding: 10px;
        }

        .entry strong {
          color: #1b3f66;
          font-size: 14px;
        }

        .entry p {
          margin: 8px 0 0;
          color: #4d647e;
          font-size: 13px;
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
