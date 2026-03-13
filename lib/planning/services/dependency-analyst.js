import { basePrompt, runPlanningAgentWithPrompt } from './shared'

export async function runDependencyAnalyst({ persona, planningContext }) {
  const prompt = basePrompt({
    persona,
    agentKey: 'dependency_analyst',
    planningContext,
    extraInstructions: [
      'Detect likely dependencies and sequencing constraints among selected backlog items.',
      'Classify dependency type and severity and indicate sprint threat level.',
      'In artifacts include:',
      '{',
      '  "dependencies": [{',
      '    "source_item": "",',
      '    "target_item": "",',
      '    "dependency_type": "technical|data|external|sequence|team",',
      '    "severity": "Low|Medium|High",',
      '    "description": "",',
      '    "mitigation": "",',
      '    "threatens_sprint": false',
      '  }],',
      '  "dependency_graph": {',
      '    "nodes": [{"id":"", "label":""}],',
      '    "edges": [{"source":"", "target":"", "severity":""}]',
      '  }',
      '}'
    ].join('\n')
  })

  const result = await runPlanningAgentWithPrompt({
    agentKey: 'dependency_analyst',
    persona,
    planningContext,
    prompt
  })

  const deps = Array.isArray(result.output?.artifacts?.dependencies) ? result.output.artifacts.dependencies : []
  result.output.artifacts.dependencies = deps.map((dep) => ({
    source_item: String(dep?.source_item || ''),
    target_item: String(dep?.target_item || ''),
    dependency_type: String(dep?.dependency_type || 'sequence'),
    severity: String(dep?.severity || 'Medium'),
    description: String(dep?.description || ''),
    mitigation: String(dep?.mitigation || ''),
    threatens_sprint: Boolean(dep?.threatens_sprint)
  }))

  if (!result.output.artifacts.dependency_graph || typeof result.output.artifacts.dependency_graph !== 'object') {
    result.output.artifacts.dependency_graph = { nodes: [], edges: [] }
  }

  return result
}
