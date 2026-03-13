import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getThesisDemoHydrationState, loadThesisDemoData, resetThesisDemoData } from '../lib/thesis/demo-state'

export default function TeamsPage() {
  const [data, setData] = useState({ teams: [], sprints: [] })
  const [loading, setLoading] = useState(true)
  const [demoBusy, setDemoBusy] = useState('')
  const [demoState, setDemoState] = useState(null)
  const [pageMessage, setPageMessage] = useState('')
  const [initializing, setInitializing] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [provisionReport, setProvisionReport] = useState(null)
  const [userEmails, setUserEmails] = useState('')
  const [memberEmailInput, setMemberEmailInput] = useState('')
  const [savingEmails, setSavingEmails] = useState(false)
  const [syncingSiteUsers, setSyncingSiteUsers] = useState(false)
  const [syncSiteUsersReport, setSyncSiteUsersReport] = useState(null)
  const [checkingAssignability, setCheckingAssignability] = useState(false)
  const [assignmentReadiness, setAssignmentReadiness] = useState(null)
  const [adminFixing, setAdminFixing] = useState(false)
  const [adminFixReport, setAdminFixReport] = useState(null)

  async function load(options = {}) {
    const autoRecover = options.autoRecover !== false

    try {
      const hydration = await getThesisDemoHydrationState({ autoRecover })
      setDemoState(hydration)
      setData({
        teams: hydration.teamSetup?.teams || [],
        sprints: hydration.teamSetup?.sprints || []
      })

      if (hydration.recovered) {
        setPageMessage('Thesis demo setup was recovered automatically and is ready for the guided walkthrough.')
      } else if (hydration.recoveryError) {
        setPageMessage(`Thesis demo recovery failed: ${hydration.recoveryError}`)
      } else if (hydration.needsRecovery) {
        setPageMessage(hydration.recoveryReason || 'Thesis demo setup is incomplete. Load thesis demo data to populate this page.')
      } else {
        setPageMessage('')
      }
    } catch (err) {
      console.error(err)
      setPageMessage(`Setup load failed: ${String(err?.message || err)}`)
    } finally {
      setLoading(false)
    }
  }

  function formatTeamSetupWriteError(payload) {
    const message = String(payload?.message || 'Failed to save emails').trim()
    const details = String(payload?.error || '').trim()

    if (/\bEROFS\b|read-only file system/i.test(details)) {
      return 'This deployment is read-only. Update data/team-setup.json in the repo and redeploy, or run this action locally.'
    }

    if (details) return `${message}: ${details}`
    return message
  }

  function formatAdoApiError(payload, fallbackMessage) {
    const code = String(payload?.adoErrorCode || '').trim().toUpperCase()
    const detail = String(payload?.adoErrorMessage || payload?.detail || payload?.error || '').trim()

    if (code === 'ADO_AUTH') {
      return `ADO authentication failed. Check PAT configuration and token expiry in Administrator settings.${detail ? ` (${detail})` : ''}`
    }

    if (code === 'ADO_FORBIDDEN') {
      return `ADO access is forbidden for the configured token or policy. Verify permissions for this project.${detail ? ` (${detail})` : ''}`
    }

    if (code === 'ADO_UNAVAILABLE' || code === 'ADO_THROTTLED') {
      return `ADO is temporarily unavailable. Retry after a short delay.${detail ? ` (${detail})` : ''}`
    }

    const message = String(payload?.message || fallbackMessage).trim()
    if (detail) return `${message}: ${detail}`
    return message
  }

  async function initializeTeams() {
    setInitializing(true)
    try {
      const res = await fetch('/api/team-setup', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to initialize teams')
      setData({ teams: json.setup?.teams || [], sprints: json.setup?.sprints || [] })
      await load({ autoRecover: false })
      alert('Teams and sprints initialized successfully')
    } catch (err) {
      console.error(err)
      alert('Initialization failed: ' + err.message)
    } finally {
      setInitializing(false)
    }
  }

  async function provisionInAdo() {
    setProvisioning(true)
    setProvisionReport(null)
    try {
      const emails = userEmails
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)

      const res = await fetch('/api/ado-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmails: emails, inviteSiteHumans: true })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(formatAdoApiError(json, 'Provision failed'))
      setProvisionReport(json.report)
      alert('ADO provisioning completed')
    } catch (err) {
      console.error(err)
      alert('ADO provisioning failed: ' + err.message)
    } finally {
      setProvisioning(false)
    }
  }

  async function runAdoAdminFix() {
    setAdminFixing(true)
    setAdminFixReport(null)
    try {
      const res = await fetch('/api/ado-team-admin-fix', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(formatAdoApiError(json, 'Admin fix failed'))
      setAdminFixReport(json.report)
      alert('ADO admin fix completed')
    } catch (err) {
      console.error(err)
      alert('ADO admin fix failed: ' + err.message)
    } finally {
      setAdminFixing(false)
    }
  }

  async function saveMemberEmails() {
    setSavingEmails(true)
    try {
      const lines = memberEmailInput
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)

      const emailUpdates = []
      for (const line of lines) {
        const parts = line.split(',').map((x) => x.trim())
        if (parts.length < 3) continue
        emailUpdates.push({ teamName: parts[0], memberName: parts[1], email: parts[2] })
      }

      await persistMemberEmailUpdates(emailUpdates, 'Member emails saved to site team setup')
    } catch (err) {
      console.error(err)
      alert('Save member emails failed: ' + err.message)
    } finally {
      setSavingEmails(false)
    }
  }

  async function persistMemberEmailUpdates(emailUpdates, successMessage = 'Member emails saved') {
    if (!Array.isArray(emailUpdates) || !emailUpdates.length) {
      throw new Error('No valid email updates provided')
    }

      const res = await fetch('/api/team-setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailUpdates })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(formatTeamSetupWriteError(json))
      setData({ teams: json.setup?.teams || [], sprints: json.setup?.sprints || [] })
      setDemoState((current) => (current ? { ...current, teamSetup: json.setup || current.teamSetup } : current))
      alert(successMessage)
  }

  async function runDemoAction(action) {
    if (action === 'reset') {
      const confirmed = window.confirm('Reset demo data to the baseline site setup?')
      if (!confirmed) return
    }

    setDemoBusy(action)
    setPageMessage('')

    try {
      if (action === 'load') {
        await loadThesisDemoData()
      } else {
        await resetThesisDemoData()
      }

      await load({ autoRecover: false })
      setPageMessage(
        action === 'load'
          ? 'Thesis demo setup loaded. Team, sprint, and member data now match the seeded supervisor walkthrough.'
          : 'Demo data reset to the baseline site setup.'
      )
    } catch (err) {
      console.error(err)
      setPageMessage(`Demo data action failed: ${String(err?.message || err)}`)
    } finally {
      setDemoBusy('')
    }
  }

  function getSuggestedEmailUpdatesFromReadiness() {
    const updates = (assignmentReadiness?.suggestedEmailUpdates || [])
      .map((row) => ({
        teamName: String(row?.team || '').trim(),
        memberName: String(row?.member || '').trim(),
        email: String(row?.suggestedEmail || '').trim()
      }))
      .filter((row) => row.teamName && row.memberName && row.email)

    const dedupe = new Map()
    for (const row of updates) {
      dedupe.set(`${row.teamName}::${row.memberName}`, row)
    }

    return Array.from(dedupe.values())
  }

  function fillSuggestedMemberEmails() {
    const updates = getSuggestedEmailUpdatesFromReadiness()
    if (!updates.length) {
      alert('No suggested member email updates available. Run assignment readiness first.')
      return
    }

    const lines = updates.map((x) => `${x.teamName}, ${x.memberName}, ${x.email}`)
    setMemberEmailInput(lines.join('\n'))
    alert(`Prepared ${updates.length} suggested mappings from ADO assignment readiness`) 
  }

  async function applySuggestedMemberEmails() {
    const updates = getSuggestedEmailUpdatesFromReadiness()
    if (!updates.length) {
      alert('No suggested member email updates available. Run assignment readiness first.')
      return
    }

    const confirmed = window.confirm(
      `Apply ${updates.length} suggested member email updates from assignment readiness?`
    )
    if (!confirmed) return

    setSavingEmails(true)
    try {
      await persistMemberEmailUpdates(
        updates,
        `Applied ${updates.length} suggested member email updates`
      )
      await checkAssignmentReadiness()
    } catch (err) {
      console.error(err)
      alert('Apply suggested mapping failed: ' + err.message)
    } finally {
      setSavingEmails(false)
    }
  }

  function getFallbackEmailUpdatesFromReadiness() {
    const entitledUser = assignmentReadiness?.entitledUsers?.[0] || null
    const fallbackEmail = String(entitledUser?.principalName || entitledUser?.mail || '').trim()
    if (!fallbackEmail) {
      return { fallbackEmail: null, updates: [] }
    }

    const unresolved = (assignmentReadiness?.memberChecks || []).filter(
      (x) => x.status !== 'skipped_ai' && !x.assignable
    )

    const dedupe = new Map()
    for (const row of unresolved) {
      const teamName = String(row.team || '').trim()
      const memberName = String(row.member || '').trim()
      if (!teamName || !memberName) continue
      dedupe.set(`${teamName}::${memberName}`, {
        teamName,
        memberName,
        email: fallbackEmail
      })
    }

    return {
      fallbackEmail,
      updates: Array.from(dedupe.values())
    }
  }

  function fillFallbackMemberEmails() {
    const { fallbackEmail, updates } = getFallbackEmailUpdatesFromReadiness()
    if (!fallbackEmail || !updates.length) {
      alert('No unresolved human members available for fallback mapping. Run readiness check first.')
      return
    }

    const lines = updates.map((x) => `${x.teamName}, ${x.memberName}, ${x.email}`)
    setMemberEmailInput(lines.join('\n'))
    alert(`Prepared ${updates.length} fallback mappings using ${fallbackEmail}`)
  }

  async function applyFallbackMemberEmails() {
    const { fallbackEmail, updates } = getFallbackEmailUpdatesFromReadiness()
    if (!fallbackEmail || !updates.length) {
      alert('No unresolved human members available for fallback mapping. Run readiness check first.')
      return
    }

    const confirmed = window.confirm(
      `Apply fallback email ${fallbackEmail} to ${updates.length} unresolved human members?`
    )
    if (!confirmed) return

    setSavingEmails(true)
    try {
      await persistMemberEmailUpdates(
        updates,
        `Applied fallback mapping to ${updates.length} members`
      )
      await checkAssignmentReadiness()
    } catch (err) {
      console.error(err)
      alert('Fallback mapping failed: ' + err.message)
    } finally {
      setSavingEmails(false)
    }
  }

  async function syncSiteUsersToAdo() {
    setSyncingSiteUsers(true)
    setSyncSiteUsersReport(null)
    try {
      const res = await fetch('/api/ado-sync-site-users', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(formatAdoApiError(json, 'Sync failed'))
      setSyncSiteUsersReport(json.report)
      alert('Site users sync to ADO completed')
    } catch (err) {
      console.error(err)
      alert('Site users sync failed: ' + err.message)
    } finally {
      setSyncingSiteUsers(false)
    }
  }

  async function checkAssignmentReadiness() {
    setCheckingAssignability(true)
    setAssignmentReadiness(null)
    try {
      const res = await fetch('/api/ado-assignment-readiness')
      const json = await res.json()
      if (!res.ok) throw new Error(formatAdoApiError(json, 'Assignment readiness check failed'))
      setAssignmentReadiness(json)
    } catch (err) {
      console.error(err)
      alert('Assignment readiness check failed: ' + err.message)
    } finally {
      setCheckingAssignability(false)
    }
  }

  useEffect(() => {
    void load({ autoRecover: true })
  }, [])

  function getMemberKind(member) {
    const type = String(member?.type || '').trim().toLowerCase()
    const name = String(member?.name || '').trim().toLowerCase()

    if (type.includes('human')) return 'human'

    if (
      type.startsWith('ai') ||
      type.includes('agentic') ||
      (type.includes('agent') && !type.includes('human')) ||
      /^ai[\s_-]/.test(name) ||
      name.startsWith('ai ')
    ) {
      return 'ai'
    }

    return 'unknown'
  }

  const memberStats = (data.teams || []).reduce(
    (acc, team) => {
      for (const member of team.members || []) {
        const kind = getMemberKind(member)
        acc.total += 1
        if (kind === 'ai') acc.ai += 1
        else if (kind === 'human') acc.human += 1
        else acc.unknown += 1
      }
      return acc
    },
    { total: 0, human: 0, ai: 0, unknown: 0 }
  )

  const totalMembers = memberStats.total
  const aiMembers = memberStats.ai
  const humanMembers = memberStats.human
  const activeSprint = (data.sprints || []).find((sprint) => String(sprint.status || '').toLowerCase() === 'active') || null
  const activeProfile = demoState?.status?.activeProfile?.profile || 'unknown'
  const latestSessionId = demoState?.preferredSession?.id || '-'

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <p className="eyebrow">Supporting Thesis Setup</p>
          <h1>Teams and Sprint Setup</h1>
          <p>
            Supporting setup page for the thesis demo and Sprint Planning Workspace. It surfaces seeded team,
            sprint, and member data used by the deterministic supervisor walkthrough while keeping ADO tooling as
            secondary operational support.
          </p>
        </div>

        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/evaluation">Evaluation Evidence</Link>
          <Link href="/planning-export-center">Export Center</Link>
          <Link href="/conceptual-framework">Conceptual Framework</Link>
          <Link href="/thesis-readiness-checklist">Supervisor Checklist</Link>
          <Link href="/agentic-workflow">Supporting Workflow</Link>
          <Link href="/">Home</Link>
        </div>
      </header>

      {pageMessage ? <div className="notice">{pageMessage}</div> : null}

      <section className="panel actionPanel">
        <div className="actionHead">
          <h2>Thesis Demo Setup State</h2>
          <p>
            This page should open in a populated state when deterministic thesis demo data is available.
            Use the recovery controls only if the seeded setup is missing or has been reset.
          </p>
        </div>
        <div className="demoStateGrid">
          <article>
            <h3>Active Profile</h3>
            <p className="smallStat">{activeProfile}</p>
          </article>
          <article>
            <h3>Active Sprint</h3>
            <p className="smallStat">{activeSprint?.name || 'Not configured'}</p>
          </article>
          <article>
            <h3>Latest Demo Session</h3>
            <p className="smallStat">{latestSessionId}</p>
          </article>
          <article>
            <h3>Recovery Status</h3>
            <p className="smallStat">{demoState?.needsRecovery ? 'Needs attention' : 'Ready for demo'}</p>
          </article>
        </div>
        <div className="actionRow">
          <button onClick={() => void runDemoAction('load')} disabled={Boolean(demoBusy)}>
            {demoBusy === 'load' ? 'Loading...' : 'Load Thesis Demo Data'}
          </button>
          <button onClick={() => void runDemoAction('reset')} disabled={Boolean(demoBusy)}>
            {demoBusy === 'reset' ? 'Resetting...' : 'Reset Demo Data'}
          </button>
          <button onClick={() => void load({ autoRecover: true })} disabled={loading || Boolean(demoBusy)}>
            {loading ? 'Refreshing...' : 'Refresh Setup State'}
          </button>
        </div>
      </section>

      <section className="summaryGrid">
        <article>
          <h3>Teams</h3>
          <p>{data.teams.length}</p>
        </article>
        <article>
          <h3>Sprints</h3>
          <p>{data.sprints.length}</p>
        </article>
        <article>
          <h3>Total Members</h3>
          <p>{totalMembers}</p>
        </article>
        <article>
          <h3>Human Members</h3>
          <p>{humanMembers}</p>
        </article>
        <article>
          <h3>AI Agent Members</h3>
          <p>{aiMembers}</p>
        </article>
        <article>
          <h3>Active Sprint</h3>
          <p className="smallStat">{activeSprint?.name || 'None'}</p>
        </article>
      </section>

      <section className="panel actionPanel">
        <div className="actionHead">
          <h2>Advanced Setup and Provisioning</h2>
          <p>Keep these tools for operational setup and diagnostics. They are secondary to the thesis demo storyline.</p>
        </div>
        <div className="actionRow">
          <button onClick={initializeTeams} disabled={initializing}>
            {initializing ? 'Initializing...' : 'Initialize Baseline Setup'}
          </button>
          <button onClick={provisionInAdo} disabled={provisioning}>
            {provisioning ? 'Provisioning ADO...' : 'Provision Supporting ADO Structure'}
          </button>
          <button onClick={checkAssignmentReadiness} disabled={checkingAssignability}>
            {checkingAssignability ? 'Checking Assignability...' : 'Check Assignment Readiness'}
          </button>
          <button onClick={runAdoAdminFix} disabled={adminFixing}>
            {adminFixing ? 'Running Admin Fix...' : 'Run ADO Team Admin Fix'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Optional ADO User Sync</h2>
        <p className="muted">
          Site human users are already invited by Provision Teams + Site Users in ADO. Add extra comma-separated emails only if needed.
        </p>
        <textarea
          value={userEmails}
          onChange={(e) => setUserEmails(e.target.value)}
          rows={3}
          placeholder="dev1@company.com, tester1@company.com, ba1@company.com"
        />
        <div className="inlineActions">
          <button
            onClick={syncSiteUsersToAdo}
            disabled={syncingSiteUsers}
          >
            {syncingSiteUsers ? 'Syncing Site Users...' : 'Sync Site Users to ADO'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Member Email Mapping (Advanced)</h2>
        <p className="muted">One per line. Example: Dubai Team, Noura Khan, noura@yourcompany.com</p>
        <textarea
          value={memberEmailInput}
          onChange={(e) => setMemberEmailInput(e.target.value)}
          rows={6}
          placeholder={`Dubai Team, Noura Khan, noura@company.com\nRAK Team, Rashid Noor, rashid@company.com\nAUH Team, Fatima Ali, fatima@company.com`}
        />
        <div className="inlineActions">
          <button onClick={saveMemberEmails} disabled={savingEmails}>
            {savingEmails ? 'Saving...' : 'Save Member Emails'}
          </button>
          <button onClick={fillSuggestedMemberEmails}>
            Fill Suggested Mappings
          </button>
          <button onClick={applySuggestedMemberEmails} disabled={savingEmails}>
            {savingEmails ? 'Applying Suggested...' : 'Apply Suggested Mapping'}
          </button>
          <button onClick={fillFallbackMemberEmails}>
            Fill Unresolved with Fallback
          </button>
          <button onClick={applyFallbackMemberEmails} disabled={savingEmails}>
            {savingEmails ? 'Applying Fallback...' : 'Apply Fallback Mapping'}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Suggested mapping uses readiness name-to-principal matches. Fallback mapping is temporary and maps unresolved humans to the first entitled ADO principal.
        </p>
      </section>

      {loading ? <div className="notice">Loading teams...</div> : null}

      <section className="panel">
        <h2>Seeded Sprint Setup</h2>
        {data.sprints.length === 0 ? (
          <div className="emptyState">
            <p className="muted">No sprint setup is available yet for the thesis demo.</p>
            <button onClick={() => void runDemoAction('load')} disabled={Boolean(demoBusy)}>
              {demoBusy === 'load' ? 'Loading...' : 'Load Thesis Demo Data'}
            </button>
          </div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Sprint</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.sprints.map((s) => (
                  <tr key={s.id || s.name}>
                    <td>{s.name}</td>
                    <td>{s.startDate}</td>
                    <td>{s.endDate}</td>
                    <td>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Seeded Teams and Members</h2>
        {data.teams.length === 0 ? (
          <div className="emptyState">
            <p className="muted">No thesis teams are currently loaded.</p>
            <button onClick={() => void runDemoAction('load')} disabled={Boolean(demoBusy)}>
              {demoBusy === 'load' ? 'Loading...' : 'Load Thesis Demo Data'}
            </button>
          </div>
        ) : (
          <div className="teamGrid">
            {data.teams.map((team) => (
              <article key={team.id || team.name} className="teamCard">
                {(() => {
                  const teamStats = (team.members || []).reduce(
                    (acc, member) => {
                      const kind = getMemberKind(member)
                      acc.total += 1
                      if (kind === 'ai') acc.ai += 1
                      else if (kind === 'human') acc.human += 1
                      else acc.unknown += 1
                      return acc
                    },
                    { total: 0, human: 0, ai: 0, unknown: 0 }
                  )

                  return (
                    <>
                      <h3>{team.name}</h3>
                      <p className="muted">Region: {team.region}</p>
                      <p className="muted">Members: {teamStats.total} | Human: {teamStats.human} | AI Agentic: {teamStats.ai} | Unknown: {teamStats.unknown}</p>
                    </>
                  )
                })()}
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Type</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(team.members || []).map((m, idx) => {
                        const kind = getMemberKind(m)
                        return (
                          <tr key={`${team.name}-${idx}`}>
                            <td>{m.name}</td>
                            <td>{m.role}</td>
                            <td>
                              <span className={`pill ${kind}`}>
                                {kind === 'ai' ? 'AI Agentic' : (kind === 'human' ? 'Human' : (m.type || 'Unknown'))}
                              </span>
                            </td>
                            <td>{m.email || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {provisionReport ? (
        <section className="panel report reportBlue">
          <h2>ADO Provisioning Report</h2>
          <p><strong>Project:</strong> {provisionReport.project}</p>
          <p><strong>Teams Created:</strong> {(provisionReport.teamsCreated || []).join(', ') || '-'}</p>
          <p><strong>Teams Existing:</strong> {(provisionReport.teamsExisting || []).join(', ') || '-'}</p>
          <p><strong>Sprints Created:</strong> {(provisionReport.sprintsCreated || []).join(', ') || '-'}</p>
          <p><strong>Sprints Existing:</strong> {(provisionReport.sprintsExisting || []).join(', ') || '-'}</p>
          <p><strong>Sprint Assignments:</strong> {(provisionReport.sprintAssignments || []).length}</p>
          <p><strong>Users Invited:</strong> {(provisionReport.usersInvited || []).join(', ') || '-'}</p>
          <p><strong>Site Users Discovered:</strong> {(provisionReport.usersDiscoveredFromTeams || []).length}</p>
          <p><strong>Missing Member Email:</strong> {(provisionReport.skippedNoEmail || []).length}</p>
          <p><strong>Invalid Member Email:</strong> {(provisionReport.skippedInvalidEmail || []).length}</p>
          <p><strong>Placeholder Member Email:</strong> {(provisionReport.skippedPlaceholderEmail || []).length}</p>
          <p><strong>Duplicate Member Email:</strong> {(provisionReport.duplicateEmails || []).length}</p>

          {provisionReport.userInviteErrors?.length ? (
            <div>
              <strong>User Invite Errors:</strong>
              <ul>
                {provisionReport.userInviteErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          ) : null}

          {provisionReport.duplicateEmails?.length ? (
            <div>
              <strong>Duplicate Team Member Emails</strong>
              <ul>
                {provisionReport.duplicateEmails.map((row, i) => (
                  <li key={`dup-${i}`}>{row.team} / {row.member} / {row.email}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {provisionReport.warnings?.length ? (
            <div>
              <strong>Warnings:</strong>
              <ul>
                {provisionReport.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {adminFixReport ? (
        <section className="panel report reportViolet">
          <h2>ADO Team Admin Fix Report</h2>
          <p><strong>Project:</strong> {adminFixReport.project}</p>
          <p>
            <strong>Team settings updates:</strong>{' '}
            {(adminFixReport.teamSettings || []).filter((x) => x.ok).length} / {(adminFixReport.teamSettings || []).length}
          </p>
          <p>
            <strong>Sprint assignments:</strong>{' '}
            {(adminFixReport.sprintAssignments || []).filter((x) => x.ok).length} / {(adminFixReport.sprintAssignments || []).length}
          </p>

          <div>
            <strong>Team Settings</strong>
            <ul>
              {(adminFixReport.teamSettings || []).map((x, i) => (
                <li key={`teamset-${i}`}>
                  {x.team}: {x.ok ? 'OK' : 'FAILED'} ({x.status}) - {x.message}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <strong>Sprint Assignments</strong>
            <ul>
              {(adminFixReport.sprintAssignments || []).map((x, i) => (
                <li key={`assign-${i}`}>
                  {x.team} / {x.sprint}: {x.ok ? 'OK' : 'FAILED'} ({x.status}) - {x.message}
                </li>
              ))}
            </ul>
          </div>

          {(adminFixReport.diagnostics || []).length ? (
            <div>
              <strong>Diagnostics</strong>
              <ul>
                {(adminFixReport.diagnostics || []).map((x, i) => (
                  <li key={`diag-${i}`}>{x.team} / {x.step}: {x.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {syncSiteUsersReport ? (
        <section className="panel report reportTeal">
          <h2>Site Users Sync Report</h2>
          <p><strong>Invited:</strong> {(syncSiteUsersReport.invited || []).length}</p>
          <p><strong>Failed:</strong> {(syncSiteUsersReport.failed || []).length}</p>
          <p><strong>Blocked by Org Policy:</strong> {(syncSiteUsersReport.blockedByOrgPolicy || []).length}</p>
          <p><strong>Skipped (No Email):</strong> {(syncSiteUsersReport.skippedNoEmail || []).length}</p>
          <p><strong>Skipped (Invalid Email):</strong> {(syncSiteUsersReport.skippedInvalidEmail || []).length}</p>
          <p><strong>Skipped (Placeholder/Test Email):</strong> {(syncSiteUsersReport.skippedPlaceholderEmail || []).length}</p>
          <p><strong>Skipped (AI Agents):</strong> {(syncSiteUsersReport.skippedAiAgents || []).length}</p>

          {(syncSiteUsersReport.blockedByOrgPolicy || []).length ? (
            <div>
              <strong>Policy Guidance</strong>
              <ul>
                <li>These users are not in the Azure DevOps tenant directory allowed by organization security settings.</li>
                <li>Use Entra ID emails from the same tenant, or ask org admin to allow external invitations.</li>
              </ul>
            </div>
          ) : null}

          {(syncSiteUsersReport.skippedPlaceholderEmail || []).length ? (
            <div>
              <strong>Placeholder Emails Skipped</strong>
              <ul>
                {(syncSiteUsersReport.skippedPlaceholderEmail || []).map((x, i) => (
                  <li key={`pe-${i}`}>{x.team} / {x.member} / {x.email}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(syncSiteUsersReport.blockedByOrgPolicy || []).length ? (
            <div>
              <strong>Blocked by Org Policy</strong>
              <ul>
                {(syncSiteUsersReport.blockedByOrgPolicy || []).map((x, i) => (
                  <li key={`b-${i}`}>{x.team} / {x.member} / {x.email}: {x.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(syncSiteUsersReport.failed || []).length ? (
            <div>
              <strong>Failed Invites</strong>
              <ul>
                {(syncSiteUsersReport.failed || []).map((x, i) => (
                  <li key={`f-${i}`}>{x.team} / {x.member} / {x.email}: {x.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {assignmentReadiness ? (
        <section className="panel report reportAmber">
          <h2>Assignment Readiness Report</h2>
          <p><strong>Organization:</strong> {assignmentReadiness.organization}</p>
          <p><strong>Entitled ADO Users:</strong> {assignmentReadiness.summary?.entitledAdoUsers || 0}</p>
          <p><strong>Human Members:</strong> {assignmentReadiness.summary?.humanMembers || 0}</p>
          <p><strong>Assignable Humans:</strong> {assignmentReadiness.summary?.assignableHumans || 0}</p>
          <p><strong>Unresolved Humans:</strong> {assignmentReadiness.summary?.unresolvedHumans || 0}</p>
          <p><strong>Missing Email:</strong> {assignmentReadiness.summary?.missingEmail || 0}</p>
          <p><strong>Invalid Email:</strong> {assignmentReadiness.summary?.invalidEmail || 0}</p>
          <p><strong>Placeholder Email:</strong> {assignmentReadiness.summary?.placeholderEmail || 0}</p>
          <p><strong>Suggested Email Updates:</strong> {assignmentReadiness.summary?.suggestedEmailUpdates || 0}</p>

          {(assignmentReadiness.entitledUsers || []).length ? (
            <div>
              <strong>Entitled ADO Users</strong>
              <ul>
                {(assignmentReadiness.entitledUsers || []).map((x, i) => (
                  <li key={`au-${i}`}>{x.displayName} / {x.principalName}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(assignmentReadiness.suggestedEmailUpdates || []).length ? (
            <div>
              <strong>Suggested Member Email Updates</strong>
              <ul>
                {(assignmentReadiness.suggestedEmailUpdates || []).map((x, i) => (
                  <li key={`su-${i}`}>{x.team} / {x.member}: {x.currentEmail || '-'} {' -> '} {x.suggestedEmail}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(assignmentReadiness.memberChecks || []).filter((x) => x.status !== 'skipped_ai' && !x.assignable).length ? (
            <div>
              <strong>Unresolved Human Members</strong>
              <ul>
                {(assignmentReadiness.memberChecks || [])
                  .filter((x) => x.status !== 'skipped_ai' && !x.assignable)
                  .map((x, i) => (
                    <li key={`ur-${i}`}>{x.team} / {x.member} / {x.email || '-'}: {x.reason}</li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

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
            radial-gradient(circle at 12% 10%, rgba(20, 143, 180, 0.13), transparent 42%),
            radial-gradient(circle at 85% 12%, rgba(57, 118, 218, 0.14), transparent 46%),
            linear-gradient(180deg, #f8fbff, #eef4ff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 33px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #0a5b8a;
          font-weight: 700;
        }

        .hero p {
          margin: 8px 0 0;
          color: #3d536d;
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
          color: #0d3a64;
          border: 1px solid #c9dcf1;
          border-radius: 999px;
          background: #fff;
          padding: 7px 13px;
          font-weight: 700;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          margin-bottom: 12px;
        }

        .summaryGrid article {
          border: 1px solid #d6e3f4;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 12px 30px rgba(17, 24, 39, 0.06);
          padding: 11px;
        }

        .summaryGrid h3 {
          margin: 0;
          font-size: 13px;
          color: #3d536d;
        }

        .summaryGrid p {
          margin: 5px 0 0;
          font-size: 28px;
          font-weight: 700;
        }

        .summaryGrid p.smallStat {
          font-size: 16px;
          line-height: 1.3;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          margin-bottom: 14px;
        }

        .actionHead h2,
        .panel h2 {
          margin: 0;
          font-size: 22px;
        }

        .actionHead p {
          margin: 6px 0 0;
          color: #4c6480;
          font-size: 13px;
        }

        .actionRow {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        button {
          border: none;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          font-weight: 700;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
          padding: 8px 12px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .muted {
          color: #4c6480;
        }

        .inlineActions {
          margin-top: 10px;
          display: flex;
          gap: 10px;
        }

        textarea,
        input,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          padding: 8px;
          font-size: 13px;
          color: #10223a;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          margin-top: 8px;
        }

        .notice {
          border: 1px solid #8be1dc;
          background: #ecfeff;
          color: #134e4a;
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 12px;
        }

        .demoStateGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin-top: 10px;
        }

        .demoStateGrid article {
          border: 1px solid #d6e3f4;
          border-radius: 12px;
          background: #fbfdff;
          padding: 11px;
        }

        .emptyState {
          display: grid;
          gap: 10px;
        }

        .teamGrid {
          display: grid;
          gap: 12px;
        }

        .teamCard {
          border: 1px solid #d7e4f5;
          border-radius: 12px;
          background: #fbfdff;
          padding: 12px;
        }

        .teamCard h3 {
          margin: 0;
        }

        .tableWrap {
          overflow: auto;
          margin-top: 8px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          font-size: 13px;
          min-width: 580px;
        }

        th {
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid #dce8f6;
          color: #344d69;
          font-weight: 700;
          background: #f7fbff;
        }

        td {
          border-bottom: 1px solid #e8eff9;
          padding: 8px 10px;
          vertical-align: top;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 2px 9px;
          font-size: 11px;
          font-weight: 700;
        }

        .pill.human {
          color: #0b4c8f;
          background: #dbeafe;
          border: 1px solid #93c5fd;
        }

        .pill.ai {
          color: #0f766e;
          background: #ccfbf1;
          border: 1px solid #5eead4;
        }

        .pill.unknown {
          color: #6b7280;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
        }

        .report {
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        .reportBlue {
          background: #f8fbff;
        }

        .reportViolet {
          background: #f6f2ff;
        }

        .reportTeal {
          background: #ecfeff;
        }

        .reportAmber {
          background: #fffbeb;
        }

        .report ul {
          margin-top: 6px;
        }

        @media (max-width: 1080px) {
          .summaryGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .demoStateGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .heroLinks {
            justify-content: flex-start;
          }

          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .demoStateGrid {
            grid-template-columns: 1fr;
          }

          .actionRow {
            flex-direction: column;
          }

          button {
            width: 100%;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}