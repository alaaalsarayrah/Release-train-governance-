import { dbAll, withDb } from '../_lib/requests-db'

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows) {
  const headers = [
    'id',
    'created_at',
    'scenario_id',
    'scenario_name',
    'participant_id',
    'participant_role',
    'perceived_usefulness',
    'ease_of_use',
    'trust',
    'intention_to_use',
    'task_completion_minutes',
    'recommendations_generated',
    'recommendations_accepted',
    'clarification_requests',
    'system_response_ms',
    'error_count',
    'notes',
    'interview_notes'
  ]

  const lines = rows.map((row) => {
    return headers.map((key) => csvEscape(row[key])).join(',')
  })

  return [headers.join(','), ...lines].join('\n')
}

function summarize(rows) {
  const mean = (field) => {
    const values = rows
      .map((r) => Number(r[field]))
      .filter((n) => Number.isFinite(n))
    if (!values.length) return null
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
  }

  const generated = rows
    .map((r) => Number(r.recommendations_generated || 0))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .reduce((a, b) => a + b, 0)
  const accepted = rows
    .map((r) => Number(r.recommendations_accepted || 0))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .reduce((a, b) => a + b, 0)

  return {
    totalEvaluations: rows.length,
    avgPerceivedUsefulness: mean('perceived_usefulness'),
    avgEaseOfUse: mean('ease_of_use'),
    avgTrust: mean('trust'),
    avgIntentionToUse: mean('intention_to_use'),
    avgTaskCompletionMinutes: mean('task_completion_minutes'),
    avgSystemResponseMs: mean('system_response_ms'),
    avgErrors: mean('error_count'),
    recommendationAcceptanceRate: generated > 0 ? Number(((accepted / generated) * 100).toFixed(2)) : null
  }
}

async function loadRows(query) {
  return withDb(async (db) => {
    const clauses = []
    const params = []

    if (query.scenarioId) {
      clauses.push('scenario_id = ?')
      params.push(String(query.scenarioId))
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    return dbAll(
      db,
      `SELECT
        id,
        created_at,
        scenario_id,
        scenario_name,
        participant_id,
        participant_role,
        perceived_usefulness,
        ease_of_use,
        trust,
        intention_to_use,
        task_completion_minutes,
        recommendations_generated,
        recommendations_accepted,
        clarification_requests,
        system_response_ms,
        error_count,
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
    const rows = await loadRows(req.query || {})
    const summary = summarize(rows)

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
      summary,
      rows
    })
  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate chapter 4 evidence', error: String(err.message || err) })
  }
}
