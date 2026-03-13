import { useState } from 'react'

export default function ScrumAgent() {
  const [backlog, setBacklog] = useState(() => [
    { id: 1, title: 'Create research questions', priority: 5, cost: 2 },
    { id: 2, title: 'Literature review: agentic AI', priority: 8, cost: 5 },
    { id: 3, title: 'Prototype: scheduling bot', priority: 6, cost: 3 },
    { id: 4, title: 'Design user study', priority: 7, cost: 4 },
    { id: 5, title: 'Write intro & scope', priority: 4, cost: 2 }
  ])

  const [velocity, setVelocity] = useState(8)
  const [plan, setPlan] = useState([])

  function planSprint() {
    // Simple heuristic: prioritize by (priority / cost)
    const scored = backlog
      .map((t) => ({ ...t, score: t.priority / Math.max(1, t.cost) }))
      .sort((a, b) => b.score - a.score)

    const selection = []
    let cap = velocity
    for (const item of scored) {
      if (item.cost <= cap) {
        selection.push(item)
        cap -= item.cost
      }
    }
    setPlan(selection)
  }

  function addItem() {
    const next = {
      id: Date.now(),
      title: `New task ${backlog.length + 1}`,
      priority: 3,
      cost: 2
    }
    setBacklog([next, ...backlog])
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label>Velocity:</label>
        <input type="range" min="2" max="15" value={velocity} onChange={(e) => setVelocity(Number(e.target.value))} />
        <strong>{velocity} pts</strong>
        <button onClick={planSprint} style={{ marginLeft: 'auto' }}>Run sprint planning</button>
        <button onClick={addItem}>Add random task</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="panel">
          <h3>Backlog</h3>
          <ul>
            {backlog.map((t) => (
              <li key={t.id}>{t.title} — priority {t.priority} — cost {t.cost}</li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h3>Planned for sprint</h3>
          {plan.length === 0 ? (
            <p style={{ color: '#666' }}>No plan yet — run sprint planning.</p>
          ) : (
            <ol>
              {plan.map((t) => (
                <li key={t.id}>{t.title} — cost {t.cost}</li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <style jsx>{`
        .panel { background: #fafafa; padding: 12px; border-radius: 8px }
        ul { margin: 0; padding-left: 18px }
      `}</style>
    </div>
  )
}
