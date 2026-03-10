import { resolveActorFromRequest } from '../_lib/session-identity'
import {
  getPlanningSessionWithChildren,
  updatePlanningSession,
  writePlanningLog
} from '../../../lib/planning/planning-db'

function summarizeDecisions(decisions = []) {
  const counts = { accept: 0, modify: 0, reject: 0, request_clarification: 0 }
  for (const item of decisions) {
    const key = String(item?.decision || '').toLowerCase()
    if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1
  }
  return counts
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const sessionId = String(req.body?.sessionId || '').trim()
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })

    const actor = resolveActorFromRequest(req, req.body?.actor, 'Workflow Operator')
    const session = await getPlanningSessionWithChildren(sessionId)
    if (!session) return res.status(404).json({ message: 'Planning session not found' })

    const decisionCounts = summarizeDecisions(session.decisions || [])
    const finalSummary = req.body?.summary || {
      session_id: sessionId,
      title: session.title,
      team: session.team_name,
      sprint: session.sprint_name,
      generated_at: new Date().toISOString(),
      outputs_count: session.outputs.length,
      decisions: decisionCounts,
      recommendation_digest: session.outputs.map((o) => ({
        agent_key: o.agent_key,
        summary: o.summary,
        confidence: o.confidence
      })),
      dependency_count: session.dependencies.length,
      risk_count: session.risks.length,
      estimation_rows: session.estimates.length
    }

    await updatePlanningSession(sessionId, {
      status: 'finalized',
      final_summary: JSON.stringify(finalSummary),
      finalized_by: actor,
      finalized_at: new Date().toISOString()
    })

    await writePlanningLog({
      sessionId,
      stage: 'Planning Session',
      actor,
      message: 'Planning session finalized',
      eventType: 'success',
      details: {
        outputs: session.outputs.length,
        decisions: decisionCounts
      }
    })

    const refreshed = await getPlanningSessionWithChildren(sessionId)
    return res.status(200).json({ success: true, summary: finalSummary, session: refreshed })
  } catch (err) {
    return res.status(400).json({ message: String(err?.message || err) })
  }
}
