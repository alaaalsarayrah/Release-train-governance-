import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const flowSteps = [
  'Business Request Intake',
  'Business Approval Gate',
  'AI Demand Generation',
  'Brain Review (Demand)',
  'AI BRD Draft/Submit',
  'Brain Review (BRD)',
  'Ready for Epic Scoping'
]

const pillars = [
  {
    title: 'Strategic Scope',
    points: [
      'Accelerate planning and requirement quality in SAFe-like operating models',
      'Introduce controlled AI assistance with explicit human approvals',
      'Improve delivery predictability through structured stage transitions'
    ]
  },
  {
    title: 'AI Operating Model',
    points: [
      'Brain Orchestrator governs stage progression and approvals',
      'Demand persona generates scope/risk/timeline baseline',
      'Requirement persona drafts BRD artifacts with traceability focus'
    ]
  },
  {
    title: 'Governance and Controls',
    points: [
      'Decision reasons are captured in review stages',
      'Audit trail stores actor, action, stage, and timestamps',
      'CSV/JSON evidence exports support compliance and thesis reporting'
    ]
  },
  {
    title: 'Business Outcomes',
    points: [
      'Reduced manual coordination overhead in early delivery phases',
      'Clearer handoff from demand analysis to BRD readiness',
      'Executive visibility on workflow health and operational risk'
    ]
  }
]

const roadmap = [
  { phase: 'Phase 1: Foundation', focus: 'Persona configuration, workflow state machine, core audit capture' },
  { phase: 'Phase 2: Operationalization', focus: 'ADO sync, BRD artifacts, admin controls, runtime safeguards' },
  { phase: 'Phase 3: Evaluation and Insight', focus: 'RO3 metrics, TAM capture, Chapter 4 evidence exports' },
  { phase: 'Phase 4: Scale-Up', focus: 'Enterprise hardening, expanded personas, cross-team operating model' }
]

export default function ExecutiveSummaryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    void checkAccess()
  }, [])

  async function checkAccess() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/me')
      const json = await res.json()
      const currentUser = json?.user || null
      if (!currentUser) {
        router.replace('/login?next=/administrator/executive-summary')
        return
      }
      if (String(currentUser.role || '').toLowerCase() !== 'admin') {
        router.replace('/dashboard')
        return
      }
      setUser(currentUser)
    } catch {
      router.replace('/login?next=/administrator/executive-summary')
    } finally {
      setLoading(false)
    }
  }

  const summaryStats = useMemo(() => ([
    { label: 'Core Personas', value: '3' },
    { label: 'Workflow Stages', value: String(flowSteps.length) },
    { label: 'Governance Logs', value: 'Audit + Events' },
    { label: 'Evidence Exports', value: 'CSV / JSON' }
  ]), [])

  if (loading) {
    return <main style={{ padding: 24 }}>Loading executive summary...</main>
  }

  if (!user) {
    return <main style={{ padding: 24 }}>Redirecting...</main>
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <p className="kicker">Executive View</p>
          <h1>Thesis Prototype Executive Summary</h1>
          <p className="lead">
            A high-level overview of the AI-assisted SAFe sprint planning prototype,
            governance controls, and supporting upstream modules.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/evaluation">Evaluation</Link>
          <Link href="/administrator">Administrator</Link>
          <Link href="/project-documentation">Full Handbook</Link>
          <Link href="/agentic-workflow">Supporting Workflow</Link>
          <Link href="/dashboard">Supporting Dashboard</Link>
        </div>
      </header>

      <section className="panel statsPanel">
        <h2>At a Glance</h2>
        <div className="statsGrid">
          {summaryStats.map((stat) => (
            <article key={stat.label} className="statCard">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>High-Level Scope</h2>
        <div className="pillarsGrid">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="pillarCard">
              <h3>{pillar.title}</h3>
              <ul>
                {pillar.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="panel flowPanel">
        <h2>Process Flow (Executive-Level)</h2>
        <p className="muted">Decision gates are enforced at review checkpoints by the Brain persona.</p>
        <div className="flowWrap">
          {flowSteps.map((step, index) => (
            <div key={step} className="flowNodeWrap">
              <article className="flowNode">
                <span className="stepIndex">{index + 1}</span>
                <strong>{step}</strong>
              </article>
              {index < flowSteps.length - 1 ? <span className="arrow">→</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Implementation Roadmap</h2>
        <div className="roadmapGrid">
          {roadmap.map((item) => (
            <article key={item.phase} className="roadmapCard">
              <h3>{item.phase}</h3>
              <p>{item.focus}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Executive Actions</h2>
        <div className="actionLinks">
          <Link href="/administrator">Open Admin Controls</Link>
          <Link href="/evaluation">Review Evaluation Evidence</Link>
          <a href="/api/agentic/chapter4-evidence?format=csv" target="_blank" rel="noreferrer">Download Evidence CSV</a>
          <a href="/api/agentic/audit-logs?format=csv" target="_blank" rel="noreferrer">Download Audit Trail CSV</a>
        </div>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1300px;
          margin: 0 auto;
          padding: 24px;
          color: #10223a;
          position: relative;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 10% 10%, rgba(20, 143, 180, 0.15), transparent 42%),
            radial-gradient(circle at 84% 12%, rgba(57, 118, 218, 0.14), transparent 44%),
            linear-gradient(180deg, #f6fbff, #edf3ff 60%, #f9fbff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }

        .kicker {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 12px;
          color: #0f5f8f;
          font-weight: 700;
        }

        h1 {
          margin: 8px 0 10px;
          font-size: 40px;
          line-height: 1.06;
          max-width: 900px;
        }

        .lead {
          margin: 0;
          color: #3e5671;
          max-width: 900px;
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
          border: 1px solid #d7e4f5;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          margin-bottom: 14px;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        .statsPanel {
          background:
            radial-gradient(circle at 8% 16%, rgba(20, 143, 180, 0.08), transparent 35%),
            radial-gradient(circle at 92% 14%, rgba(57, 118, 218, 0.08), transparent 34%),
            rgba(255, 255, 255, 0.94);
        }

        .panel h2 {
          margin: 0 0 10px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .statCard {
          border: 1px solid #cfe0f4;
          border-radius: 12px;
          background: #f8fbff;
          padding: 10px;
          display: grid;
          gap: 4px;
        }

        .statCard span {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #4b6682;
          font-weight: 700;
        }

        .statCard strong {
          color: #0f2741;
          font-size: 18px;
        }

        .pillarsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .pillarCard {
          border: 1px solid #d3e1f3;
          border-radius: 12px;
          background: #fbfdff;
          padding: 10px;
        }

        .pillarCard h3 {
          margin: 0 0 6px;
          font-size: 17px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        ul {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 5px;
          color: #3f5873;
          font-size: 13px;
        }

        .flowPanel .muted {
          margin: 0 0 8px;
          color: #586f88;
          font-size: 13px;
        }

        .flowWrap {
          overflow: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          padding-bottom: 4px;
        }

        .flowNodeWrap {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .flowNode {
          min-width: 210px;
          border: 1px solid #c7dcf2;
          border-radius: 12px;
          background: linear-gradient(180deg, #fafdff, #f3f9ff);
          padding: 9px;
          display: grid;
          gap: 3px;
        }

        .stepIndex {
          width: fit-content;
          border: 1px solid #bfd8f4;
          border-radius: 999px;
          background: #eaf4ff;
          color: #15527e;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
        }

        .flowNode strong {
          font-size: 13px;
          color: #163a60;
        }

        .arrow {
          color: #3a5c7d;
          font-size: 20px;
          font-weight: 700;
        }

        .roadmapGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .roadmapCard {
          border: 1px solid #d3e1f3;
          border-radius: 12px;
          background: #fbfdff;
          padding: 10px;
        }

        .roadmapCard h3 {
          margin: 0 0 6px;
          font-size: 16px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .roadmapCard p {
          margin: 0;
          color: #3f5873;
          font-size: 13px;
        }

        .actionLinks {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .actionLinks :global(a),
        .actionLinks a {
          text-decoration: none;
          border: 1px solid #c8dbf2;
          border-radius: 12px;
          background: #f8fbff;
          padding: 10px;
          color: #1b426b;
          font-weight: 700;
          text-align: center;
        }

        @media (max-width: 980px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .statsGrid,
          .pillarsGrid,
          .roadmapGrid,
          .actionLinks {
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
