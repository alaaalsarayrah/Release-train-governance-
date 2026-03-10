import { dbAll, dbRun, withDb } from '../_lib/requests-db'

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampLikert(value) {
  const parsed = toNumber(value, null)
  if (parsed === null) return null
  if (parsed < 1 || parsed > 5) return null
  return Math.round(parsed)
}

function asText(value, max = 2000) {
  if (value === undefined || value === null) return ''
  return String(value).trim().slice(0, max)
}

function summarize(rows) {
  if (!rows.length) {
    return {
      totalEvaluations: 0,
      avgPerceivedUsefulness: null,
      avgEaseOfUse: null,
      avgTrust: null,
      avgIntentionToUse: null,
      avgTaskCompletionMinutes: null,
      recommendationAcceptanceRate: null
    }
  }

  const mean = (values) => {
    const valid = values.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v))
    if (!valid.length) return null
    const sum = valid.reduce((acc, value) => acc + value, 0)
    return Number((sum / valid.length).toFixed(2))
  }

  const generated = rows
    .map((r) => Number(r.recommendations_generated || 0))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .reduce((acc, n) => acc + n, 0)
  const accepted = rows
    .map((r) => Number(r.recommendations_accepted || 0))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .reduce((acc, n) => acc + n, 0)

  return {
    totalEvaluations: rows.length,
    avgPerceivedUsefulness: mean(rows.map((r) => r.perceived_usefulness)),
    avgEaseOfUse: mean(rows.map((r) => r.ease_of_use)),
    avgTrust: mean(rows.map((r) => r.trust)),
    avgIntentionToUse: mean(rows.map((r) => r.intention_to_use)),
    avgTaskCompletionMinutes: mean(rows.map((r) => r.task_completion_minutes)),
    recommendationAcceptanceRate: generated > 0 ? Number(((accepted / generated) * 100).toFixed(2)) : null
  }
}

function buildWhere(query) {
  const clauses = []
  const params = []

  if (query.scenarioId) {
    clauses.push('scenario_id = ?')
    params.push(String(query.scenarioId))
  }

  if (query.participantId) {
    clauses.push('participant_id = ?')
    params.push(String(query.participantId))
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
  const scenarioId = asText(body.scenarioId, 100)
  if (!scenarioId) {
    throw new Error('scenarioId is required')
  }

  const payload = {
    scenario_id: scenarioId,
    scenario_name: asText(body.scenarioName, 240),
    participant_id: asText(body.participantId, 120),
    participant_role: asText(body.participantRole, 120),
    perceived_usefulness: clampLikert(body.perceivedUsefulness),
    ease_of_use: clampLikert(body.easeOfUse),
    trust: clampLikert(body.trust),
    intention_to_use: clampLikert(body.intentionToUse),
    task_completion_minutes: toNumber(body.taskCompletionMinutes, null),
    recommendations_generated: toNumber(body.recommendationsGenerated, null),
    recommendations_accepted: toNumber(body.recommendationsAccepted, null),
    clarification_requests: toNumber(body.clarificationRequests, null),
    system_response_ms: toNumber(body.systemResponseMs, null),
    error_count: toNumber(body.errorCount, null),
    notes: asText(body.notes, 4000),
    interview_notes: asText(body.interviewNotes, 8000)
  }

  return withDb(async (db) => {
    await dbRun(
      db,
      `INSERT INTO thesis_evaluations (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.scenario_id,
        payload.scenario_name,
        payload.participant_id,
        payload.participant_role,
        payload.perceived_usefulness,
        payload.ease_of_use,
        payload.trust,
        payload.intention_to_use,
        payload.task_completion_minutes,
        payload.recommendations_generated,
        payload.recommendations_accepted,
        payload.clarification_requests,
        payload.system_response_ms,
        payload.error_count,
        payload.notes,
        payload.interview_notes
      ]
    )

    const [latest] = await dbAll(
      db,
      `SELECT
        id,
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
      const evaluations = await getEvaluations(req.query || {})
      const summary = summarize(evaluations)
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
