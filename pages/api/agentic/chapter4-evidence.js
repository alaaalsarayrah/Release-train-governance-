import { dbAll, withDb } from '../_lib/requests-db'
import { deriveEvaluationMetrics, summarizeEvaluationRows } from '../../../lib/evaluation/evidence-metrics'

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows) {
  const headers = [
    'id',
    'created_at',
    'evaluated_at',
    'scenario_id',
    'scenario_name',
    'planning_session_id',
    'team_id',
    'team_name',
    'sprint_id',
    'sprint_name',
    'participant_id',
    'participant_role',
    'evaluator_id',
    'evaluator_role',
    'perceived_usefulness',
    'ease_of_use',
    'trust',
    'intention_to_use',
    'task_completion_minutes',
    'baseline_manual_planning_minutes',
    'ai_assisted_planning_minutes',
    'time_reduction_minutes',
    'time_reduction_percent',
    'recommendations_generated',
    'recommendations_accepted',
    'recommendation_acceptance_ratio',
    'dependency_issues_identified',
    'dependency_issues_validated',
    'dependency_validation_ratio',
    'risk_items_identified',
    'risk_recommendations_accepted',
    'risk_acceptance_ratio',
    'estimation_baseline',
    'ai_supported_estimate',
    'estimation_variance',
    'estimation_variance_percent',
    'clarification_requests',
    'task_completion_success',
    'system_response_ms',
    'error_count',
    'evaluator_comments',
    'observations',
    'limitations',
    'notes',
    'interview_notes'
  ]

  const lines = rows.map((row) => {
    return headers.map((key) => csvEscape(row[key])).join(',')
  })

  return [headers.join(','), ...lines].join('\n')
}
async function loadRows(query) {
  return withDb(async (db) => {
    const clauses = []
    const params = []

    if (query.scenarioId) {
      clauses.push('scenario_id = ?')
      params.push(String(query.scenarioId))
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

    return dbAll(
      db,
      `SELECT
        id,
        created_at,
        evaluated_at,
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
      FROM thesis_evaluations
      ${where}
      ORDER BY id DESC
      LIMIT 5000`,
      params
    )
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const rows = (await loadRows(req.query || {})).map((row) => deriveEvaluationMetrics(row))
    const summary = summarizeEvaluationRows(rows)

    const format = String(req.query.format || 'json').toLowerCase()
    if (format === 'csv') {
      const csv = toCsv(rows)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="chapter4-evidence-${stamp}.csv"`)
      return res.status(200).send(csv)
    }

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      thesisTitle: 'Chapter 4 Evidence Snapshot',
      summary,
      rows
    })
  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate chapter 4 evidence', error: String(err.message || err) })
  }
}
