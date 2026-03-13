import Link from 'next/link'

const alignmentRows = [
  {
    area: 'Conceptual framework',
    demonstrates: 'Structured mapping from SAFe activity to human role, AI role, artifacts, and governance checkpoint.',
    chapterEvidence: 'Supports Chapter 4 presentation of the conceptual model and operationalization view.',
    limitation: 'Model is a prototype mapping artifact, not proof of organizational generalization.'
  },
  {
    area: 'Sprint planning workspace',
    demonstrates: 'Integrated planning flow with backlog selection, capacity awareness, specialist outputs, and human decisions.',
    chapterEvidence: 'Supports process evidence, interaction screenshots, and walkthrough narrative for Chapter 4.',
    limitation: 'Prototype quality does not imply production throughput across all SAFe contexts.'
  },
  {
    area: 'Dependency, risk, architecture guidance',
    demonstrates: 'Specialist AI outputs for dependency detection, risk identification, and architecture recommendations.',
    chapterEvidence: 'Supports measurable recommendation and governance artifacts for evaluation discussion.',
    limitation: 'Recommendations depend on input quality and require human validation before execution.'
  },
  {
    area: 'Governance and audit visibility',
    demonstrates: 'Reviewer status tracking, rationale capture, timestamps, and audit timeline filters/export.',
    chapterEvidence: 'Supports claims of human-in-the-loop oversight and accountability traceability.',
    limitation: 'Audit completeness is bounded by captured workflow events in the prototype environment.'
  },
  {
    area: 'Evaluation evidence module',
    demonstrates: 'Session metadata, task metrics, TAM indicators, and qualitative notes with derived ratios.',
    chapterEvidence: 'Supports Chapter 4 quantitative and qualitative evidence packaging.',
    limitation: 'Collected metrics are demonstration/prototype records and should not be overgeneralized.'
  },
  {
    area: 'Exports and Chapter 4 snapshot',
    demonstrates: 'JSON/CSV evidence export for planning and evaluation artifacts.',
    chapterEvidence: 'Supports reproducible chapter appendices and supervisor review handoff.',
    limitation: 'Exports reflect available captured data; missing sessions or fields reduce evidence completeness.'
  }
]

export default function ChapterAlignmentNotesPage() {
  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <p className="eyebrow">Thesis Framing Notes</p>
          <h1>Chapter 4 and 5 Alignment Notes</h1>
          <p>
            Practical mapping of prototype features to demonstrated value, evidence support, and limitation notes
            for thesis reporting and defense discussion.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/thesis-readiness-checklist">Supervisor Readiness Checklist</Link>
          <Link href="/evaluation">Evaluation Evidence</Link>
          <Link href="/project-documentation">Documentation</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      <section className="panel">
        <h2>Feature-to-Chapter Alignment</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Prototype Area</th>
                <th>What It Demonstrates</th>
                <th>Evidence It Supports</th>
                <th>Limitation or Caution</th>
              </tr>
            </thead>
            <tbody>
              {alignmentRows.map((row) => (
                <tr key={row.area}>
                  <td><strong>{row.area}</strong></td>
                  <td>{row.demonstrates}</td>
                  <td>{row.chapterEvidence}</td>
                  <td>{row.limitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Usage Note for Defense</h2>
        <p>
          Use these notes to frame claims carefully: the prototype demonstrates feasibility and governance-aware
          decision support for SAFe sprint planning, while effectiveness claims should remain tied to captured
          evaluation evidence rather than broad production generalization.
        </p>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1240px;
          margin: 0 auto;
          padding: 24px;
          color: #12263f;
          position: relative;
          font-family: 'Sora', 'Segoe UI', sans-serif;
        }

        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 8% 10%, rgba(15, 157, 196, 0.15), transparent 43%),
            radial-gradient(circle at 84% 10%, rgba(37, 99, 235, 0.14), transparent 45%),
            linear-gradient(180deg, #f8fcff, #eef5ff 62%, #f9fcff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }

        .eyebrow {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #0a5b8a;
          font-weight: 700;
        }

        h1 {
          margin: 8px 0;
          font-size: 34px;
        }

        .hero p {
          margin: 0;
          color: #3c5670;
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
          color: #0f3d67;
          border: 1px solid #c8ddf3;
          border-radius: 999px;
          background: #fff;
          padding: 7px 12px;
          font-weight: 700;
        }

        .panel {
          border: 1px solid #d6e4f4;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
          margin-bottom: 12px;
          padding: 12px;
        }

        h2 {
          margin: 0 0 8px;
        }

        .tableWrap {
          overflow: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1060px;
        }

        th,
        td {
          border: 1px solid #d4e3f3;
          text-align: left;
          vertical-align: top;
          padding: 9px;
          font-size: 13px;
          line-height: 1.45;
        }

        th {
          background: #f3f8ff;
          color: #14385a;
          font-weight: 700;
        }

        .panel p {
          margin: 0;
          color: #3f5a75;
        }

        @media (max-width: 920px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
