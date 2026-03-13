import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const workflowStages = [
  {
    stage: '1. Business Request Intake',
    owner: 'Business / PMO',
    description: 'A business request is created with problem context, urgency, and unit ownership.',
    outputs: ['Business Request ID', 'Initial status: Pending', 'Baseline request metadata']
  },
  {
    stage: '2. Business Approval Gate',
    owner: 'Business Approver',
    description: 'Request is approved or rejected before AI stages run.',
    outputs: ['Approval decision', 'Decision reason', 'Audit event with actor + timestamp']
  },
  {
    stage: '3. Demand Generation',
    owner: 'Agentic AI_Demand',
    description: 'Demand persona analyzes approved request and drafts scope, risks, budget, and timeline.',
    outputs: ['Structured demand output', 'Model used', 'Demand stage logs + optional ADO item']
  },
  {
    stage: '4. Brain Review: Demand',
    owner: 'Agentic AI_Orcastration',
    description: 'Brain persona approves/rejects demand package with reason.',
    outputs: ['Demand review status', 'Review reason', 'Workflow transition to BRD Drafting or Demand Rework']
  },
  {
    stage: '5. BRD Drafting / Submission',
    owner: 'Agentic AI_Requirement',
    description: 'Business Analyst persona drafts or submits BRD package and versioned details.',
    outputs: ['BRD draft/version', 'Requirement details', 'Optional BRD document URL']
  },
  {
    stage: '6. Brain Review: BRD',
    owner: 'Agentic AI_Orcastration',
    description: 'Brain persona approves/rejects BRD and controls progression to scoping.',
    outputs: ['BRD approval status', 'Review reason', 'Ready for Epic Scoping or BRD Rework']
  },
  {
    stage: '7. Sync and Traceability',
    owner: 'System Integrations',
    description: 'Key stage artifacts can be synced to Azure DevOps and retained in audit/event stores.',
    outputs: ['ADO work item references', 'orchestrator_events records', 'audit_logs evidence trail']
  }
]

const architectureBlocks = [
  {
    title: 'Frontend Experience (Next.js Pages)',
    details: [
      'Operational pages for dashboard, workflow console, admin, teams, thesis, and evaluation',
      'Role-based login flow and session identity controls',
      'Real-time stage visibility through event streaming and periodic refresh patterns'
    ]
  },
  {
    title: 'Agentic Workflow APIs',
    details: [
      'Workflow actions: demand generation/review, BRD generation/submission/review',
      'Persona management API with core persona protection and model configuration',
      'Audit log APIs with filtering and CSV export'
    ]
  },
  {
    title: 'LLM and Orchestration Layer',
    details: [
      'OLLAMA model calls with fallback candidates and timeout guards',
      'Persona-specific prompts and structured JSON extraction patterns',
      'Brain approval loops to enforce human-governed progression semantics'
    ]
  },
  {
    title: 'Data and Persistence',
    details: [
      'SQLite stores business requests, audit logs, orchestrator events, and evaluation evidence',
      'File uploads path for thesis/BRD artifacts under public/uploads',
      'JSON configuration files for personas, teams, and authentication users'
    ]
  },
  {
    title: 'Integrations and Delivery',
    details: [
      'Azure DevOps integration for work-item creation and provisioning flows',
      'Vercel deployment for web app and Expo wrapper for mobile access',
      'Docker support for local or controlled environment hosting'
    ]
  }
]

const apiCatalog = [
  {
    area: 'Authentication',
    endpoints: ['/api/auth/login', '/api/auth/me', '/api/auth/logout'],
    purpose: 'Role-based access and session management'
  },
  {
    area: 'Workflow Core',
    endpoints: ['/api/business-request', '/api/agentic/workflow-action', '/api/orchestrator/stage1'],
    purpose: 'Business request lifecycle and agentic stage transitions'
  },
  {
    area: 'Personas and Audit',
    endpoints: ['/api/agentic/personas', '/api/agentic/audit-logs', '/api/orchestrator/events-stream'],
    purpose: 'Persona configuration, governance evidence, and runtime event visibility'
  },
  {
    area: 'Thesis and BRD Parsing',
    endpoints: ['/api/upload', '/api/parse-thesis', '/api/parse-brd'],
    purpose: 'Document ingestion and extraction for thesis/research workflows'
  },
  {
    area: 'Evaluation Evidence',
    endpoints: ['/api/agentic/evaluation', '/api/agentic/chapter4-evidence'],
    purpose: 'RO3 metric capture and Chapter 4 export package'
  },
  {
    area: 'ADO Integration',
    endpoints: ['/api/ado-config', '/api/sync-ado', '/api/ado-provision'],
    purpose: 'Configuration, synchronization, and Azure DevOps provisioning'
  }
]

const roleGuides = [
  {
    role: 'Administrator',
    steps: [
      'Open Administrator Console and configure session identity + personas',
      'Review audit logs regularly and export evidence when needed',
      'Use cleanup actions carefully for reset or controlled test cycles'
    ]
  },
  {
    role: 'Business Approver / Product Owner',
    steps: [
      'Submit or review business requests in Dashboard',
      'Approve only requests with sufficient problem context and urgency',
      'Track stage outcomes and review reasons before proceeding'
    ]
  },
  {
    role: 'Workflow Operator',
    steps: [
      'Run demand and BRD stages from Agentic Workflow Console',
      'Use Brain approval/rejection actions with clear reasons',
      'Confirm final status reaches Ready for Epic Scoping'
    ]
  },
  {
    role: 'Research / Thesis User',
    steps: [
      'Upload latest thesis/BRD documents for parsing and analysis',
      'Capture evaluation metrics and TAM responses in Evaluation page',
      'Export Chapter 4 evidence package (JSON/CSV) for thesis reporting'
    ]
  }
]

function renderList(items) {
  return (
    <ul>
      {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ul>
  )
}

export default function ProjectDocumentationPage() {
  const [personas, setPersonas] = useState([])
  const [personaError, setPersonaError] = useState('')
  const [thesisMeta, setThesisMeta] = useState(null)

  useEffect(() => {
    void loadPersonas()
    void loadThesisMeta()
  }, [])

  async function loadPersonas() {
    try {
      const res = await fetch('/api/agentic/personas')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load personas')
      setPersonas(json.personas || [])
      setPersonaError('')
    } catch (err) {
      setPersonaError(String(err.message || err))
      setPersonas([])
    }
  }

  async function loadThesisMeta() {
    try {
      const res = await fetch('/api/parse-thesis')
      const json = await res.json()
      if (!res.ok) return
      setThesisMeta({
        fileName: json.fileName || '-',
        fileType: json.fileType || '-',
        textLength: json.textLength || 0,
        roCount: Array.isArray(json.roLines) ? json.roLines.length : 0,
        rqCount: Array.isArray(json.rqLines) ? json.rqLines.length : 0,
        evalSignalCount: Array.isArray(json.evaluationSignals) ? json.evaluationSignals.length : 0,
        guidelineSignalCount: Array.isArray(json.guidelineSignals) ? json.guidelineSignals.length : 0
      })
    } catch {
      setThesisMeta(null)
    }
  }

  const activePersonas = useMemo(() => personas.filter((p) => p.active !== false), [personas])

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <p className="kicker">Thesis Handbook</p>
          <h1>AI-Assisted SAFe Sprint Planning Prototype Documentation</h1>
          <p className="lead">
            This handbook documents the thesis prototype with sprint planning as the primary scope and
            upstream demand/BRD orchestration as supporting modules.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/conceptual-framework">Conceptual Framework</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/evaluation">Evaluation</Link>
          <Link href="/thesis-readiness-checklist">Supervisor Checklist</Link>
          <Link href="/chapter-alignment-notes">Chapter Notes</Link>
          <Link href="/agentic-workflow">Supporting Workflow</Link>
          <Link href="/dashboard">Supporting Dashboard</Link>
          <Link href="/administrator">Administrator</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      <section className="panel">
        <h2>1) Project Purpose and Scope</h2>
        <p>
          The platform operationalizes a thesis on integrating Agentic AI into SAFe-aligned planning and delivery control.
          It combines persona-driven AI outputs, Brain approval gates, Azure DevOps integration, and full audit traceability.
        </p>
        <div className="twoCol">
          <article>
            <h3>Primary Objectives</h3>
            {renderList([
              'Improve planning efficiency and consistency using persona-specialized AI agents',
              'Keep human governance intact through explicit approval/rejection loops',
              'Create production-oriented traceability with who/when/action evidence',
              'Generate exportable evaluation evidence for thesis reporting and validation'
            ])}
          </article>
          <article>
            <h3>In-Scope Capabilities</h3>
            {renderList([
              'SAFe sprint planning support with specialist AI agents',
              'Backlog refinement and estimation support',
              'Capacity awareness and dependency/risk visibility',
              'Architecture guidance with explicit human review decisions',
              'Evaluation evidence capture and export for thesis reporting',
              'Supporting upstream modules: demand intake and BRD governance'
            ])}
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>2) End-to-End Workflow</h2>
        <p>The workflow below reflects current implemented process transitions.</p>
        <div className="cardGrid">
          {workflowStages.map((item) => (
            <article key={item.stage} className="miniCard">
              <h3>{item.stage}</h3>
              <p><strong>Owner:</strong> {item.owner}</p>
              <p>{item.description}</p>
              <div className="subhead">Outputs</div>
              {renderList(item.outputs)}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>3) Agentic Personas</h2>
        <p>
          Personas are configurable in Administrator and executed in workflow actions.
          Core personas are Orchestrator (Brain), Demand, and Requirement.
        </p>
        {personaError ? <div className="warn">Persona load warning: {personaError}</div> : null}
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Agent Name</th>
                <th>Persona Title</th>
                <th>Model</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {activePersonas.map((persona) => (
                <tr key={persona.key}>
                  <td>{persona.key}</td>
                  <td>{persona.name}</td>
                  <td>{persona.personaTitle}</td>
                  <td>{persona.model}</td>
                  <td>{persona.active === false ? 'Disabled' : 'Active'}</td>
                  <td>{persona.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>4) System Architecture</h2>
        <div className="twoCol">
          {architectureBlocks.map((block) => (
            <article key={block.title} className="miniCard">
              <h3>{block.title}</h3>
              {renderList(block.details)}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>5) API Map</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th>Endpoints</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {apiCatalog.map((entry) => (
                <tr key={entry.area}>
                  <td>{entry.area}</td>
                  <td>{entry.endpoints.join(', ')}</td>
                  <td>{entry.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>6) Data, Governance, and Audit</h2>
        <div className="twoCol">
          <article>
            <h3>Core Data Stores</h3>
            {renderList([
              'business_requests: lifecycle statuses and request state',
              'orchestrator_events: stage-level execution stream records',
              'audit_logs: actor/stage/action trace for governance evidence',
              'thesis_evaluations: RO3 metrics and qualitative inputs'
            ])}
          </article>
          <article>
            <h3>Governance Rules</h3>
            {renderList([
              'Brain persona controls approval transitions for demand and BRD',
              'All key stage actions log actor + timestamp',
              'Rejected outputs route to rework stages with review reasons',
              'Audit export endpoints support compliance and thesis evidence generation'
            ])}
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>7) Agentic AI Outputs Created by the System</h2>
        <div className="twoCol">
          <article>
            <h3>Demand Outputs</h3>
            {renderList([
              'Demand summary and business problem framing',
              'Scope/objectives and success metrics',
              'Budget/timeline estimations',
              'Risk and dependency framing for later BRD stages'
            ])}
          </article>
          <article>
            <h3>BRD Outputs</h3>
            {renderList([
              'Versioned BRD draft package',
              'Functional/non-functional requirement structure',
              'Acceptance criteria and traceability matrix',
              'Review-ready artifacts for Brain approval'
            ])}
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>8) Thesis and Evaluation Documentation</h2>
        <p>
          Thesis extraction and RO3 evidence collection are now embedded in the platform.
        </p>
        <div className="twoCol">
          <article>
            <h3>Current Thesis Metadata</h3>
            {thesisMeta ? (
              <ul>
                <li><strong>File:</strong> {thesisMeta.fileName}</li>
                <li><strong>Type:</strong> {thesisMeta.fileType}</li>
                <li><strong>Text Length:</strong> {thesisMeta.textLength}</li>
                <li><strong>RO Signals:</strong> {thesisMeta.roCount}</li>
                <li><strong>RQ Signals:</strong> {thesisMeta.rqCount}</li>
                <li><strong>Evaluation Signals:</strong> {thesisMeta.evalSignalCount}</li>
                <li><strong>Guideline Signals:</strong> {thesisMeta.guidelineSignalCount}</li>
              </ul>
            ) : (
              <p className="muted">Thesis metadata unavailable. Upload a thesis file and retry.</p>
            )}
          </article>
          <article>
            <h3>RO3 Evidence Flow</h3>
            {renderList([
              'Capture scenario + TAM responses in Evaluation page',
              'Store structured metrics in thesis_evaluations table',
              'Export chapter evidence as JSON or CSV for thesis write-up',
              'Use summary metrics for Chapter 4 quantitative reporting'
            ])}
            <p className="inlineLinks">
              <Link href="/evaluation">Open Evaluation</Link>
              <a href="/api/agentic/chapter4-evidence?format=csv" target="_blank" rel="noreferrer">Download CSV</a>
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>9) Role-Based Quick Start</h2>
        <div className="cardGrid">
          {roleGuides.map((guide) => (
            <article key={guide.role} className="miniCard">
              <h3>{guide.role}</h3>
              {renderList(guide.steps)}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>10) Related Documentation and Operational Links</h2>
        <div className="linkGrid">
          <a href="/docs/README.md" target="_blank" rel="noreferrer">README</a>
          <a href="/docs/DEPLOYMENT.md" target="_blank" rel="noreferrer">Deployment Guide</a>
          <a href="/docs/PROJECT_FULL_DOCUMENTATION.md" target="_blank" rel="noreferrer">Exhaustive Full Documentation</a>
          <a href="/downloads/project-full-documentation.docx" target="_blank" rel="noreferrer">Full Project Word Document</a>
          <Link href="/administrator/executive-summary">Executive Summary</Link>
          <Link href="/agentic-config">Persona Config</Link>
          <Link href="/agentic-workflow">Workflow Console</Link>
          <Link href="/dashboard">Operations Dashboard</Link>
          <Link href="/administrator">Administrator Console</Link>
          <Link href="/thesis">Thesis Upload</Link>
          <Link href="/thesis-analyze">Thesis Analysis</Link>
        </div>
      </section>

      <footer className="foot">
        This handbook is maintained as the single-source project orientation page for users, operators, and reviewers.
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

        .panel h2 {
          margin: 0 0 8px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .panel h3 {
          margin: 0 0 6px;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          font-size: 17px;
        }

        .panel p {
          margin: 0 0 8px;
          color: #3f5873;
          font-size: 13px;
          line-height: 1.45;
        }

        .twoCol {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .cardGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .miniCard {
          border: 1px solid #d3e1f3;
          border-radius: 12px;
          background: #fbfdff;
          padding: 10px;
          display: grid;
          gap: 4px;
        }

        .subhead {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #476582;
          font-weight: 700;
        }

        ul {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 5px;
          color: #3f5873;
          font-size: 13px;
        }

        .tableWrap {
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 860px;
          border-collapse: collapse;
          font-size: 13px;
        }

        th,
        td {
          text-align: left;
          border-bottom: 1px solid #e2ecf8;
          padding: 8px;
          vertical-align: top;
        }

        th {
          color: #3e5671;
          background: #f7fbff;
        }

        .warn {
          border: 1px solid #facc15;
          background: #fef9c3;
          color: #713f12;
          border-radius: 9px;
          padding: 8px;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .inlineLinks {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .inlineLinks :global(a),
        .inlineLinks a {
          text-decoration: none;
          color: #0f4a82;
          font-weight: 700;
        }

        .linkGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .linkGrid :global(a),
        .linkGrid a {
          text-decoration: none;
          border: 1px solid #c8dbf2;
          border-radius: 12px;
          background: #f8fbff;
          padding: 9px;
          color: #1b426b;
          font-weight: 700;
          text-align: center;
        }

        .muted {
          color: #586f88;
        }

        .foot {
          margin-top: 14px;
          color: #48617d;
          font-size: 12px;
        }

        @media (max-width: 980px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .twoCol,
          .cardGrid,
          .linkGrid {
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
