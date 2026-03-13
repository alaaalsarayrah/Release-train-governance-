import { basePrompt, runPlanningAgentWithPrompt } from './shared'

export async function runRiskAnalyst({ persona, planningContext }) {
  const prompt = basePrompt({
    persona,
    agentKey: 'risk_analyst',
    planningContext,
    extraInstructions: [
      'Generate a sprint risk register from backlog, estimates, dependencies, and architecture context.',
      'In artifacts include risk_register rows with fields:',
      '- risk_id',
      '- title',
      '- description',
      '- category',
      '- probability',
      '- impact',
      '- severity',
      '- mitigation',
      '- owner',
      '- status'
    ].join('\n')
  })

  const result = await runPlanningAgentWithPrompt({
    agentKey: 'risk_analyst',
    persona,
    planningContext,
    prompt
  })

  const register = Array.isArray(result.output?.artifacts?.risk_register)
    ? result.output.artifacts.risk_register
    : []

  result.output.artifacts.risk_register = register.map((risk, idx) => ({
    risk_id: String(risk?.risk_id || `RISK-${String(idx + 1).padStart(3, '0')}`),
    title: String(risk?.title || 'Risk'),
    description: String(risk?.description || ''),
    category: String(risk?.category || 'General'),
    probability: String(risk?.probability || 'Medium'),
    impact: String(risk?.impact || 'Medium'),
    severity: String(risk?.severity || 'Medium'),
    mitigation: String(risk?.mitigation || ''),
    owner: String(risk?.owner || 'Team'),
    status: String(risk?.status || 'Open')
  }))

  return result
}
