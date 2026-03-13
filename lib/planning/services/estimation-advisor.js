import { basePrompt, runPlanningAgentWithPrompt } from './shared'

export async function runEstimationAdvisor({ persona, planningContext }) {
  const prompt = basePrompt({
    persona,
    agentKey: 'estimation_advisor',
    planningContext,
    extraInstructions: [
      'Recommend story-point estimates for each backlog item.',
      'Show assumptions and confidence per item.',
      'Flag low-confidence recommendations and capacity overrun risk.',
      'In artifacts include:',
      '{',
      '  "estimates": [{',
      '    "backlog_item_id": "",',
      '    "backlog_item_title": "",',
      '    "ai_estimate": 0,',
      '    "confidence": 0.0,',
      '    "assumptions": ["string"],',
      '    "low_confidence": false',
      '  }],',
      '  "capacity_summary": {',
      '    "capacity_points": 0,',
      '    "total_ai_estimate": 0,',
      '    "delta": 0,',
      '    "capacity_fit": "fit|at-risk|over-capacity"',
      '  }',
      '}'
    ].join('\n')
  })

  const result = await runPlanningAgentWithPrompt({
    agentKey: 'estimation_advisor',
    persona,
    planningContext,
    prompt
  })

  const estimates = Array.isArray(result.output?.artifacts?.estimates)
    ? result.output.artifacts.estimates
    : []
  result.output.artifacts.estimates = estimates.map((item) => ({
    backlog_item_id: item?.backlog_item_id || '',
    backlog_item_title: item?.backlog_item_title || '',
    ai_estimate: Number.isFinite(Number(item?.ai_estimate)) ? Number(item.ai_estimate) : null,
    confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : 0.5,
    assumptions: Array.isArray(item?.assumptions) ? item.assumptions : [],
    low_confidence: Boolean(item?.low_confidence)
  }))

  if (!result.output.artifacts.capacity_summary || typeof result.output.artifacts.capacity_summary !== 'object') {
    result.output.artifacts.capacity_summary = {
      capacity_points: Number(planningContext?.capacityPoints || 0),
      total_ai_estimate: 0,
      delta: 0,
      capacity_fit: 'fit'
    }
  }

  return result
}
