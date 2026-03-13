import crypto from 'crypto'
import { resolveActorFromRequest } from '../_lib/session-identity'
import { DEFAULT_SCENARIOS } from '../../../lib/planning/constants'
import {
  createScenarioRun,
  getScenarioRuns,
  saveScenarioInteraction,
  updateScenarioRun
} from '../../../lib/planning/planning-db'

function getScenarioByKey(key) {
  return DEFAULT_SCENARIOS.find((s) => s.key === key) || null
}

function summarizeRuns(runs) {
  if (!runs.length) {
    return {
      totalRuns: 0,
      avgPerceivedUsefulness: null,
      avgEaseOfUse: null,
      avgTrust: null,
      avgIntentionToUse: null,
      avgDurationSeconds: null,
      acceptanceRate: null
    }
  }

  const mean = (selector) => {
    const values = runs.map(selector).map(Number).filter((n) => Number.isFinite(n))
    if (!values.length) return null
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
  }

  const shown = runs.reduce((acc, r) => acc + Number(r.recommendations_shown || 0), 0)
  const accepted = runs.reduce((acc, r) => acc + Number(r.accepted_count || 0), 0)

  return {
    totalRuns: runs.length,
    avgPerceivedUsefulness: mean((r) => r.perceived_usefulness),
    avgEaseOfUse: mean((r) => r.ease_of_use),
    avgTrust: mean((r) => r.trust),
    avgIntentionToUse: mean((r) => r.intention_to_use),
    avgDurationSeconds: mean((r) => r.duration_seconds),
    acceptanceRate: shown > 0 ? Number(((accepted / shown) * 100).toFixed(2)) : null
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const runs = await getScenarioRuns(Number(req.query.limit || 300))
      const scenarioKey = String(req.query.scenarioKey || '').trim()
      const filtered = scenarioKey ? runs.filter((r) => r.scenario_key === scenarioKey) : runs

      const byScenario = filtered.reduce((acc, row) => {
        const key = row.scenario_key
        if (!acc[key]) acc[key] = { key, name: row.scenario_name, runs: [] }
        acc[key].runs.push(row)
        return acc
      }, {})

      const scenarioSummaries = Object.values(byScenario).map((item) => ({
        key: item.key,
        name: item.name,
        summary: summarizeRuns(item.runs)
      }))

      return res.status(200).json({
        scenarios: DEFAULT_SCENARIOS,
        runs: filtered,
        participantSummary: summarizeRuns(filtered),
        scenarioSummaries
      })
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || 'start').toLowerCase()
      const actor = resolveActorFromRequest(req, req.body?.actor, 'Evaluation Participant')

      if (action === 'start') {
        const scenarioKey = String(req.body?.scenarioKey || '').trim()
        const scenario = getScenarioByKey(scenarioKey)
        if (!scenario) return res.status(400).json({ message: 'Invalid scenarioKey' })

        const runId = `RUN-${crypto.randomUUID()}`
        await createScenarioRun({
          runId,
          scenario,
          participantId: req.body?.participantId || null,
          participantRole: req.body?.participantRole || null,
          instructions: req.body?.instructions || scenario.instructions,
          syntheticData: req.body?.syntheticData || scenario.syntheticData
        })

        return res.status(201).json({
          success: true,
          runId,
          scenario,
          instructions: req.body?.instructions || scenario.instructions,
          syntheticData: req.body?.syntheticData || scenario.syntheticData
        })
      }

      if (action === 'interaction') {
        const runId = String(req.body?.runId || '').trim()
        if (!runId) return res.status(400).json({ message: 'runId is required' })

        await saveScenarioInteraction({
          runId,
          recommendationId: req.body?.recommendationId || null,
          action: req.body?.interactionAction || null,
          actor,
          notes: req.body?.notes || null
        })

        return res.status(200).json({ success: true })
      }

      if (action === 'complete') {
        const runId = String(req.body?.runId || '').trim()
        if (!runId) return res.status(400).json({ message: 'runId is required' })

        const endedAt = new Date().toISOString()
        const startedAt = req.body?.startedAt ? new Date(req.body.startedAt) : null
        const durationSeconds = startedAt && !Number.isNaN(startedAt.getTime())
          ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000))
          : Number(req.body?.durationSeconds || 0)

        await updateScenarioRun(runId, {
          ended_at: endedAt,
          duration_seconds: durationSeconds,
          recommendations_shown: Number(req.body?.recommendationsShown || 0),
          accepted_count: Number(req.body?.acceptedCount || 0),
          modified_count: Number(req.body?.modifiedCount || 0),
          rejected_count: Number(req.body?.rejectedCount || 0),
          clarification_requests: Number(req.body?.clarificationRequests || 0),
          perceived_usefulness: Number(req.body?.perceivedUsefulness || null),
          ease_of_use: Number(req.body?.easeOfUse || null),
          trust: Number(req.body?.trust || null),
          intention_to_use: Number(req.body?.intentionToUse || null),
          notes: req.body?.notes || null
        })

        return res.status(200).json({ success: true, runId })
      }

      return res.status(400).json({ message: `Unsupported action: ${action}` })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ message: 'Scenario runner failed', error: String(err?.message || err) })
  }
}
