import { useState } from 'react'

export default function SafeAgent() {
  const [backlog, setBacklog] = useState([
    { id: 1, title: 'Migrate auth to OAuth2', value: 8, risk: 6, deps: [], effort: 5 },
    { id: 2, title: 'API rate limiting', value: 6, risk: 3, deps: [], effort: 3 },
    { id: 3, title: 'Frontend performance audit', value: 7, risk: 2, deps: [], effort: 4 },
    { id: 4, title: 'Implement caching layer', value: 9, risk: 4, deps: [2], effort: 5 },
    { id: 5, title: 'Database indexing optimization', value: 7, risk: 5, deps: [], effort: 3 },
    { id: 6, title: 'Security patch deployment', value: 10, risk: 8, deps: [1], effort: 2 },
    { id: 7, title: 'Load testing infrastructure', value: 6, risk: 1, deps: [5], effort: 4 },
    { id: 8, title: 'Monitoring dashboard v2', value: 5, risk: 2, deps: [], effort: 3 }
  ])

  const [velocity, setVelocity] = useState(12)
  const [plan, setPlan] = useState([])
  const [reasoning, setReasoning] = useState([])

  function scorePriority(item) {
    // SAFe-inspired scoring: value is primary, risk is secondary, dependencies lower priority
    const baseScore = item.value / Math.max(1, item.risk)
    const dependencyPenalty = item.deps.length > 0 ? 0.7 : 1.0
    return baseScore * dependencyPenalty
  }

  function canInclude(item, selected) {
    // Check if all dependencies are already in the plan
    return item.deps.every(depId => selected.some(s => s.id === depId))
  }

  function planSprint() {
    const logs = []
    
    // Sort by priority score
    const scored = backlog.map(t => ({
      ...t,
      priority: scorePriority(t),
      effort: t.effort
    }))

    logs.push(`Starting SAFe sprint planning with velocity cap of ${velocity} points...`)
    logs.push('Prioritizing by: Value/Risk ratio, with dependency resolution.')

    const selection = []
    let capacity = velocity
    let riskSum = 0

    for (const item of scored.sort((a, b) => b.priority - a.priority)) {
      if (canInclude(item, selection) && item.effort <= capacity) {
        selection.push(item)
        capacity -= item.effort
        riskSum += item.risk
        logs.push(`✓ Added "${item.title}" (effort: ${item.effort}, value: ${item.value}, risk: ${item.risk})`)
      } else if (!canInclude(item, selection)) {
        logs.push(`✗ Deferred "${item.title}" — blocked by dependencies`)
      } else {
        logs.push(`✗ Skipped "${item.title}" — insufficient capacity`)
      }
    }

    logs.push(`\nSprint Summary: ${selection.length} items, ${velocity - capacity}/${velocity} capacity used, aggregate risk=${riskSum}`)
    if (riskSum > 20) {
      logs.push('⚠ High aggregate risk detected. Consider security/stability items first.')
    }

    setPlan(selection)
    setReasoning(logs)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label>Velocity:</label>
        <input type="range" min="4" max="20" value={velocity} onChange={(e) => setVelocity(Number(e.target.value))} />
        <strong>{velocity} pts</strong>
        <button onClick={planSprint} style={{ marginLeft: 'auto' }}>Run SAFe Planning</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="panel">
          <h3>Product Backlog</h3>
          <table style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: 4 }}>Item</th>
                <th style={{ textAlign: 'center', padding: 4 }}>V</th>
                <th style={{ textAlign: 'center', padding: 4 }}>R</th>
                <th style={{ textAlign: 'center', padding: 4 }}>E</th>
              </tr>
            </thead>
            <tbody>
              {backlog.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 4 }}>{t.title.slice(0, 20)}</td>
                  <td style={{ textAlign: 'center', padding: 4 }}>{t.value}</td>
                  <td style={{ textAlign: 'center', padding: 4 }}>{t.risk}</td>
                  <td style={{ textAlign: 'center', padding: 4 }}>{t.effort}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <small style={{ marginTop: 8, display: 'block', color: '#666' }}>V=Value, R=Risk, E=Effort</small>
        </div>

        <div className="panel">
          <h3>Planned Sprint</h3>
          {plan.length === 0 ? (
            <p style={{ color: '#666' }}>No plan yet</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {plan.map((t) => (
                <li key={t.id} style={{ marginBottom: 6 }}>
                  <strong>{t.title}</strong>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Value:{t.value} Risk:{t.risk} Effort:{t.effort}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div style={{ marginTop: 12, padding: 8, background: '#f0f0f0', borderRadius: 4 }}>
            <small>
              <strong>Capacity:</strong> {plan.reduce((s, t) => s + t.effort, 0)}/{velocity}
            </small>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Agent Reasoning Log</h3>
        <pre style={{ fontSize: 11, background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto', maxHeight: 200 }}>
          {reasoning.join('\n')}
        </pre>
      </div>

      <style jsx>{`
        .panel { background: #fafafa; padding: 12px; border-radius: 8px }
      `}</style>
    </div>
  )
}
