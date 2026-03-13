import Link from 'next/link'

const checklistRows = [
  {
    theme: 'Conceptual framework',
    feature: 'SAFe activity, role, AI agent, artifacts, governance mapping table',
    where: '/conceptual-framework',
    evidence: 'Single-page matrix suitable for supervisor screenshots'
  },
  {
    theme: 'Sprint planning support',
    feature: 'Capacity panel, backlog selection, multi-agent planning outputs',
    where: '/sprint-planning-workspace',
    evidence: 'Explainability snapshot and specialist contribution map'
  },
  {
    theme: 'Dependency, risk, architecture guidance',
    feature: 'Dependency table + graph, risk register, architecture recommendations',
    where: '/sprint-planning-workspace#dependency-risk-architecture',
    evidence: 'Structured findings with severity and mitigation details'
  },
  {
    theme: 'Human review and governance',
    feature: 'Recommendation status tracking, decision ledger, audit filters, audit CSV',
    where: '/sprint-planning-workspace#governance-review',
    evidence: 'Reviewer, timestamp, rationale, and audit trail exports'
  },
  {
    theme: 'Evaluation evidence',
    feature: 'Session metadata, task metrics, TAM fields, qualitative notes',
    where: '/evaluation',
    evidence: 'Chapter 4 snapshot cards and detailed evidence table'
  },
  {
    theme: 'Export and Chapter 4 support',
    feature: 'Planning export center and chapter evidence API bundle',
    where: '/planning-export-center',
    evidence: 'JSON/CSV export endpoints for chapter artifacts'
  }
]

const quickChecks = [
  'If a thesis page opens empty, use the Thesis Demo load control or rely on automatic recovery to repopulate the seeded session.',
  'Confirm Sprint Planning Workspace shows a finalized thesis planning session.',
  'Confirm governance and audit filters return populated rows.',
  'Confirm evaluation records and Chapter 4 summary cards are populated.',
  'Confirm JSON and CSV exports open successfully in browser.',
  'Keep thesis upload/analysis framed as a supporting utility, not primary evidence.'
]

export default function ThesisReadinessChecklistPage() {
  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <p className="eyebrow">Supervisor Readiness</p>
          <h1>Thesis Defense Checklist</h1>
          <p>
            Concise acceptance checklist mapping visible prototype behavior to thesis themes for
            AI-assisted SAFe sprint planning.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/evaluation">Evaluation Evidence</Link>
          <Link href="/chapter-alignment-notes">Chapter 4/5 Alignment Notes</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      <section className="panel">
        <h2>Acceptance Mapping</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Thesis Theme</th>
                <th>Visible Prototype Feature</th>
                <th>Where to Demonstrate</th>
                <th>Evidence Signal</th>
              </tr>
            </thead>
            <tbody>
              {checklistRows.map((row) => (
                <tr key={row.theme}>
                  <td><strong>{row.theme}</strong></td>
                  <td>{row.feature}</td>
                  <td>{row.where}</td>
                  <td>{row.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Pre-Demo Quick Checks</h2>
        <ol>
          {quickChecks.map((item) => <li key={item}>{item}</li>)}
        </ol>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1200px;
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
          min-width: 980px;
        }

        th,
        td {
          border: 1px solid #d4e3f3;
          text-align: left;
          vertical-align: top;
          padding: 9px;
          font-size: 13px;
          line-height: 1.4;
        }

        th {
          background: #f3f8ff;
          color: #14385a;
          font-weight: 700;
        }

        ol {
          margin: 0;
          padding-left: 20px;
          display: grid;
          gap: 6px;
          color: #3f5a75;
          font-size: 14px;
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
