import Link from 'next/link'

const frameworkRows = [
  {
    area: 'Backlog refinement',
    safeActivity: 'Backlog Refinement',
    humanRole: 'Product Owner, Scrum Master',
    aiAgent: 'product_owner_assistant',
    inputArtifact: 'Prioritized backlog, business request context, sprint goals',
    outputArtifact: 'Refined backlog candidates, readiness notes',
    governancePoint: 'Human validation of scope before sprint commitment'
  },
  {
    area: 'Sprint planning',
    safeActivity: 'Sprint Planning',
    humanRole: 'Scrum Master, Delivery Team',
    aiAgent: 'Orchestrated planning specialist set',
    inputArtifact: 'Selected stories, team capacity, sprint objective',
    outputArtifact: 'Draft sprint scope and planning session package',
    governancePoint: 'Human finalization of plan and sprint commitment'
  },
  {
    area: 'Estimation support',
    safeActivity: 'Capacity and Estimate Alignment',
    humanRole: 'Scrum Master, Product Owner',
    aiAgent: 'estimation_advisor',
    inputArtifact: 'Story complexity, historical assumptions, capacity limits',
    outputArtifact: 'AI estimate baseline, confidence, variance signal',
    governancePoint: 'Human override of final estimate values'
  },
  {
    area: 'Dependency analysis',
    safeActivity: 'Dependency Management',
    humanRole: 'Product Owner, Delivery Lead',
    aiAgent: 'dependency_analyst',
    inputArtifact: 'Story relationships, integration constraints',
    outputArtifact: 'Dependency register and graph view',
    governancePoint: 'Human acceptance of mitigations and escalation actions'
  },
  {
    area: 'Risk review',
    safeActivity: 'Risk Identification and Mitigation',
    humanRole: 'Delivery Lead, Scrum Master',
    aiAgent: 'risk_analyst',
    inputArtifact: 'Dependency profile, delivery assumptions, risk history',
    outputArtifact: 'Risk register with severity, owner, mitigation',
    governancePoint: 'Human risk ownership confirmation and monitoring decision'
  },
  {
    area: 'Architecture review',
    safeActivity: 'Architecture Runway Review',
    humanRole: 'Solution Architect, Product Owner',
    aiAgent: 'architect_advisor',
    inputArtifact: 'Planned scope, constraints, non-functional requirements',
    outputArtifact: 'Architecture note and recommended technical enablers',
    governancePoint: 'Human architecture sign-off for implementation readiness'
  },
  {
    area: 'Planning recommendation review',
    safeActivity: 'Governance Decision Loop',
    humanRole: 'Scrum Master, Product Owner',
    aiAgent: 'All active specialist agents',
    inputArtifact: 'Agent outputs and rationale',
    outputArtifact: 'Decision log: accept / modify / reject / clarification',
    governancePoint: 'Explicit human approval trace captured for thesis evidence'
  }
]

export default function ConceptualFrameworkPage() {
  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <p className="eyebrow">Thesis Conceptual Model</p>
          <h1>Conceptual Framework: SAFe-Agentic AI Mapping</h1>
          <p>
            This framework summarizes, in one view, how SAFe planning activities are mapped to
            human roles, AI specialist agents, artifacts, and governance checkpoints in the prototype.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/evaluation">Evaluation</Link>
          <Link href="/planning-export-center">Export Center</Link>
          <Link href="/project-documentation">Documentation</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      <section className="panel quickRead">
        <h2>30-Second Interpretation</h2>
        <p>
          The model shows a consistent pattern: AI agents generate planning intelligence,
          humans approve or adjust outcomes, and each stage leaves an auditable artifact for thesis evidence.
        </p>
      </section>

      <section className="panel">
        <h2>SAFe-Agentic Mapping Matrix</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th>SAFe Activity</th>
                <th>Human Role</th>
                <th>AI Agent</th>
                <th>Input Artifact</th>
                <th>Output Artifact</th>
                <th>Governance / Approval Point</th>
              </tr>
            </thead>
            <tbody>
              {frameworkRows.map((row) => (
                <tr key={row.area}>
                  <td><strong>{row.area}</strong></td>
                  <td>{row.safeActivity}</td>
                  <td>{row.humanRole}</td>
                  <td><span className="agentBadge">{row.aiAgent}</span></td>
                  <td>{row.inputArtifact}</td>
                  <td>{row.outputArtifact}</td>
                  <td><span className="govBadge">{row.governancePoint}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel notes">
        <h2>Scope Alignment Note</h2>
        <p>
          This page reflects the thesis prototype behavior implemented in the sprint planning workspace,
          workflow governance stages, and planning export evidence paths.
        </p>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1360px;
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
            radial-gradient(circle at 84% 11%, rgba(37, 99, 235, 0.14), transparent 45%),
            linear-gradient(180deg, #f8fcff, #eef5ff 62%, #f9fcff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
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

        .quickRead p,
        .notes p {
          margin: 0;
          color: #3f5a75;
        }

        .tableWrap {
          overflow: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1100px;
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
          position: sticky;
          top: 0;
          background: #f3f8ff;
          color: #14385a;
          font-weight: 700;
          z-index: 1;
        }

        tbody tr:nth-child(even) {
          background: #fbfdff;
        }

        .agentBadge {
          display: inline-block;
          border: 1px solid #b9dbff;
          background: #ecf6ff;
          color: #0f4f7f;
          border-radius: 999px;
          padding: 3px 8px;
          font-weight: 700;
        }

        .govBadge {
          display: inline-block;
          border: 1px solid #b8e2ca;
          background: #effcf4;
          color: #10613e;
          border-radius: 10px;
          padding: 4px 7px;
          font-weight: 600;
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