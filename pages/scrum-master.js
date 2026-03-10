import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ScrumMaster() {
  const [requests, setRequests] = useState([])
  const [selectedBR, setSelectedBR] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [backlog, setBacklog] = useState(null)
  const [adoResults, setAdoResults] = useState(null)
  const [creatingInADO, setCreatingInADO] = useState(false)
  const [teamSetup, setTeamSetup] = useState({ teams: [], sprints: [] })
  const [selectedTeam, setSelectedTeam] = useState('Dubai Team')
  const [selectedSprint, setSelectedSprint] = useState('Sprint 1')

  useEffect(() => {
    void fetchRequests()
    fetch('/api/team-setup')
      .then((r) => r.json())
      .then((j) => setTeamSetup({ teams: j.teams || [], sprints: j.sprints || [] }))
      .catch((err) => console.error(err))
  }, [])

  async function fetchRequests() {
    setLoading(true)
    try {
      const res = await fetch('/api/business-request')
      const json = await res.json()
      const withReqs = (json.requests || []).filter((r) => r.requirement_created)
      setRequests(withReqs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function analyzeRequirements(brId) {
    setProcessing(true)
    setBacklog(null)
    setAdoResults(null)
    try {
      const res = await fetch('/api/scrum-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Analysis failed')
      setBacklog(data.backlog)
      setSelectedBR(brId)
    } catch (err) {
      console.error(err)
      alert('Failed to analyze requirements: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function createInAzureDevOps() {
    if (!backlog) return
    setCreatingInADO(true)
    setAdoResults(null)

    try {
      const res = await fetch('/api/create-ado-backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backlog,
          teamName: selectedTeam,
          sprintName: selectedSprint,
          brId: selectedBR
        })
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.message && data.message.includes('not configured')) {
          throw new Error('Azure DevOps not configured. Open ADO Config and set Organization, Project, and PAT.')
        }
        throw new Error(data.message || 'ADO creation failed')
      }

      setAdoResults(data)

      if (selectedBR) {
        try {
          await fetch('/api/business-request', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: selectedBR,
              synced_to_ado: 1,
              ado_backlog_id: data.summary.epicsCreated > 0 ? (data.results.epics[0]?.id || null) : null,
              team_name: selectedTeam,
              sprint_name: selectedSprint,
              epic_status: data.summary.epicsCreated > 0 ? 'Created' : 'Not Created',
              user_story_status: data.summary.userStoriesCreated > 0 ? 'Created' : 'Not Created'
            })
          })
          await fetchRequests()
        } catch (err) {
          console.error('Failed to update sync flag:', err)
        }
      }

      alert(
        `Created ${data.summary.epicsCreated} epics, ${data.summary.featuresCreated} features, ${data.summary.userStoriesCreated} user stories, and ${data.summary.tasksCreated || 0} tasks in Azure DevOps.`
      )
    } catch (err) {
      console.error(err)
      alert('Failed to create backlog in ADO: ' + err.message)
    } finally {
      setCreatingInADO(false)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>AI Scrum Master - Loan Servicing Squad</h1>
          <p>
            Generate epics, features, and user stories from approved business requirements,
            then push the structured backlog into Azure DevOps.
          </p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/agentic-workflow">Workflow Console</Link>
          <Link href="/teams">Teams</Link>
          <Link href="/ado-work-item-types">ADO Types</Link>
        </div>
      </header>

      {loading ? <div className="notice">Loading business requests...</div> : null}

      {!loading ? (
        <>
          <section className="panel">
            <h2>Select Business Request</h2>
            <p className="muted">
              Choose a request with completed requirements. The AI Scrum Master will extract backlog items for the selected team and sprint.
            </p>

            <div className="selectors">
              <label>
                Team
                <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
                  {(teamSetup.teams || []).map((t) => (
                    <option key={t.id || t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Sprint
                <select value={selectedSprint} onChange={(e) => setSelectedSprint(e.target.value)}>
                  {(teamSetup.sprints || []).map((s) => (
                    <option key={s.id || s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {requests.length === 0 ? (
              <p className="muted">No business requests with requirements found.</p>
            ) : (
              <div className="requestGrid">
                {requests.map((r) => (
                  <article
                    key={r.id}
                    className={`requestCard ${selectedBR === r.id ? 'active' : ''}`}
                    onClick={() => {
                      if (!processing) void analyzeRequirements(r.id)
                    }}
                  >
                    <div className="requestTop">
                      <strong>
                        {r.id}
                        {r.synced_to_ado ? <span className="chip good">Synced to ADO</span> : null}
                      </strong>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          void analyzeRequirements(r.id)
                        }}
                        disabled={processing}
                      >
                        {processing ? 'Analyzing...' : 'Analyze'}
                      </button>
                    </div>

                    <p>{r.description?.substring(0, 120) || '(no description)'}</p>
                    <div className="meta">Unit: {r.unit || '-'} | Urgency: {r.urgency || '-'}</div>
                    <div className="meta">Team: {r.team_name || 'Not assigned'} | Sprint: {r.sprint_name || 'Not assigned'}</div>
                    <div className="meta">Epic: {r.epic_status || 'Not Created'} | User Story: {r.user_story_status || 'Not Created'}</div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {backlog ? (
            <section className="panel">
              <h2>Generated Backlog</h2>

              {backlog.epics?.length ? (
                <div className="block">
                  <h3>Epics ({backlog.epics.length})</h3>
                  {backlog.epics.map((epic, idx) => (
                    <article key={idx} className="itemCard epic">
                      <h4>{epic.title}</h4>
                      <p>{epic.description}</p>
                      <div className="metaRow">
                        <span>Business Value: {epic.businessValue || '-'}</span>
                        <span>Effort: {epic.effort || '-'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {backlog.features?.length ? (
                <div className="block">
                  <h3>Features ({backlog.features.length})</h3>
                  {backlog.features.map((feature, idx) => (
                    <article key={idx} className="itemCard feature">
                      <h4>{feature.title}</h4>
                      <p>{feature.description}</p>
                      <div className="metaRow">
                        <span>Epic: {feature.epic || '-'}</span>
                        <span>Priority: {feature.priority || '-'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {backlog.userStories?.length ? (
                <div className="block">
                  <h3>User Stories ({backlog.userStories.length})</h3>
                  {backlog.userStories.map((story, idx) => (
                    <article key={idx} className="itemCard story">
                      <h4>{story.title}</h4>
                      <p className="storyText">{story.userStory}</p>
                      {story.acceptanceCriteria?.length ? (
                        <ul>
                          {story.acceptanceCriteria.map((ac, i) => (
                            <li key={i}>{ac}</li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="metaRow">
                        <span>Feature: {story.feature || '-'}</span>
                        <span>Story Points: {story.points || '-'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="centerAction">
                <button onClick={createInAzureDevOps} disabled={creatingInADO}>
                  {creatingInADO ? 'Creating in Azure DevOps...' : 'Create Backlog in Azure DevOps'}
                </button>
              </div>
            </section>
          ) : null}

          {adoResults ? (
            <section className="panel result">
              <h2>Azure DevOps Backlog Created</h2>

              <div className="summaryCards">
                <article>
                  <p>{adoResults.summary.epicsCreated}</p>
                  <span>Epics</span>
                </article>
                <article>
                  <p>{adoResults.summary.featuresCreated}</p>
                  <span>Features</span>
                </article>
                <article>
                  <p>{adoResults.summary.userStoriesCreated}</p>
                  <span>User Stories</span>
                </article>
                <article>
                  <p>{adoResults.summary.tasksCreated || 0}</p>
                  <span>Tasks</span>
                </article>
              </div>

              {adoResults.metadata ? (
                <div className="metaRow" style={{ marginTop: 8 }}>
                  <span>Process: {adoResults.metadata.processHint || '-'}</span>
                  <span>Epic Type: {adoResults.metadata.typeMapping?.epicType || '-'}</span>
                  <span>Feature Type: {adoResults.metadata.typeMapping?.featureType || '-'}</span>
                  <span>Story Type: {adoResults.metadata.typeMapping?.storyType || '-'}</span>
                  <span>Task Type: {adoResults.metadata.typeMapping?.taskType || '-'}</span>
                  <span>Sprint Path: {adoResults.metadata.iterationPath || 'Not assigned'}</span>
                  <span>Burndown Ready: {adoResults.metadata.burndownReady ? 'Yes' : 'No'}</span>
                </div>
              ) : null}

              {adoResults.metadata?.guardrails?.length ? (
                <div className="errorBox" style={{ borderColor: '#f59e0b', background: '#fffbeb', color: '#7c2d12' }}>
                  <h3>Mapping Guardrails</h3>
                  {adoResults.metadata.guardrails.map((warn, idx) => (
                    <p key={idx}>{warn}</p>
                  ))}
                </div>
              ) : null}

              <div className="details">
                {adoResults.results?.epics?.length ? (
                  <div>
                    <h3>Epics</h3>
                    {adoResults.results.epics.map((epic, idx) => (
                      <a key={idx} className="itemLink" href={epic.url} target="_blank" rel="noreferrer">
                        #{epic.id} - {epic.title}
                      </a>
                    ))}
                  </div>
                ) : null}

                {adoResults.results?.features?.length ? (
                  <div>
                    <h3>Features</h3>
                    {adoResults.results.features.map((feature, idx) => (
                      <a key={idx} className="itemLink" href={feature.url} target="_blank" rel="noreferrer">
                        #{feature.id} - {feature.title}
                      </a>
                    ))}
                  </div>
                ) : null}

                {adoResults.results?.userStories?.length ? (
                  <div>
                    <h3>User Stories</h3>
                    {adoResults.results.userStories.map((story, idx) => (
                      <a key={idx} className="itemLink" href={story.url} target="_blank" rel="noreferrer">
                        #{story.id} - {story.title}
                      </a>
                    ))}
                  </div>
                ) : null}

                {adoResults.results?.tasks?.length ? (
                  <div>
                    <h3>Tasks</h3>
                    {adoResults.results.tasks.map((task, idx) => (
                      <a key={idx} className="itemLink" href={task.url} target="_blank" rel="noreferrer">
                        #{task.id} - {task.title}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              {adoResults.results?.warnings?.length ? (
                <div className="errorBox" style={{ borderColor: '#facc15', background: '#fffbeb', color: '#78350f' }}>
                  <h3>Warnings</h3>
                  {adoResults.results.warnings.map((warn, idx) => (
                    <p key={idx}>{warn}</p>
                  ))}
                </div>
              ) : null}

              {adoResults.results?.errors?.length ? (
                <div className="errorBox">
                  <h3>Errors</h3>
                  {adoResults.results.errors.map((err, idx) => (
                    <p key={idx}>
                      {typeof err === 'string'
                        ? err
                        : `${err.type || 'Item'}: ${err.title || ''} ${err.error || ''}`}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 1280px;
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
            radial-gradient(circle at 84% 14%, rgba(57, 118, 218, 0.14), transparent 44%),
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
          font-size: 34px;
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

        .notice,
        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
          margin-bottom: 14px;
        }

        .notice {
          color: #48617d;
        }

        .panel h2 {
          margin: 0;
          font-size: 23px;
        }

        .muted {
          color: #4d647e;
          margin-top: 8px;
          font-size: 13px;
        }

        .selectors {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        label {
          display: grid;
          gap: 4px;
          font-size: 12px;
          font-weight: 700;
          color: #35506b;
          min-width: 220px;
        }

        select {
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          padding: 8px;
          color: #11253d;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        .requestGrid {
          margin-top: 10px;
          display: grid;
          gap: 8px;
        }

        .requestCard {
          border: 1px solid #cfe0f4;
          border-radius: 12px;
          background: #f8fbff;
          padding: 10px;
          cursor: pointer;
        }

        .requestCard.active {
          border-color: #258ec4;
          box-shadow: 0 0 0 2px rgba(37, 142, 196, 0.2);
        }

        .requestTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .requestTop strong {
          color: #0d4c8f;
        }

        .requestTop p,
        .requestCard p {
          margin: 8px 0 0;
        }

        .meta {
          margin-top: 6px;
          font-size: 12px;
          color: #5b728a;
        }

        button {
          border: none;
          border-radius: 9px;
          padding: 7px 11px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chip {
          margin-left: 8px;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          border: 1px solid transparent;
        }

        .chip.good {
          color: #0f5b3f;
          background: #dcfce7;
          border-color: #86efac;
        }

        .block {
          margin-top: 14px;
        }

        .block h3 {
          margin: 0 0 8px;
        }

        .itemCard {
          border: 1px solid #d7e4f5;
          border-radius: 11px;
          background: #fbfdff;
          padding: 10px;
          margin-bottom: 8px;
        }

        .itemCard h4 {
          margin: 0;
        }

        .itemCard p {
          margin: 8px 0 0;
          color: #3f5873;
          font-size: 13px;
        }

        .storyText {
          font-style: italic;
        }

        ul {
          margin-top: 8px;
          color: #3f5873;
          font-size: 13px;
        }

        .metaRow {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 12px;
          color: #5b728a;
        }

        .epic { border-left: 4px solid #6366f1; }
        .feature { border-left: 4px solid #10b981; }
        .story { border-left: 4px solid #f59e0b; }

        .centerAction {
          margin-top: 14px;
          text-align: center;
        }

        .result {
          background: #f0f9ff;
          border-color: #93c5fd;
        }

        .summaryCards {
          margin-top: 10px;
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .summaryCards article {
          border: 1px solid #d7e4f5;
          border-radius: 11px;
          background: #fff;
          padding: 10px;
          text-align: center;
        }

        .summaryCards p {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          color: #0b4c8f;
        }

        .summaryCards span {
          font-size: 12px;
          color: #5b728a;
          font-weight: 700;
        }

        .details {
          margin-top: 14px;
          display: grid;
          gap: 12px;
        }

        .details h3 {
          margin: 0 0 8px;
          font-size: 15px;
          color: #3e5671;
        }

        .itemLink {
          display: block;
          padding: 8px;
          border: 1px solid #d7e4f5;
          border-radius: 8px;
          background: #fff;
          text-decoration: none;
          color: #0b4c8f;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 700;
        }

        .errorBox {
          margin-top: 12px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          padding: 10px;
        }

        .errorBox h3 {
          margin: 0 0 6px;
          color: #991b1b;
          font-size: 14px;
        }

        .errorBox p {
          margin: 0 0 4px;
          font-size: 12px;
          color: #7f1d1d;
        }

        @media (max-width: 900px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }

          .summaryCards {
            grid-template-columns: 1fr;
          }

          .selectors {
            flex-direction: column;
          }

          label {
            min-width: 0;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
