import {
  buildPlanningFallback,
  normalizePlanningOutput,
  runPersonaModel
} from '../planning-core'

function jsonBlock(value) {
  return JSON.stringify(value || {}, null, 2)
}

export function basePrompt({ persona, agentKey, planningContext, extraInstructions }) {
  return [
    persona?.systemInstruction || `You are ${agentKey} in a sprint-planning multi-agent workflow.`,
    '',
    'Return strictly valid JSON with the exact shape:',
    '{',
    '  "agent_key": "string",',
    '  "summary": "string",',
    '  "recommendations": ["string"],',
    '  "rationale": "string",',
    '  "confidence": 0.0,',
    '  "risks": ["string"],',
    '  "follow_up_questions": ["string"],',
    '  "artifacts": {}',
    '}',
    '',
    'Confidence must be between 0 and 1.',
    extraInstructions || '',
    '',
    'Shared planning context:',
    jsonBlock(planningContext)
  ].join('\n')
}

export async function runPlanningAgentWithPrompt({ agentKey, persona, planningContext, prompt }) {
  const fallback = buildPlanningFallback(agentKey, planningContext)
  const result = await runPersonaModel({ persona, prompt, fallback })

  const normalized = normalizePlanningOutput(agentKey, result.output)
  return {
    output: normalized,
    modelUsed: result.modelUsed,
    warning: result.warning,
    usedFallback: !result.ok
  }
}
