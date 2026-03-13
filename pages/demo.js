import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const ScrumAgent = dynamic(() => import('../components/ScrumAgent'), { ssr: false })

const demoSteps = [
  {
    title: '1) Sprint and Team Setup',
    description: 'Establish the team context and sprint boundaries used during the planning run.',
    href: '/teams',
    cta: 'Open Team Setup'
  },
  {
    title: '2) Backlog Preparation',
    description: 'Use supporting demand and BRD governance stages to prepare backlog inputs and traceability.',
    href: '/agentic-workflow',
    cta: 'Open Supporting Workflow'
  },
  {
    title: '3) Conceptual Framework Briefing',
    description: 'Use the supervisor-facing map to explain roles, agents, artifacts, and governance points in under 30 seconds.',
    href: '/conceptual-framework',
    cta: 'Open Conceptual Framework'
  },
  {
    title: '4) SAFe Sprint Planning',
    description: 'Run specialist planning agents, compare estimates, and apply human review decisions.',
    href: '/sprint-planning-workspace',
    cta: 'Open Sprint Planning Workspace'
  },
  {
    title: '5) Dependencies, Risks, and Architecture Guidance',
    description: 'Inspect dependency graph, risk register, and architecture notes, then export evidence bundles.',
    href: '/planning-export-center',
    cta: 'Open Planning Export Center'
  },
  {
    title: '6) Evaluation Evidence',
    description: 'Capture TAM and scenario metrics for the thesis evaluation chapter.',
    href: '/evaluation',
    cta: 'Open Evaluation Console'
  }
]

export default function DemoPage() {
  const [busyAction, setBusyAction] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    void loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const res = await fetch('/api/demo-data')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load demo status')
      setStatus(json.status || null)
    } catch (err) {
      setMessage(`Status load failed: ${String(err?.message || err)}`)
    }
  }

  async function runDemoAction(action) {
    if (action === 'reset') {
      const confirmed = window.confirm('Reset demo data to default baseline? This clears planning and evaluation records.')
      if (!confirmed) return
    }

    setBusyAction(action)
    setMessage('')
    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, profile: 'thesis-demo' })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Demo data operation failed')

      setStatus(json.status || null)
      if (action === 'load') {
        setMessage('Thesis demo data loaded successfully. Planning, dependencies, risks, architecture, scenarios, and evaluation evidence are ready.')
      } else {
        setMessage('Demo data reset to default baseline. Use Load Thesis Demo Data to restore the full thesis scenario.')
      }
    } catch (err) {
      setMessage(`Demo data action failed: ${String(err?.message || err)}`)
    } finally {
      setBusyAction('')
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Thesis Demo Flow: AI-Assisted SAFe Sprint Planning</h1>
          <p>
            Guided demonstration path for supervisor review, from setup and backlog preparation to planning decisions,
            governance evidence, and evaluation outcomes.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/conceptual-framework">Conceptual Framework</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/evaluation">Evaluation Evidence</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel seedPanel">
        <div>
          <h2>Deterministic Demo Data Controls</h2>
          <p className="muted">
            Use these controls before supervisor walkthroughs to guarantee consistent, non-empty thesis evidence across planning and evaluation pages.
          </p>
        </div>
        <div className="seedActions">
          <button
            type="button"
            onClick={() => void runDemoAction('load')}
            disabled={Boolean(busyAction)}
          >
            {busyAction === 'load' ? 'Loading...' : 'Load Thesis Demo Data'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void runDemoAction('reset')}
            disabled={Boolean(busyAction)}
          >
            {busyAction === 'reset' ? 'Resetting...' : 'Reset Demo Data'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => void loadStatus()}
            disabled={Boolean(busyAction)}
          >
            Refresh Status
          </button>
        </div>

        {status ? (
          <div className="seedStats">
            <span>Profile: {status.activeProfile?.profile || '-'}</span>
            <span>Action: {status.activeProfile?.lastAction || '-'}</span>
            <span>Backlog Items: {status.fileData?.backlogItems ?? 0}</span>
            <span>Teams: {status.fileData?.teams ?? 0}</span>
            <span>Sprints: {status.fileData?.sprints ?? 0}</span>
            <span>Planning Sessions: {status.dbData?.counts?.planning_sessions ?? 0}</span>
            <span>Dependencies: {status.dbData?.counts?.planning_dependency_records ?? 0}</span>
            <span>Risks: {status.dbData?.counts?.planning_risk_records ?? 0}</span>
            <span>Scenario Runs: {status.dbData?.counts?.planning_scenario_runs ?? 0}</span>
            <span>Evaluations: {status.dbData?.counts?.thesis_evaluations ?? 0}</span>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Supervisor Walkthrough</h2>
        <div className="pathGrid">
          {demoSteps.map((step) => (
            <article key={step.title} className="stepCard">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <Link href={step.href}>{step.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Optional Facilitation Sandbox</h2>
        <p className="muted">Use this optional sandbox to demonstrate conversational sprint facilitation behavior.</p>
        <ScrumAgent />
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1100px;
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
          max-width: 760px;
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

        .banner {
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          background: #eff6ff;
          color: #1e3a8a;
          padding: 9px 11px;
          margin-bottom: 12px;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          font-size: 13px;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          margin-bottom: 12px;
        }

        .panel h2 {
          margin: 0 0 10px;
        }

        .seedPanel {
          display: grid;
          gap: 10px;
        }

        .seedActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .seedActions button {
          border: none;
          border-radius: 10px;
          padding: 9px 12px;
          background: #1d4ed8;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .seedActions button.secondary {
          background: #0f766e;
        }

        .seedActions button.ghost {
          background: #dbeafe;
          color: #1e3a8a;
        }

        .seedActions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .seedStats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .seedStats span {
          border: 1px solid #cadcf1;
          border-radius: 10px;
          padding: 8px;
          background: #f8fbff;
          font-size: 12px;
          color: #163c65;
        }

        .pathGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .stepCard {
          border: 1px solid #cadcf1;
          border-radius: 12px;
          background: linear-gradient(180deg, #fbfdff, #f4f8ff);
          padding: 12px;
          display: grid;
          gap: 8px;
        }

        .stepCard h3 {
          margin: 0;
          font-size: 15px;
          color: #12365d;
        }

        .stepCard p {
          margin: 0;
          font-size: 13px;
          color: #3d536d;
          line-height: 1.4;
        }

        .stepCard :global(a) {
          text-decoration: none;
          color: #0d3a64;
          font-weight: 700;
        }

        .muted {
          margin: 0 0 10px;
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

          .pathGrid {
            grid-template-columns: 1fr;
          }

          .seedStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
         }
       `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
     </main>
   )
 }
