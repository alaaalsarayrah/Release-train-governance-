import { useState, useEffect } from 'react'

export default function AdoConfig() {
  const [org, setOrg] = useState('')
  const [project, setProject] = useState('')
  const [pat, setPat] = useState('')
  const [defaultAssignedTo, setDefaultAssignedTo] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load existing config on mount
    fetch('/api/ado-config')
      .then(r => r.json())
      .then(data => {
        setOrg(data.organization || '')
        setProject(data.project || '')
        setDefaultAssignedTo(data.defaultAssignedTo || '')
        setLoading(false)
      })
      .catch(e => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  async function save() {
    if (!org || !project || !pat) {
      setError('All fields required')
      return
    }
    setError('')
    const res = await fetch('/api/ado-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization: org,
        project,
        pat,
        defaultAssignedTo
      })
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setPat('')
    } else {
      const data = await res.json()
      setError(data.message)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Azure DevOps Configuration</h2>
      <p style={{ color: '#666' }}>
        Configure your ADO connection so the system can create user stories automatically.
      </p>

      <label>
        Organization (e.g., mycompany):
        <input
          type="text"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          placeholder="myorganization"
        />
      </label>

      <label>
        Project:
        <input type="text" value={project} onChange={(e) => setProject(e.target.value)} placeholder="MyProject" />
      </label>

      <label>
        Personal Access Token (PAT):
        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="paste your ADO PAT here"
        />
        <small style={{ display: 'block', marginTop: 4, color: '#666' }}>
          Get one from https://dev.azure.com/{org || 'yourorg'}/_usersSettings/tokens
        </small>
      </label>

      <label>
        Default Assigned To (optional):
        <input
          type="text"
          value={defaultAssignedTo}
          onChange={(e) => setDefaultAssignedTo(e.target.value)}
          placeholder="user@company.com"
        />
        <small style={{ display: 'block', marginTop: 4, color: '#666' }}>
          Used for new ADO work items when team-based assignee resolution is unavailable.
        </small>
      </label>

      {error && <div style={{ color: 'red' }}>{error}</div>}
      {saved && <div style={{ color: 'green' }}>✓ Configuration saved</div>}

      <button onClick={save}>Save ADO Config</button>

      <style jsx>{`
        label {
          display: grid;
          gap: 4;
        }
        input {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          background: #3b82f6;
          color: white;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
