function has(availableTypes, typeName) {
  return availableTypes.has(typeName)
}

export function detectAdoProcess(availableTypes) {
  if (has(availableTypes, 'Product Backlog Item')) return 'scrum'
  if (has(availableTypes, 'User Story')) return 'agile'
  if (has(availableTypes, 'Requirement')) return 'cmmi'
  return 'unknown'
}

export function toTypeSet(types) {
  return new Set(
    (types || [])
      .map((t) => (typeof t === 'string' ? t : String(t?.name || '')).trim())
      .filter(Boolean)
  )
}

function pickFirst(availableTypes, candidates) {
  for (const name of candidates) {
    if (has(availableTypes, name)) return name
  }
  return null
}

export function resolveStrictTypeMapping(availableTypes) {
  const processHint = detectAdoProcess(availableTypes)
  const warnings = []

  const epicType = pickFirst(availableTypes, ['Epic', 'Feature', 'Issue', 'Task']) || 'Task'
  const featureType = pickFirst(availableTypes, ['Feature', 'Issue', 'Task']) || 'Task'

  let storyType = null
  if (processHint === 'agile') {
    storyType = pickFirst(availableTypes, ['User Story', 'Product Backlog Item', 'Requirement', 'Issue', 'Task'])
  } else if (processHint === 'scrum') {
    storyType = pickFirst(availableTypes, ['Product Backlog Item', 'User Story', 'Requirement', 'Issue', 'Task'])
  } else if (processHint === 'cmmi') {
    storyType = pickFirst(availableTypes, ['Requirement', 'User Story', 'Product Backlog Item', 'Issue', 'Task'])
  } else {
    storyType = pickFirst(availableTypes, ['User Story', 'Product Backlog Item', 'Requirement', 'Issue', 'Task'])
    warnings.push('ADO process could not be inferred from available work item types; using generic fallback order.')
  }

  const taskType = pickFirst(availableTypes, ['Task', 'Issue']) || storyType || 'Task'

  if (epicType === 'Issue' || epicType === 'Task') {
    warnings.push(`Epic-level fallback is degraded to '${epicType}'.`)
  }

  if (featureType === 'Issue' || featureType === 'Task') {
    warnings.push(`Feature-level fallback is degraded to '${featureType}'.`)
  }

  if (storyType === 'Issue' || storyType === 'Task') {
    warnings.push(`Story-level fallback is degraded to '${storyType}'. Burndown semantics may be weaker than Agile/Scrum story types.`)
  }

  if (epicType === 'Issue' && featureType === 'Issue' && storyType === 'Issue') {
    warnings.push('Only Issue is available for hierarchy levels in this project/process. Consider enabling Agile/Scrum work item types.')
  }

  return {
    processHint,
    typeMapping: {
      epicType,
      featureType,
      storyType,
      taskType
    },
    warnings
  }
}
