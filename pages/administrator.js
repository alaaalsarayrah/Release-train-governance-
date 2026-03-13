import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const corePersonaKeys = new Set(['orchestrator', 'demand', 'requirement'])

function toPersonaKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isCorePersona(key) {
  return corePersonaKeys.has(String(key || '').trim().toLowerCase())
}

export default function AdministratorPage() {
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)
  const [authUser, setAuthUser] = useState(null)

  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const [siteReport, setSiteReport] = useState(null)
  const [adoProject, setAdoProject] = useState('Dubai-Agile')
  const [adoReport, setAdoReport] = useState(null)

  const [auditLogs, setAuditLogs] = useState([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  const [personas, setPersonas] = useState([])
  const [loadingPersonas, setLoadingPersonas] = useState(false)
  const [savingPersonas, setSavingPersonas] = useState(false)

  const [sessionIdentity, setSessionIdentity] = useState(null)
  const [sessionName, setSessionName] = useState('')
  const [sessionRole, setSessionRole] = useState('Product Owner')
  const [savingSessionIdentity, setSavingSessionIdentity] = useState(false)

  const activePersonaCount = useMemo(
    () => personas.filter((persona) => persona.active !== false).length,
    [personas]
  )

  const documentationCards = [
    {
      title: 'Project Handbook',
      desc: 'Complete project documentation for workflow, architecture, personas, and governance.',
      href: '/project-documentation',
      badge: 'All Users'
    },
    {
      title: 'Executive Summary',
      desc: 'High-level scope, process flow, strategic outcomes, and leadership view.',
      href: '/administrator/executive-summary',
      badge: 'Executive'
    },
    {
      title: 'Workflow Console Guide',
      desc: 'Operate demand and BRD lifecycle stages with Brain approval loops.',
      href: '/agentic-workflow',
      badge: 'Operations'
    },
    {
      title: 'Persona Configuration',
      desc: 'Manage model assignment, role behavior, and persona instructions.',
      href: '/agentic-config',
      badge: 'Admin'
    },
    {
      title: 'Evaluation Evidence',
      desc: 'Capture RO3 metrics and export Chapter 4 evidence package.',
      href: '/evaluation',
      badge: 'Research'
    },
    {
      title: 'Thesis Analysis',
      desc: 'Review parsed thesis extraction and research signal summaries.',
      href: '/thesis-analyze',
      badge: 'Research'
    }
  ]

  useEffect(() => {
    void bootstrap()
  }, [])

  async function bootstrap() {
    setAuthLoading(true)
    try {
      const meRes = await fetch('/api/auth/me')
      const meJson = await meRes.json()
      const user = meJson?.user || null

      if (!user) {
        router.replace('/login?next=/administrator')
        return
      }

      setAuthUser(user)

      if (String(user.role || '').toLowerCase() !== 'admin') {
        return
      }

      await Promise.all([loadAuditLogs(), loadPersonas(), loadSessionIdentity()])
    } catch (err) {
      setMessage(`Authentication check failed: ${err.message || err}`)
    } finally {
      setAuthLoading(false)
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
    }
  }

  async function loadAuditLogs() {
    setLoadingAudit(true)
    try {
      const res = await fetch('/api/agentic/audit-logs?limit=40')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load audit logs')
      setAuditLogs(json.logs || [])
    } catch (err) {
      setMessage(`Audit load failed: ${err.message || err}`)
    } finally {
      setLoadingAudit(false)
    }
  }

  async function loadPersonas() {
    setLoadingPersonas(true)
    try {
      const res = await fetch('/api/agentic/personas')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load personas')
      setPersonas(json.personas || [])
    } catch (err) {
      setMessage(`Persona load failed: ${err.message || err}`)
    } finally {
      setLoadingPersonas(false)
    }
  }

  async function loadSessionIdentity() {
    try {
      const res = await fetch('/api/session-identity')
      const json = await res.json()
      const active = json.identity || null
      setSessionIdentity(active)
      setSessionName(active?.name || '')
      setSessionRole(active?.role || 'Product Owner')
    } catch {
      setSessionIdentity(null)
      setSessionName('')
      setSessionRole('Product Owner')
    }
  }

  async function saveSessionIdentity(e) {
    e.preventDefault()
    setSavingSessionIdentity(true)
    setMessage('')
    try {
      const res = await fetch('/api/session-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName, role: sessionRole })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to save identity')

      setSessionIdentity(json.identity || null)
      setMessage('Session identity saved successfully.')
    } catch (err) {
      setMessage(`Session identity save failed: ${err.message || err}`)
    } finally {
      setSavingSessionIdentity(false)
    }
  }

  async function clearSessionIdentity() {
    const confirmed = window.confirm('Clear current session identity?')
    if (!confirmed) return

    setSavingSessionIdentity(true)
    setMessage('')
    try {
      const res = await fetch('/api/session-identity', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to clear identity')
      setSessionIdentity(null)
      setSessionName('')
      setSessionRole('Product Owner')
      setMessage('Session identity cleared.')
    } catch (err) {
      setMessage(`Session identity clear failed: ${err.message || err}`)
    } finally {
      setSavingSessionIdentity(false)
    }
  }

  function makeUniquePersonaKey(baseKey = 'agentic-ai') {
    const base = toPersonaKey(baseKey) || 'agentic-ai'
    const existing = new Set(personas.map((p) => String(p.key || '').trim().toLowerCase()))
    if (!existing.has(base)) return base

    let n = 2
    while (existing.has(`${base}-${n}`)) n += 1
    return `${base}-${n}`
  }

  function updatePersona(index, field, value) {
    setPersonas((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function addPersona() {
    const key = makeUniquePersonaKey('agentic-ai')
    setPersonas((prev) => ([
      ...prev,
      {
        key,
        name: 'Agentic AI_New',
        personaTitle: 'Custom Persona',
        model: 'qwen3:4b',
        active: true,
        description: '',
        systemInstruction: ''
      }
    ]))
    setMessage('New persona added. Fill details and click Save Persona Configuration.')
  }

  function removePersona(index) {
    const current = personas[index]
    if (!current) return
    if (isCorePersona(current.key)) {
      setMessage('Core personas cannot be removed (orchestrator, demand, requirement).')
      return
    }

    const confirmed = window.confirm(`Remove persona "${current.name || current.key}"?`)
    if (!confirmed) return

    setPersonas((prev) => prev.filter((_, i) => i !== index))
  }

  async function savePersonas() {
    setSavingPersonas(true)
    setMessage('')
    try {
      const normalized = personas.map((persona) => ({
        ...persona,
        key: toPersonaKey(persona.key || persona.name),
        name: String(persona.name || '').trim(),
        personaTitle: String(persona.personaTitle || '').trim(),
        model: String(persona.model || 'qwen3:4b').trim(),
        description: String(persona.description || '').trim(),
        systemInstruction: String(persona.systemInstruction || '').trim()
      }))

      if (normalized.some((p) => !p.key || !p.name || !p.personaTitle)) {
        throw new Error('Persona key, name, and title are required for every persona.')
      }

      const keys = normalized.map((p) => p.key)
      if (new Set(keys).size !== keys.length) {
        throw new Error('Persona keys must be unique.')
      }

      const res = await fetch('/api/agentic/personas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personas: normalized })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Save failed')
      setPersonas(json.personas || [])
      setMessage('Persona configuration saved successfully.')
    } catch (err) {
      setMessage(`Persona save failed: ${err.message || err}`)
    } finally {
      setSavingPersonas(false)
    }
  }

  async function cleanupSite() {
    const confirmed = window.confirm('Clean site data (business requests, events, audit logs, uploads)?')
    if (!confirmed) return

    setBusy('site')
    setMessage('')
    try {
      const res = await fetch('/api/admin/cleanup-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Site cleanup failed')
      setSiteReport(json.report || null)
      setMessage('Site cleanup completed successfully.')
      await loadAuditLogs()
    } catch (err) {
      setMessage(`Site cleanup failed: ${err.message || err}`)
    } finally {
      setBusy('')
    }
  }

  async function cleanupAdo() {
    const confirmed = window.confirm(`Clean Azure DevOps project "${adoProject}" work items?`)
    if (!confirmed) return

    setBusy('ado')
    setMessage('')
    try {
      const res = await fetch('/api/admin/cleanup-ado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: adoProject })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'ADO cleanup failed')
      setAdoReport(json.report || null)
      setMessage('ADO cleanup completed successfully.')
    } catch (err) {
      setMessage(`ADO cleanup failed: ${err.message || err}`)
    } finally {
      setBusy('')
    }
  }

  async function resetAuditLogsOnly() {
    const confirmed = window.confirm('Clear only audit trail logs?')
    if (!confirmed) return

    setBusy('audit')
    setMessage('')
    try {
      const res = await fetch('/api/agentic/audit-logs', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Audit clear failed')
      setAuditLogs([])
      setMessage('Audit trail cleared.')
    } catch (err) {
      setMessage(`Audit clear failed: ${err.message || err}`)
    } finally {
      setBusy('')
    }
  }

  if (authLoading) {
    return <main style={{ padding: 24 }}>Checking access...</main>
  }

  if (!authUser) {
    return <main style={{ padding: 24 }}>Redirecting to login...</main>
  }

  if (String(authUser.role || '').toLowerCase() !== 'admin') {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Access Restricted</h1>
          <p>This page requires admin role. You are signed in as {authUser.username} ({authUser.role}).</p>
          <div className="rowActions">
            <Link href="/dashboard">Go to Dashboard</Link>
            <button type="button" onClick={logout}>Logout</button>
          </div>
        </section>

        <style jsx>{`
          .shell { min-height: 100vh; max-width: 900px; margin: 0 auto; padding: 24px; }
          .panel { border: 1px solid #d6e3f4; border-radius: 14px; background: #fff; padding: 14px; }
          .rowActions { display: flex; gap: 8px; align-items: center; }
          .rowActions :global(a) { color: #0c4b8a; text-decoration: none; font-weight: 700; }
          button { border: none; border-radius: 10px; padding: 8px 12px; cursor: pointer; color: #fff; font-weight: 700; background: linear-gradient(135deg, #475569, #334155); }
        `}</style>
      </main>
    )
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Administrator Console</h1>
          <p>Operate cleanup actions, audit trail controls, and full persona management in one secured admin page.</p>
          <p className="identity">Signed in as: {authUser.name || authUser.username} ({authUser.role})</p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/administrator/executive-summary">Executive Summary</Link>
          <Link href="/agentic-workflow">Workflow Console</Link>
          <Link href="/project-documentation">Project Documentation</Link>
          <button type="button" className="secondary" onClick={logout}>Logout</button>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <section className="panel docsPanel">
        <div className="sectionHead">
          <h2>Documentation Center</h2>
          <Link href="/project-documentation" className="ghostAction">Open Full Handbook</Link>
        </div>

        <p className="muted">
          Use this hub to navigate project knowledge quickly. The handbook page is public so both admin and non-admin users can understand the full system.
        </p>

        <div className="docsStats">
          <div>
            <span className="statLabel">Active Personas</span>
            <strong>{activePersonaCount}</strong>
          </div>
          <div>
            <span className="statLabel">Recent Audit Logs Loaded</span>
            <strong>{auditLogs.length}</strong>
          </div>
          <div>
            <span className="statLabel">Session Actor</span>
            <strong>{sessionIdentity ? `${sessionIdentity.name}` : 'Not Set'}</strong>
          </div>
        </div>

        <div className="docsGrid">
          {documentationCards.map((card) => (
            <Link key={card.title} href={card.href} className="docCard">
              <span className="docBadge">{card.badge}</span>
              <strong>{card.title}</strong>
              <span>{card.desc}</span>
            </Link>
          ))}

          <a className="docCard" href="/api/agentic/audit-logs?format=csv" target="_blank" rel="noreferrer">
            <span className="docBadge">Export</span>
            <strong>Audit CSV Export</strong>
            <span>Download the audit trail as CSV for compliance or thesis appendix evidence.</span>
          </a>
        </div>
      </section>

      <section className="panel">
        <h2>Cleanup Actions</h2>
        <p className="muted">Site cleanup and ADO cleanup are independent operations.</p>

        <div className="cleanupGrid">
          <article className="cleanupCard">
            <h3>Site Cleanup</h3>
            <p>Removes business requests, orchestrator events, audit logs, and uploaded files from this site.</p>
            <button type="button" onClick={cleanupSite} disabled={busy === 'site'}>
              {busy === 'site' ? 'Cleaning Site...' : 'Clean Site Data'}
            </button>
            {siteReport ? <pre>{JSON.stringify(siteReport, null, 2)}</pre> : null}
          </article>

          <article className="cleanupCard">
            <h3>Azure DevOps Cleanup</h3>
            <p>Deletes work items in the selected Azure DevOps project.</p>
            <label>
              ADO Project
              <input value={adoProject} onChange={(e) => setAdoProject(e.target.value)} placeholder="Dubai-Agile" />
            </label>
            <button type="button" onClick={cleanupAdo} disabled={busy === 'ado'}>
              {busy === 'ado' ? 'Cleaning ADO...' : 'Clean ADO Project Data'}
            </button>
            {adoReport ? <pre>{JSON.stringify(adoReport, null, 2)}</pre> : null}
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <h2>Session Identity</h2>
          <button type="button" className="secondary" onClick={() => void loadSessionIdentity()} disabled={savingSessionIdentity}>
            Refresh Identity
          </button>
        </div>

        <p className="muted">
          Identity used by dashboard/workflow actions is managed here only.
        </p>

        <div className="identityCurrent">
          <span className="muted">Current Actor</span>
          <strong>{sessionIdentity ? `${sessionIdentity.name}${sessionIdentity.role ? ` (${sessionIdentity.role})` : ''}` : 'Not configured'}</strong>
        </div>

        <form className="identityForm" onSubmit={saveSessionIdentity}>
          <label>
            Name
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Maha Al Nuaimi"
              required
            />
          </label>

          <label>
            Role
            <select value={sessionRole} onChange={(e) => setSessionRole(e.target.value)}>
              <option value="Product Owner">Product Owner</option>
              <option value="Business Owner">Business Owner</option>
              <option value="PMO Operator">PMO Operator</option>
              <option value="Delivery Manager">Delivery Manager</option>
              <option value="Business Analyst">Business Analyst</option>
              <option value="Scrum Master">Scrum Master</option>
            </select>
          </label>

          <div className="rowActions">
            <button type="submit" disabled={savingSessionIdentity}>
              {savingSessionIdentity ? 'Saving...' : 'Save Session Identity'}
            </button>
            <button type="button" className="danger" onClick={clearSessionIdentity} disabled={savingSessionIdentity}>
              Clear Session Identity
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <h2>Audit Trail</h2>
          <div className="rowActions">
            <button type="button" className="secondary" onClick={() => void loadAuditLogs()} disabled={loadingAudit || busy === 'audit'}>
              {loadingAudit ? 'Refreshing...' : 'Refresh Logs'}
            </button>
            <button type="button" className="danger" onClick={resetAuditLogsOnly} disabled={busy === 'audit'}>
              {busy === 'audit' ? 'Clearing...' : 'Clear Audit Logs'}
            </button>
          </div>
        </div>

        {loadingAudit ? <p className="muted">Loading audit logs...</p> : null}
        {!loadingAudit && auditLogs.length === 0 ? <p className="muted">No audit logs found.</p> : null}

        {auditLogs.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>BR</th>
                  <th>Stage</th>
                  <th>Actor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.br_id}</td>
                    <td>{log.stage}</td>
                    <td>{log.actor}</td>
                    <td>{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="sectionHead">
          <h2>Persona Administration</h2>
          <div className="rowActions">
            <button type="button" className="secondary" onClick={() => void loadPersonas()} disabled={loadingPersonas || savingPersonas}>
              {loadingPersonas ? 'Refreshing...' : 'Refresh Personas'}
            </button>
            <button type="button" className="secondary" onClick={addPersona} disabled={savingPersonas || loadingPersonas}>
              Add Persona
            </button>
            <button type="button" onClick={savePersonas} disabled={savingPersonas || loadingPersonas}>
              {savingPersonas ? 'Saving...' : 'Save Persona Configuration'}
            </button>
          </div>
        </div>

        {loadingPersonas ? <p className="muted">Loading personas...</p> : null}

        <div className="personaGrid">
          {personas.map((persona, index) => (
            <article key={`${persona.key || 'persona'}-${index}`} className="personaCard">
              <div className="personaTitleRow">
                <h3>{persona.name || `Persona ${index + 1}`}</h3>
                <div className="personaTopControls">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={persona.active !== false}
                      onChange={(e) => updatePersona(index, 'active', e.target.checked)}
                    />
                    <span>Active</span>
                  </label>

                  {isCorePersona(persona.key) ? (
                    <span className="coreBadge">Core</span>
                  ) : (
                    <button className="dangerInline" onClick={() => removePersona(index)} type="button">
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <label>
                Persona Key
                <input
                  value={persona.key || ''}
                  onChange={(e) => updatePersona(index, 'key', e.target.value)}
                  disabled={isCorePersona(persona.key)}
                  placeholder="e.g. architecture-review"
                />
              </label>

              <label>
                Agent Name
                <input
                  value={persona.name || ''}
                  onChange={(e) => updatePersona(index, 'name', e.target.value)}
                  placeholder="e.g. Agentic AI_Architecture"
                />
              </label>

              <label>
                Persona Title
                <input
                  value={persona.personaTitle || ''}
                  onChange={(e) => updatePersona(index, 'personaTitle', e.target.value)}
                  placeholder="e.g. Architecture Reviewer"
                />
              </label>

              <label>
                Model
                <input
                  value={persona.model || ''}
                  onChange={(e) => updatePersona(index, 'model', e.target.value)}
                  placeholder="e.g. qwen3:4b"
                />
              </label>

              <label>
                Description
                <textarea
                  rows={3}
                  value={persona.description || ''}
                  onChange={(e) => updatePersona(index, 'description', e.target.value)}
                />
              </label>

              <label>
                System Instruction
                <textarea
                  rows={5}
                  value={persona.systemInstruction || ''}
                  onChange={(e) => updatePersona(index, 'systemInstruction', e.target.value)}
                />
              </label>
            </article>
          ))}
        </div>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1300px;
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
            radial-gradient(circle at 15% 10%, rgba(20, 143, 180, 0.14), transparent 40%),
            radial-gradient(circle at 85% 12%, rgba(57, 118, 218, 0.14), transparent 44%),
            linear-gradient(180deg, #f8fbff, #eef4ff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        .hero h1 {
          margin: 0;
          font-size: 34px;
        }

        .hero p {
          margin: 8px 0 0;
          color: #3d536d;
        }

        .identity {
          font-weight: 700;
          color: #2f4e70;
        }

        .heroLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
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
          border: 1px solid #8be1dc;
          background: #ecfeff;
          color: #134e4a;
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 12px;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          margin-bottom: 14px;
        }

        .docsPanel {
          background:
            radial-gradient(circle at 8% 16%, rgba(20, 143, 180, 0.08), transparent 35%),
            radial-gradient(circle at 92% 14%, rgba(57, 118, 218, 0.08), transparent 34%),
            rgba(255, 255, 255, 0.94);
        }

        .muted {
          color: #586f88;
        }

        .ghostAction {
          text-decoration: none;
          color: #0d3a64;
          border: 1px solid #c9dcf1;
          border-radius: 999px;
          background: #fff;
          padding: 7px 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .docsStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .docsStats div {
          border: 1px solid #cfe0f4;
          border-radius: 12px;
          background: #f8fbff;
          padding: 9px;
          display: grid;
          gap: 2px;
        }

        .statLabel {
          font-size: 11px;
          color: #4b6682;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        .docsStats strong {
          color: #0f2741;
          font-size: 15px;
        }

        .docsGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .docCard {
          border: 1px solid #c5d8f0;
          border-radius: 14px;
          padding: 12px;
          text-decoration: none;
          background: linear-gradient(180deg, #fbfdff, #f2f8ff);
          display: grid;
          gap: 6px;
          transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
        }

        .docCard strong {
          color: #11365c;
          font-size: 14px;
        }

        .docCard span {
          color: #4d647e;
          font-size: 12px;
          line-height: 1.35;
        }

        .docBadge {
          display: inline-flex;
          width: fit-content;
          border: 1px solid #c8def3;
          border-radius: 999px;
          background: #ebf5ff;
          color: #14527f;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .docCard:hover {
          transform: translateY(-2px);
          border-color: #8fb5e6;
          box-shadow: 0 12px 24px rgba(17, 24, 39, 0.1);
        }

        .cleanupGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .cleanupCard {
          border: 1px solid #d6e3f4;
          border-radius: 12px;
          padding: 12px;
          background: #fbfdff;
          display: grid;
          gap: 8px;
        }

        .cleanupCard h3 {
          margin: 0;
        }

        .sectionHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .sectionHead h2 {
          margin: 0;
        }

        .rowActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        button {
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          cursor: pointer;
          color: #fff;
          font-weight: 700;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
        }

        .secondary {
          background: linear-gradient(135deg, #475569, #334155);
        }

        .danger,
        .dangerInline {
          background: linear-gradient(135deg, #c62828, #9f1d1d);
        }

        .dangerInline {
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 12px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          padding: 8px;
          font-size: 13px;
          color: #10223a;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        label {
          font-size: 12px;
          color: #35506b;
          font-weight: 700;
          display: grid;
          gap: 4px;
        }

        .identityForm {
          display: grid;
          gap: 8px;
        }

        .identityCurrent {
          border: 1px solid #d6e3f4;
          border-radius: 12px;
          background: #f8fbff;
          padding: 10px;
          display: grid;
          gap: 3px;
          margin-bottom: 10px;
        }

        pre {
          margin: 0;
          white-space: pre-wrap;
          max-height: 220px;
          overflow: auto;
          border-radius: 11px;
          border: 1px solid #dbe6f6;
          background: #f7fbff;
          padding: 10px;
          font-family: 'IBM Plex Mono', Consolas, monospace;
          font-size: 12px;
        }

        .tableWrap {
          overflow: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          font-size: 13px;
        }

        th,
        td {
          text-align: left;
          border-bottom: 1px solid #e2ecf8;
          padding: 8px;
          white-space: nowrap;
        }

        .personaGrid {
          display: grid;
          gap: 9px;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }

        .personaCard {
          border: 1px solid #d6e3f4;
          border-radius: 12px;
          background: #fbfdff;
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .personaTitleRow {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }

        .personaTitleRow h3 {
          margin: 0;
          font-size: 17px;
        }

        .personaTopControls {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .switch {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #48617d;
          font-weight: 700;
        }

        .switch input {
          width: auto;
        }

        .coreBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid #c7def3;
          background: #ebf5ff;
          color: #12507b;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
        }

        @media (max-width: 980px) {
          .hero {
            flex-direction: column;
          }

          .cleanupGrid {
            grid-template-columns: 1fr;
          }

          .docsStats,
          .docsGrid {
            grid-template-columns: 1fr;
          }

          .sectionHead {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
