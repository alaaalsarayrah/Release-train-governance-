import { dbAll, dbRun, withDb } from '../_lib/requests-db'
import {
  deriveEvaluationMetrics,
  summarizeEvaluationRows,
  toBooleanFlag,
  toNumber,
  validateEvaluationPayload
} from '../../../lib/evaluation/evidence-metrics'

function asText(value, max = 2000) {
  if (value === undefined || value === null) return ''
  return String(value).trim().slice(0, max)
}

function asIsoDateTime(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function buildWhere(query) {
  const clauses = []
  const params = []

  if (query.scenarioId) {
    clauses.push('scenario_id = ?')
    params.push(String(query.scenarioId))
  }

  if (query.participantId) {
    clauses.push('(participant_id = ? OR evaluator_id = ?)')
    params.push(String(query.participantId), String(query.participantId))
  }

  if (query.planningSessionId) {
    clauses.push('planning_session_id = ?')
    params.push(String(query.planningSessionId))
  }

  if (query.teamName) {
    clauses.push('team_name = ?')
    params.push(String(query.teamName))
  }

  if (query.sprintName) {
    clauses.push('sprint_name = ?')
    params.push(String(query.sprintName))
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { where, params }
}

async function getEvaluations(query) {
  return withDb(async (db) => {
    const limit = Math.max(1, Math.min(Number(query.limit || 200), 1000))
    const { where, params } = buildWhere(query)

    const rows = await dbAll(
      db,
      `SELECT
        id,
        scenario_id,
        scenario_name,
        planning_session_id,
        team_id,
        team_name,
        sprint_id,
        sprint_name,
        participant_id,
        participant_role,
        evaluator_id,
        evaluator_role,
        evaluated_at,
        perceived_usefulness,
        ease_of_use,
        trust,
        intention_to_use,
        task_completion_minutes,
        baseline_manual_planning_minutes,
        ai_assisted_planning_minutes,
        time_reduction_minutes,
        time_reduction_percent,
        recommendations_generated,
        recommendations_accepted,
        recommendation_acceptance_ratio,
        dependency_issues_identified,
        dependency_issues_validated,
        dependency_validation_ratio,
        risk_items_identified,
        risk_recommendations_accepted,
        risk_acceptance_ratio,
        estimation_baseline,
        ai_supported_estimate,
        estimation_variance,
        estimation_variance_percent,
        clarification_requests,
        task_completion_success,
        system_response_ms,
        error_count,
        evaluator_comments,
        observations,
        limitations,
        notes,
        interview_notes,
        created_at
       FROM thesis_evaluations
       ${where}
       ORDER BY id DESC
       LIMIT ?`,
      [...params, limit]
    )

    return rows
  })
}

async function createEvaluation(body) {
  const validation = validateEvaluationPayload(body)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const scenarioId = asText(body.scenarioId, 100)
  const evaluatorId = asText(body.evaluatorId || body.participantId, 120)
  const evaluatorRole = asText(body.evaluatorRole || body.participantRole, 120)

  const derived = deriveEvaluationMetrics(body)

  const payload = {
    scenario_id: scenarioId,
    scenario_name: asText(body.scenarioName, 240),
    planning_session_id: asText(body.planningSessionId, 120),
    team_id: asText(body.teamId, 120),
    team_name: asText(body.teamName, 240),
    sprint_id: asText(body.sprintId, 120),
    sprint_name: asText(body.sprintName, 240),
    participant_id: asText(body.participantId || evaluatorId, 120),
    participant_role: asText(body.participantRole || evaluatorRole, 120),
    evaluator_id: evaluatorId,
    evaluator_role: evaluatorRole,
    evaluated_at: asIsoDateTime(body.evaluatedAt),
    perceived_usefulness: derived.perceived_usefulness,
    ease_of_use: derived.ease_of_use,
    trust: derived.trust,
    intention_to_use: derived.intention_to_use,
    task_completion_minutes: derived.task_completion_minutes,
    baseline_manual_planning_minutes: derived.baseline_manual_planning_minutes,
    ai_assisted_planning_minutes: derived.ai_assisted_planning_minutes,
    time_reduction_minutes: derived.time_reduction_minutes,
    time_reduction_percent: derived.time_reduction_percent,
    recommendations_generated: derived.recommendations_generated,
    recommendations_accepted: derived.recommendations_accepted,
    recommendation_acceptance_ratio: derived.recommendation_acceptance_ratio,
    dependency_issues_identified: derived.dependency_issues_identified,
    dependency_issues_validated: derived.dependency_issues_validated,
    dependency_validation_ratio: derived.dependency_validation_ratio,
    risk_items_identified: derived.risk_items_identified,
    risk_recommendations_accepted: derived.risk_recommendations_accepted,
    risk_acceptance_ratio: derived.risk_acceptance_ratio,
    estimation_baseline: derived.estimation_baseline,
    ai_supported_estimate: derived.ai_supported_estimate,
    estimation_variance: derived.estimation_variance,
    estimation_variance_percent: derived.estimation_variance_percent,
    clarification_requests: derived.clarification_requests,
    task_completion_success: toBooleanFlag(body.taskCompletionSuccess),
    system_response_ms: derived.system_response_ms,
    error_count: derived.error_count,
    evaluator_comments: asText(body.evaluatorComments, 4000),
    observations: asText(body.observations, 8000),
    limitations: asText(body.limitations, 8000),
    notes: asText(body.notes, 4000),
    interview_notes: asText(body.interviewNotes, 8000)
  }

  return withDb(async (db) => {
    if (payload.planning_session_id && (!payload.team_name || !payload.sprint_name)) {
      const [linkedSession] = await dbAll(
        db,
        `SELECT id, team_id, team_name, sprint_id, sprint_name
         FROM planning_sessions
         WHERE id = ?
         LIMIT 1`,
        [payload.planning_session_id]
      )

      if (linkedSession) {
        if (!payload.team_id) payload.team_id = linkedSession.team_id || ''
        if (!payload.team_name) payload.team_name = linkedSession.team_name || ''
        if (!payload.sprint_id) payload.sprint_id = linkedSession.sprint_id || ''
        if (!payload.sprint_name) payload.sprint_name = linkedSession.sprint_name || ''
      }
    }

    const insertValues = [
      payload.scenario_id,
      payload.scenario_name,
      payload.planning_session_id,
      payload.team_id,
      payload.team_name,
      payload.sprint_id,
      payload.sprint_name,
      payload.participant_id,
      payload.participant_role,
      payload.evaluator_id,
      payload.evaluator_role,
      payload.evaluated_at,
      payload.perceived_usefulness,
      payload.ease_of_use,
      payload.trust,
      payload.intention_to_use,
      payload.task_completion_minutes,
      payload.baseline_manual_planning_minutes,
      payload.ai_assisted_planning_minutes,
      payload.time_reduction_minutes,
      payload.time_reduction_percent,
      payload.recommendations_generated,
      payload.recommendations_accepted,
      payload.recommendation_acceptance_ratio,
      payload.dependency_issues_identified,
      payload.dependency_issues_validated,
      payload.dependency_validation_ratio,
      payload.risk_items_identified,
      payload.risk_recommendations_accepted,
      payload.risk_acceptance_ratio,
      payload.estimation_baseline,
      payload.ai_supported_estimate,
      payload.estimation_variance,
      payload.estimation_variance_percent,
      payload.clarification_requests,
      payload.task_completion_success,
      payload.system_response_ms,
      payload.error_count,
      payload.evaluator_comments,
      payload.observations,
      payload.limitations,
      payload.notes,
      payload.interview_notes
    ]

    await dbRun(
      db,
      `INSERT INTO thesis_evaluations (
        scenario_id,
        scenario_name,
        planning_session_id,
        team_id,
        team_name,
        sprint_id,
        sprint_name,
        participant_id,
        participant_role,
        evaluator_id,
        evaluator_role,
        evaluated_at,
        perceived_usefulness,
        ease_of_use,
        trust,
        intention_to_use,
        task_completion_minutes,
        baseline_manual_planning_minutes,
        ai_assisted_planning_minutes,
        time_reduction_minutes,
        time_reduction_percent,
        recommendations_generated,
        recommendations_accepted,
        recommendation_acceptance_ratio,
        dependency_issues_identified,
        dependency_issues_validated,
        dependency_validation_ratio,
        risk_items_identified,
        risk_recommendations_accepted,
        risk_acceptance_ratio,
        estimation_baseline,
        ai_supported_estimate,
        estimation_variance,
        estimation_variance_percent,
        clarification_requests,
        task_completion_success,
        system_response_ms,
        error_count,
        evaluator_comments,
        observations,
        limitations,
        notes,
        interview_notes
      ) VALUES (${insertValues.map(() => '?').join(', ')})`,
      insertValues
    )

    const [latest] = await dbAll(
      db,
      `SELECT
        id,
        scenario_id,
        scenario_name,
        planning_session_id,
        team_id,
        team_name,
        sprint_id,
        sprint_name,
        participant_id,
        participant_role,
        evaluator_id,
        evaluator_role,
        evaluated_at,
        perceived_usefulness,
        ease_of_use,
        trust,
        intention_to_use,
        task_completion_minutes,
        baseline_manual_planning_minutes,
        ai_assisted_planning_minutes,
        time_reduction_minutes,
        time_reduction_percent,
        recommendations_generated,
        recommendations_accepted,
        recommendation_acceptance_ratio,
        dependency_issues_identified,
        dependency_issues_validated,
        dependency_validation_ratio,
        risk_items_identified,
        risk_recommendations_accepted,
        risk_acceptance_ratio,
        estimation_baseline,
        ai_supported_estimate,
        estimation_variance,
        estimation_variance_percent,
        clarification_requests,
        task_completion_success,
        system_response_ms,
        error_count,
        evaluator_comments,
        observations,
        limitations,
        notes,
        interview_notes,
        created_at
      FROM thesis_evaluations
      ORDER BY id DESC
      LIMIT 1`
    )

    return latest || null
  })
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const evaluations = (await getEvaluations(req.query || {})).map((row) => deriveEvaluationMetrics(row))
      const summary = summarizeEvaluationRows(evaluations)
      return res.status(200).json({ evaluations, summary })
    }

    if (req.method === 'POST') {
      const saved = await createEvaluation(req.body || {})
      return res.status(201).json({ success: true, evaluation: saved })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    return res.status(400).json({ message: String(err.message || err) })
  }
}
