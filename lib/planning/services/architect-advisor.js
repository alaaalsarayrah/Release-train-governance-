import { basePrompt, runPlanningAgentWithPrompt } from './shared'
import { ARCHITECTURE_NOTE_TEMPLATE } from '../constants'

export async function runArchitectAdvisor({ persona, planningContext }) {
  const prompt = basePrompt({
    persona,
    agentKey: 'architect_advisor',
    planningContext,
    extraInstructions: [
      'Review architecture impact and solution intent for selected stories.',
      'In artifacts include architecture_note with this exact structure:',
      '{',
      '  "impacted_components": [""],',
      '  "assumptions": [""],',
      '  "constraints": [""],',
      '  "technical_enablers": [""],',
      '  "architecture_risks": [""],',
      '  "recommended_actions": [""],',
      '  "rationale": ""',
      '}'
    ].join('\n')
  })

  const result = await runPlanningAgentWithPrompt({
    agentKey: 'architect_advisor',
    persona,
    planningContext,
    prompt
  })

  if (!result.output.artifacts.architecture_note) {
    result.output.artifacts.architecture_note = { ...ARCHITECTURE_NOTE_TEMPLATE }
  }

  return result
}
