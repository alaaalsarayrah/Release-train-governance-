import { useEffect, useState } from 'react'
import Link from 'next/link'
import SDLCFlow from '../components/SDLCFlow'

export default function Home() {
  const [identity, setIdentity] = useState(null)
  const adminEntryHref = '/login?next=/administrator'

  const quickLinks = [
    { href: '/agentic-workflow', title: 'Agentic Workflow Console', desc: 'Run demand and BRD stages with Brain review loop.' },
    { href: adminEntryHref, title: 'Administrator Console', desc: 'Run cleanup actions and access core admin controls.' },
    { href: '/dashboard', title: 'Business Requests Dashboard', desc: 'Approve requests and run Stage 1 orchestration.' },
    { href: '/teams', title: 'Teams and Sprint Setup', desc: 'Provision squads, sprints, and ADO team structure.' },
    { href: '/scrum-master', title: 'AI Scrum Master', desc: 'Interactive assistant for sprint planning context.' },
    { href: '/brd-workflow', title: 'BRD to ADO Workflow', desc: 'Reference flow for requirements and backlog linkage.' },
    { href: '/demo', title: 'Interactive Demo', desc: 'Prototype exploration environment for thesis.' },
    { href: '/thesis', title: 'Thesis Upload', desc: 'Upload and parse supporting thesis document files.' }
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
          <p className="kicker">Agentic SDLC Orchestration</p>
          <h1>AI Brain + Demand + Business Analyst Working as One Delivery System</h1>
          <p className="lead">
            This workspace operationalizes your thesis vision: an agentic SDLC pipeline that accepts
            business requests, generates demand and BRD outputs via OLLAMA, enforces Brain approvals,
            synchronizes to Azure DevOps, and captures who/when audit evidence.
          </p>

          <div className="heroActions">
            <Link href="/agentic-workflow">Open Workflow Console</Link>
            <Link href="/dashboard">Open Operations Dashboard</Link>
            <Link href={adminEntryHref}>Open Administrator</Link>
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
          <h2>Operations Quick Access</h2>
          <p>Navigate directly to orchestration, approvals, and operational setup tools.</p>
        </div>

        <div className="linkGrid">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="linkTile">
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="foot">
        Built as an operational thesis lab for auditable, AI-assisted SDLC orchestration.
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

        .linkTile span {
          color: #4d647e;
          font-size: 12px;
          line-height: 1.35;
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
