import { basePrompt, runPlanningAgentWithPrompt } from './shared'

export async function runProductOwnerAssistant({ persona, planningContext }) {
  const prompt = basePrompt({
    persona,
    agentKey: 'product_owner_assistant',
    planningContext,
    extraInstructions: [
      'Focus on backlog refinement and sprint objective drafting.',
      'Prioritize by business value, readiness, and dependency exposure.',
      'In artifacts include:',
      '{',
      '  "priority_order": [{"item_id":"", "rank":1, "reason":""}],',
      '  "readiness_gaps": [{"item_id":"", "gap":""}],',
      '  "missing_acceptance_criteria": [{"item_id":"", "missing":""}],',
      '  "sprint_objective_themes": ["string"]',
      '}'
    ].join('\n')
  })

  return runPlanningAgentWithPrompt({
    agentKey: 'product_owner_assistant',
    persona,
    planningContext,
    prompt
  })
}
