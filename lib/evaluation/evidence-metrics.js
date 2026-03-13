function round2(value) {
  if (!Number.isFinite(Number(value))) return null
  return Number(Number(value).toFixed(2))
}

export function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function toInteger(value, fallback = null) {
  const parsed = toNumber(value, fallback)
  if (parsed === null) return null
  return Math.trunc(parsed)
}

export function clampLikert(value) {
  const parsed = toInteger(value, null)
  if (parsed === null) return null
  if (parsed < 1 || parsed > 5) return null
  return parsed
}

export function toBooleanFlag(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value ? 1 : 0
  const text = String(value).trim().toLowerCase()
  if (text === '1' || text === 'true' || text === 'yes' || text === 'y') return 1
  if (text === '0' || text === 'false' || text === 'no' || text === 'n') return 0
  const asNumber = Number(value)
  if (Number.isFinite(asNumber)) return asNumber > 0 ? 1 : 0
  return null
}

function percentRatio(numerator, denominator) {
  const n = toNumber(numerator, null)
  const d = toNumber(denominator, null)
  if (n === null || d === null || d <= 0) return null
  return round2((n / d) * 100)
}

function asField(record, snake, camel) {
  if (record[snake] !== undefined) return record[snake]
  return record[camel]
}

export function deriveEvaluationMetrics(record = {}) {
  const baselineManualPlanningMinutes = toNumber(
    asField(record, 'baseline_manual_planning_minutes', 'baselineManualPlanningMinutes'),
    null
  )
  const aiAssistedPlanningMinutes = toNumber(
    asField(record, 'ai_assisted_planning_minutes', 'aiAssistedPlanningMinutes'),
    null
  )

  const recommendationsGenerated = toInteger(
    asField(record, 'recommendations_generated', 'recommendationsGenerated'),
    null
  )
  const recommendationsAccepted = toInteger(
    asField(record, 'recommendations_accepted', 'recommendationsAccepted'),
    null
  )

  const dependencyIssuesIdentified = toInteger(
    asField(record, 'dependency_issues_identified', 'dependencyIssuesIdentified'),
    null
  )
  const dependencyIssuesValidated = toInteger(
    asField(record, 'dependency_issues_validated', 'dependencyIssuesValidated'),
    null
  )

  const riskItemsIdentified = toInteger(
    asField(record, 'risk_items_identified', 'riskItemsIdentified'),
    null
  )
  const riskRecommendationsAccepted = toInteger(
    asField(record, 'risk_recommendations_accepted', 'riskRecommendationsAccepted'),
    null
  )

  const estimationBaseline = toNumber(asField(record, 'estimation_baseline', 'estimationBaseline'), null)
  const aiSupportedEstimate = toNumber(asField(record, 'ai_supported_estimate', 'aiSupportedEstimate'), null)

  const computedTimeReductionMinutes =
    baselineManualPlanningMinutes !== null && aiAssistedPlanningMinutes !== null
      ? round2(baselineManualPlanningMinutes - aiAssistedPlanningMinutes)
      : null

  const computedTimeReductionPercent =
    baselineManualPlanningMinutes && baselineManualPlanningMinutes > 0 && computedTimeReductionMinutes !== null
      ? round2((computedTimeReductionMinutes / baselineManualPlanningMinutes) * 100)
      : null

  const computedEstimationVariance =
    estimationBaseline !== null && aiSupportedEstimate !== null
      ? round2(aiSupportedEstimate - estimationBaseline)
      : null

  const computedEstimationVariancePercent =
    estimationBaseline && estimationBaseline > 0 && computedEstimationVariance !== null
      ? round2((computedEstimationVariance / estimationBaseline) * 100)
      : null

  const recommendationAcceptanceRatio = percentRatio(recommendationsAccepted, recommendationsGenerated)
  const dependencyValidationRatio = percentRatio(dependencyIssuesValidated, dependencyIssuesIdentified)
  const riskAcceptanceRatio = percentRatio(riskRecommendationsAccepted, riskItemsIdentified)

  return {
    ...record,
    baseline_manual_planning_minutes: baselineManualPlanningMinutes,
    ai_assisted_planning_minutes: aiAssistedPlanningMinutes,
    time_reduction_minutes: computedTimeReductionMinutes,
    time_reduction_percent: computedTimeReductionPercent,
    recommendations_generated: recommendationsGenerated,
    recommendations_accepted: recommendationsAccepted,
    recommendation_acceptance_ratio: recommendationAcceptanceRatio,
    dependency_issues_identified: dependencyIssuesIdentified,
    dependency_issues_validated: dependencyIssuesValidated,
    dependency_validation_ratio: dependencyValidationRatio,
    risk_items_identified: riskItemsIdentified,
    risk_recommendations_accepted: riskRecommendationsAccepted,
    risk_acceptance_ratio: riskAcceptanceRatio,
    estimation_baseline: estimationBaseline,
    ai_supported_estimate: aiSupportedEstimate,
    estimation_variance: computedEstimationVariance,
    estimation_variance_percent: computedEstimationVariancePercent,
    task_completion_success: toBooleanFlag(asField(record, 'task_completion_success', 'taskCompletionSuccess')),
    perceived_usefulness: clampLikert(asField(record, 'perceived_usefulness', 'perceivedUsefulness')),
    ease_of_use: clampLikert(asField(record, 'ease_of_use', 'easeOfUse')),
    trust: clampLikert(asField(record, 'trust', 'trust')),
    intention_to_use: clampLikert(asField(record, 'intention_to_use', 'intentionToUse')),
    clarification_requests: toInteger(asField(record, 'clarification_requests', 'clarificationRequests'), null),
    task_completion_minutes: toNumber(asField(record, 'task_completion_minutes', 'taskCompletionMinutes'), null),
    system_response_ms: toInteger(asField(record, 'system_response_ms', 'systemResponseMs'), null),
    error_count: toInteger(asField(record, 'error_count', 'errorCount'), null)
  }
}

function mean(rows, key) {
  const values = rows
    .map((row) => toNumber(row[key], null))
    .filter((value) => value !== null)
  if (!values.length) return null
  const total = values.reduce((sum, value) => sum + value, 0)
  return round2(total / values.length)
}

function sum(rows, key) {
  return rows
    .map((row) => toNumber(row[key], 0))
    .filter((value) => Number.isFinite(value))
    .reduce((acc, value) => acc + value, 0)
}

export function summarizeEvaluationRows(rawRows = []) {
  const rows = rawRows.map((row) => deriveEvaluationMetrics(row))

  if (!rows.length) {
    return {
      totalEvaluations: 0,
      successfulTasks: 0,
      taskCompletionSuccessRate: null,
      avgPerceivedUsefulness: null,
      avgEaseOfUse: null,
      avgTrust: null,
      avgIntentionToUse: null,
      avgTaskCompletionMinutes: null,
      avgBaselineManualPlanningMinutes: null,
      avgAiAssistedPlanningMinutes: null,
      avgTimeReductionMinutes: null,
      avgTimeReductionPercent: null,
      recommendationAcceptanceRate: null,
      dependencyValidationRate: null,
      riskRecommendationAcceptanceRate: null,
      avgEstimationVariance: null,
      avgEstimationVariancePercent: null,
      avgClarificationRequests: null,
      avgSystemResponseMs: null,
      avgErrors: null
    }
  }

  const recommendationsGenerated = sum(rows, 'recommendations_generated')
  const recommendationsAccepted = sum(rows, 'recommendations_accepted')
  const dependencyIssuesIdentified = sum(rows, 'dependency_issues_identified')
  const dependencyIssuesValidated = sum(rows, 'dependency_issues_validated')
  const riskItemsIdentified = sum(rows, 'risk_items_identified')
  const riskRecommendationsAccepted = sum(rows, 'risk_recommendations_accepted')

  const successfulTasks = rows.filter((row) => Number(row.task_completion_success) === 1).length

  return {
    totalEvaluations: rows.length,
    successfulTasks,
    taskCompletionSuccessRate: percentRatio(successfulTasks, rows.length),
    avgPerceivedUsefulness: mean(rows, 'perceived_usefulness'),
    avgEaseOfUse: mean(rows, 'ease_of_use'),
    avgTrust: mean(rows, 'trust'),
    avgIntentionToUse: mean(rows, 'intention_to_use'),
    avgTaskCompletionMinutes: mean(rows, 'task_completion_minutes'),
    avgBaselineManualPlanningMinutes: mean(rows, 'baseline_manual_planning_minutes'),
    avgAiAssistedPlanningMinutes: mean(rows, 'ai_assisted_planning_minutes'),
    avgTimeReductionMinutes: mean(rows, 'time_reduction_minutes'),
    avgTimeReductionPercent: mean(rows, 'time_reduction_percent'),
    recommendationAcceptanceRate: percentRatio(recommendationsAccepted, recommendationsGenerated),
    dependencyValidationRate: percentRatio(dependencyIssuesValidated, dependencyIssuesIdentified),
    riskRecommendationAcceptanceRate: percentRatio(riskRecommendationsAccepted, riskItemsIdentified),
    avgEstimationVariance: mean(rows, 'estimation_variance'),
    avgEstimationVariancePercent: mean(rows, 'estimation_variance_percent'),
    avgClarificationRequests: mean(rows, 'clarification_requests'),
    avgSystemResponseMs: mean(rows, 'system_response_ms'),
    avgErrors: mean(rows, 'error_count')
  }
}

export function validateEvaluationPayload(input = {}) {
  const errors = []

  const scenarioId = String(input.scenarioId || '').trim()
  if (!scenarioId) errors.push('Scenario ID is required.')

  const evaluatorId = String(input.evaluatorId || input.participantId || '').trim()
  if (!evaluatorId) errors.push('Evaluator ID is required.')

  const evaluatorRole = String(input.evaluatorRole || input.participantRole || '').trim()
  if (!evaluatorRole) errors.push('Evaluator role is required.')

  const nonNegativeNumberFields = [
    ['baselineManualPlanningMinutes', input.baselineManualPlanningMinutes],
    ['aiAssistedPlanningMinutes', input.aiAssistedPlanningMinutes],
    ['taskCompletionMinutes', input.taskCompletionMinutes],
    ['recommendationsGenerated', input.recommendationsGenerated],
    ['recommendationsAccepted', input.recommendationsAccepted],
    ['dependencyIssuesIdentified', input.dependencyIssuesIdentified],
    ['dependencyIssuesValidated', input.dependencyIssuesValidated],
    ['riskItemsIdentified', input.riskItemsIdentified],
    ['riskRecommendationsAccepted', input.riskRecommendationsAccepted],
    ['estimationBaseline', input.estimationBaseline],
    ['aiSupportedEstimate', input.aiSupportedEstimate],
    ['clarificationRequests', input.clarificationRequests],
    ['systemResponseMs', input.systemResponseMs],
    ['errorCount', input.errorCount]
  ]

  for (const [name, value] of nonNegativeNumberFields) {
    const numeric = toNumber(value, null)
    if (numeric !== null && numeric < 0) {
      errors.push(`${name} must be 0 or greater.`)
    }
  }

  const recommendationsGenerated = toInteger(input.recommendationsGenerated, null)
  const recommendationsAccepted = toInteger(input.recommendationsAccepted, null)
  if (
    recommendationsGenerated !== null
    && recommendationsAccepted !== null
    && recommendationsAccepted > recommendationsGenerated
  ) {
    errors.push('recommendationsAccepted cannot exceed recommendationsGenerated.')
  }

  const dependencyIssuesIdentified = toInteger(input.dependencyIssuesIdentified, null)
  const dependencyIssuesValidated = toInteger(input.dependencyIssuesValidated, null)
  if (
    dependencyIssuesIdentified !== null
    && dependencyIssuesValidated !== null
    && dependencyIssuesValidated > dependencyIssuesIdentified
  ) {
    errors.push('dependencyIssuesValidated cannot exceed dependencyIssuesIdentified.')
  }

  const riskItemsIdentified = toInteger(input.riskItemsIdentified, null)
  const riskRecommendationsAccepted = toInteger(input.riskRecommendationsAccepted, null)
  if (
    riskItemsIdentified !== null
    && riskRecommendationsAccepted !== null
    && riskRecommendationsAccepted > riskItemsIdentified
  ) {
    errors.push('riskRecommendationsAccepted cannot exceed riskItemsIdentified.')
  }

  for (const [field, value] of [
    ['perceivedUsefulness', input.perceivedUsefulness],
    ['easeOfUse', input.easeOfUse],
    ['trust', input.trust],
    ['intentionToUse', input.intentionToUse]
  ]) {
    if (value === undefined || value === null || value === '') continue
    if (clampLikert(value) === null) {
      errors.push(`${field} must be between 1 and 5.`)
    }
  }

  return { valid: errors.length === 0, errors }
}
