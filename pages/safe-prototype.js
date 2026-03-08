import SafeAgent from '../components/SafeAgent'

export default function SafePrototype() {
  return (
    <main className="container">
      <h1>SAFe + Agentic AI Sprint Planner</h1>
      <section className="card">
        <p style={{ marginBottom: 16 }}>
          This prototype illustrates the core thesis concept: <strong>using agentic AI to enhance sprint planning in SAFe</strong>.
          The AI agent below demonstrates intelligent prioritization—balancing value delivery, risk mitigation, and dependency resolution
          to accelerate your path to production.
        </p>

        <h2>How It Works</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li><strong>Value/Risk Scoring:</strong> Items scored by value delivered relative to risk introduced.</li>
          <li><strong>Dependency Resolution:</strong> The agent ensures prerequisites are scheduled before dependent work.</li>
          <li><strong>Capacity Planning:</strong> Stays within your sprint velocity while maximizing delivery impact.</li>
          <li><strong>Transparent Reasoning:</strong> Every decision is logged so humans remain in the loop.</li>
        </ul>

        <h3>Interactive Sprint Planner</h3>
        <SafeAgent />

        <h3>Key Concepts from Thesis</h3>
        <ul style={{ fontSize: 14, color: '#555' }}>
          <li><em>Problem:</em> Manual sprint planning in large scaled teams is time-consuming and often suboptimal.</li>
          <li><em>Solution:</em> An agentic AI system that recommends sprints autonomously, but allows humans to override or refine.</li>
          <li><em>Impact:</em> Faster planning cycles, more consistent prioritization, earlier delivery of high-value features.</li>
        </ul>

        <h3>Next Steps (Thesis Extensions)</h3>
        <ol style={{ fontSize: 14 }}>
          <li>Integrate real backlog data from Jira/Azure DevOps.</li>
          <li>Add learning loop: agent improves scoring based on historical sprint outcomes.</li>
          <li>Multi-team coordination: agent synchronizes dependencies across PI planning boundaries.</li>
          <li>Risk/compliance tracking: agent flags items violating security or regulatory constraints.</li>
        </ol>
      </section>

      <style jsx>{`
        .container { max-width: 1100px; margin: 40px auto; padding: 0 20px }
        .card { background: #fff; padding: 18px; border-radius: 8px; box-shadow: 0 6px 18px rgba(20,20,30,0.05) }
        h2 { margin-top: 20px }
      `}</style>
    </main>
  )
}
