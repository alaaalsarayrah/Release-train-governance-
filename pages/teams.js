import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function TeamsPage() {
  const [data, setData] = useState({ teams: [], sprints: [] })
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [provisionReport, setProvisionReport] = useState(null)
  const [userEmails, setUserEmails] = useState('')
  const [memberEmailInput, setMemberEmailInput] = useState('')
  const [savingEmails, setSavingEmails] = useState(false)
  const [syncingSiteUsers, setSyncingSiteUsers] = useState(false)
  const [syncSiteUsersReport, setSyncSiteUsersReport] = useState(null)
  const [adminFixing, setAdminFixing] = useState(false)
  const [adminFixReport, setAdminFixReport] = useState(null)

  async function load() {
    try {
      const res = await fetch('/api/team-setup')
      const json = await res.json()
      setData({ teams: json.teams || [], sprints: json.sprints || [] })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function initializeTeams() {
    setInitializing(true)
    try {
      const res = await fetch('/api/team-setup', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to initialize teams')
      setData({ teams: json.setup?.teams || [], sprints: json.setup?.sprints || [] })
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
        body: JSON.stringify({ userEmails: emails })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Provision failed')
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
      if (!res.ok) throw new Error(json.message || 'Admin fix failed')
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

      const res = await fetch('/api/team-setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailUpdates })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to save emails')
      setData({ teams: json.setup?.teams || [], sprints: json.setup?.sprints || [] })
      alert('Member emails saved to site team setup')
    } catch (err) {
      console.error(err)
      alert('Save member emails failed: ' + err.message)
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
      if (!res.ok) throw new Error(json.message || 'Sync failed')
      setSyncSiteUsersReport(json.report)
      alert('Site users sync to ADO completed')
    } catch (err) {
      console.error(err)
      alert('Site users sync failed: ' + err.message)
    } finally {
      setSyncingSiteUsers(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totalMembers = (data.teams || []).reduce((acc, team) => acc + (team.members || []).length, 0)
  const aiMembers = (data.teams || []).reduce(
    (acc, team) => acc + (team.members || []).filter((m) => String(m.type || '').toLowerCase() === 'ai').length,
    0
  )
  const humanMembers = totalMembers - aiMembers

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Teams and Sprint Setup</h1>
          <p>
            Configure regional squads, map member emails, and provision Azure DevOps project structure for delivery.
          </p>
        </div>

        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/agentic-workflow">Workflow Console</Link>
          <Link href="/agentic-config">Personas & Audit</Link>
          <Link href="/scrum-master">Scrum Master</Link>
        </div>
      </header>

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
          <h3>AI Agents</h3>
          <p>{aiMembers}</p>
        </article>
      </section>

      <section className="panel actionPanel">
        <div className="actionHead">
          <h2>Provisioning Actions</h2>
          <p>Initialize site setup first, then provision ADO resources and run diagnostics if needed.</p>
        </div>
        <div className="actionRow">
          <button onClick={initializeTeams} disabled={initializing}>
            {initializing ? 'Initializing...' : 'Initialize Dubai / RAK / AUH'}
          </button>
          <button onClick={provisionInAdo} disabled={provisioning}>
            {provisioning ? 'Provisioning ADO...' : 'Provision in Azure DevOps'}
          </button>
          <button onClick={runAdoAdminFix} disabled={adminFixing}>
            {adminFixing ? 'Running Admin Fix...' : 'Run ADO Team Admin Fix'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Optional: Invite Human Users to ADO</h2>
        <p className="muted">
          Enter comma-separated emails for developers, testers, and business users to invite into Azure DevOps.
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
        <h2>Member Email Mapping (Team, Member, Email)</h2>
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
        </div>
      </section>

      {loading ? <div className="notice">Loading teams...</div> : null}

      <section className="panel">
        <h2>Sprints</h2>
        {data.sprints.length === 0 ? (
          <p className="muted">No sprints configured.</p>
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
        <h2>Teams and Members (Human + AI Agents)</h2>
        {data.teams.length === 0 ? (
          <p className="muted">No teams configured.</p>
        ) : (
          <div className="teamGrid">
            {data.teams.map((team) => (
              <article key={team.id || team.name} className="teamCard">
                <h3>{team.name}</h3>
                <p className="muted">Region: {team.region}</p>
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
                      {(team.members || []).map((m, idx) => (
                        <tr key={`${team.name}-${idx}`}>
                          <td>{m.name}</td>
                          <td>{m.role}</td>
                          <td>
                            <span className={`pill ${String(m.type || '').toLowerCase() === 'ai' ? 'ai' : 'human'}`}>
                              {m.type}
                            </span>
                          </td>
                          <td>{m.email || '-'}</td>
                        </tr>
                      ))}
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

          {provisionReport.userInviteErrors?.length ? (
            <div>
              <strong>User Invite Errors:</strong>
              <ul>
                {provisionReport.userInviteErrors.map((e, i) => <li key={i}>{e}</li>)}
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
          <p><strong>Skipped (No Email):</strong> {(syncSiteUsersReport.skippedNoEmail || []).length}</p>
          <p><strong>Skipped (AI Agents):</strong> {(syncSiteUsersReport.skippedAiAgents || []).length}</p>

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
          grid-template-columns: repeat(5, minmax(0, 1fr));
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

        .report ul {
          margin-top: 6px;
        }

        @media (max-width: 1080px) {
          .summaryGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
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