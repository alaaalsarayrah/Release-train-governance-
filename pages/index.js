import { useEffect, useState } from 'react'
import Link from 'next/link'
import SDLCFlow from '../components/SDLCFlow'

export default function Home() {
  const [identity, setIdentity] = useState(null)
  const adminEntryHref = '/login?next=/administrator'

  const primaryLinks = [
    {
      href: '/thesis-demo',
      title: 'Thesis Demo Flow',
      desc: 'Guided end-to-end walkthrough for supervisor review.'
    },
    {
      href: '/conceptual-framework',
      title: 'Conceptual Framework',
      desc: '30-second SAFe-Agentic AI mapping for supervisor-facing explanation.'
    },
    {
      href: '/sprint-planning-workspace',
      title: 'SAFe Sprint Planning Workspace',
      desc: 'Primary prototype workspace for planning, estimation, dependencies, risks, and architecture guidance.'
    },
    {
      href: '/evaluation',
      title: 'Evaluation Evidence Console',
      desc: 'Capture TAM and scenario data to support thesis findings.'
    },
    {
      href: '/planning-export-center',
      title: 'Planning Export Center',
      desc: 'Generate governed JSON/CSV evidence for review and reporting.'
    }
  ]

  const supportingLinks = [
    { href: '/agentic-workflow', title: 'Supporting Workflow Console', desc: 'Demand and BRD governance stages that feed sprint planning inputs.' },
    { href: '/dashboard', title: 'Supporting Demand Intake Dashboard', desc: 'Approve business requests and monitor upstream status.' },
    { href: '/teams', title: 'Team and Sprint Setup', desc: 'Configure squads and sprint definitions used in planning runs.' },
    { href: '/brd-workflow', title: 'BRD to ADO Workflow', desc: 'Optional requirements-to-backlog assistive path.' },
    { href: '/scrum-master', title: 'AI Scrum Master Sandbox', desc: 'Optional conversational simulation for facilitation support.' },
    { href: adminEntryHref, title: 'Administrator Console', desc: 'Session identity, persona controls, and governance administration.' },
    { href: '/project-documentation', title: 'Project Documentation', desc: 'Thesis prototype handbook with architecture and operations details.' },
    { href: '/thesis', title: 'Thesis Upload', desc: 'Upload and parse thesis supporting documents.' }
  ]

  const demoSteps = [
    {
      href: '/teams',
      title: 'Sprint and Team Setup',
      desc: 'Select or configure the delivery team and sprint context.'
    },
    {
      href: '/agentic-workflow',
      title: 'Backlog Preparation',
      desc: 'Run supporting demand and BRD governance to prepare backlog inputs.'
    },
    {
      href: '/conceptual-framework',
      title: 'Conceptual Framework Briefing',
      desc: 'Explain role-agent-artifact-governance mapping before the interactive demo.'
    },
    {
      href: '/sprint-planning-workspace',
      title: 'Sprint Planning Session',
      desc: 'Run AI specialist agents with capacity-aware planning and human overrides.'
    },
    {
      href: '/planning-export-center',
      title: 'Dependencies, Risks, and Architecture Review',
      desc: 'Inspect and export planning artifacts for governance discussion.'
    },
    {
      href: '/evaluation',
      title: 'Evaluation Evidence Capture',
      desc: 'Record scenario outcomes and TAM metrics for thesis evidence.'
    }
  ]

  useEffect(() => {
    void loadIdentity()
  }, [])

  async function loadIdentity() {
    try {
      const res = await fetch('/api/session-identity')
      const json = await res.json()
      const active = json.identity || null
      setIdentity(active)
    } catch {
      setIdentity(null)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <section className="hero">
        <div className="heroMain">
          <p className="kicker">Master's Thesis Prototype</p>
          <h1>AI-Assisted SAFe Sprint Planning with Human Governance</h1>
          <p className="lead">
            This prototype focuses on sprint planning quality: backlog refinement support, capacity awareness,
            estimation guidance, dependency detection, risk identification, architecture guidance, and explicit
            human review decisions with exportable evaluation evidence.
          </p>

          <div className="heroActions">
            <Link href="/thesis-demo" className="primary">Start Thesis Demo</Link>
            <Link href="/conceptual-framework">Open Conceptual Framework</Link>
            <Link href="/sprint-planning-workspace">Open Sprint Planning Workspace</Link>
            <Link href="/agentic-workflow" className="ghost">Open Supporting Workflow</Link>
          </div>

          <div className="currentActor">
            <span className="actorLabel">Current Audit Actor</span>
            <strong>{identity ? `${identity.name}${identity.role ? ` (${identity.role})` : ''}` : 'Not configured'}</strong>
          </div>
        </div>

        <aside className="identityCard">
          <h2>Session Identity</h2>
          <p>
            Session identity is now managed only in the Administrator page.
          </p>
          <div className="identityActions">
            <Link href={adminEntryHref}>Open Administrator</Link>
          </div>
        </aside>
      </section>

      <section className="flowCard">
        <SDLCFlow />
      </section>

      <section className="linksCard bottomLinks">
        <div className="sectionHead">
          <h2>Thesis Demo Path</h2>
          <p>Recommended walkthrough: sprint setup, backlog preparation, planning decisions, governance review, evaluation evidence.</p>
        </div>

        <ol className="demoPath">
          {demoSteps.map((item, idx) => (
            <li key={item.href} className="demoStep">
              <span className="stepNum">Step {idx + 1}</span>
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
              <Link href={item.href}>Open Step</Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="linksCard bottomLinks">
        <div className="sectionHead">
          <h2>Primary Thesis Paths</h2>
          <p>Core paths for demonstrating the thesis scope.</p>
        </div>

        <div className="linkGrid">
          {primaryLinks.map((item) => (
            <Link key={item.href} href={item.href} className="linkTile primaryTile">
              <em>Primary</em>
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="linksCard bottomLinks">
        <div className="sectionHead">
          <h2>Supporting Modules</h2>
          <p>Upstream workflow and administration modules retained as supporting capabilities.</p>
        </div>

        <div className="linkGrid">
          {supportingLinks.map((item) => (
            <Link key={item.href} href={item.href} className="linkTile">
              <em>Supporting</em>
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="foot">
        Built as a thesis prototype for AI-assisted SAFe sprint planning with governed human review and evidence capture.
      </footer>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1320px;
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
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
          gap: 14px;
          margin-bottom: 14px;
        }

        .heroMain,
        .identityCard,
        .linksCard,
        .flowCard {
          border: 1px solid #d7e4f5;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 16px;
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

        .heroActions {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .heroActions :global(a) {
          text-decoration: none;
          color: #fff;
          border-radius: 10px;
          padding: 8px 12px;
          font-weight: 700;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
        }

        .heroActions :global(a.primary) {
          box-shadow: 0 8px 22px rgba(31, 95, 188, 0.28);
        }

        .heroActions :global(a.ghost) {
          background: #fff;
          color: #0d3a64;
          border: 1px solid #b9d1ee;
        }

        .currentActor {
          margin-top: 12px;
          border: 1px solid #d6e3f4;
          border-radius: 12px;
          padding: 10px;
          background: #f8fbff;
          display: grid;
          gap: 3px;
        }

        .actorLabel {
          color: #48617d;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .identityCard h2,
        .sectionHead h2 {
          margin: 0;
        }

        .identityCard p,
        .sectionHead p {
          margin: 8px 0 12px;
          color: #3e5671;
          font-size: 13px;
        }

        .identityActions {
          display: flex;
          gap: 8px;
        }

        .identityActions :global(a) {
          text-decoration: none;
          border-radius: 10px;
          padding: 8px 12px;
          font-weight: 700;
          color: #fff;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
        }

        .linkGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .linkTile {
          border: 1px solid #c5d8f0;
          border-radius: 14px;
          padding: 12px;
          text-decoration: none;
          background: linear-gradient(180deg, #fbfdff, #f3f8ff);
          display: grid;
          gap: 6px;
          transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
        }

        .linkTile strong {
          color: #11365c;
          font-size: 14px;
        }

        .linkTile em {
          font-style: normal;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #4e6984;
          font-weight: 700;
        }

        .linkTile span {
          color: #4d647e;
          font-size: 12px;
          line-height: 1.35;
        }

        .primaryTile {
          border-color: #8bb3e4;
          background: linear-gradient(180deg, #f6fbff, #edf5ff);
        }

        .demoPath {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .demoStep {
          border: 1px solid #c8daf0;
          border-radius: 14px;
          padding: 12px;
          background: linear-gradient(180deg, #fcfdff, #f4f8ff);
          display: grid;
          gap: 6px;
        }

        .stepNum {
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.06em;
          color: #4e6984;
          font-weight: 700;
        }

        .demoStep strong {
          color: #11365c;
          font-size: 13px;
        }

        .demoStep p {
          margin: 0;
          color: #4d647e;
          font-size: 12px;
          line-height: 1.35;
        }

        .demoStep :global(a) {
          color: #0d3a64;
          font-weight: 700;
          text-decoration: none;
        }

        .linkTile:hover {
          transform: translateY(-2px);
          border-color: #8fb5e6;
          box-shadow: 0 12px 24px rgba(17, 24, 39, 0.1);
        }

        .flowCard {
          margin-top: 14px;
        }

        .bottomLinks {
          margin-top: 14px;
        }

        .foot {
          margin-top: 14px;
          color: #4d647e;
          font-size: 12px;
          text-align: center;
        }

        @media (max-width: 1120px) {
          .hero {
            grid-template-columns: 1fr;
          }

          .demoPath {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .linkGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .shell {
            padding: 14px;
          }

          h1 {
            font-size: 31px;
          }

          .linkGrid {
            grid-template-columns: 1fr;
          }

          .demoPath {
            grid-template-columns: 1fr;
          }

          .identityActions {
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
