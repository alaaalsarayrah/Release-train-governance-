import { resolveActorFromRequest } from '../_lib/session-identity'
import {
  getPlanningSessionWithChildren,
  saveHumanDecision,
  writePlanningLog
} from '../../../lib/planning/planning-db'

const allowed = new Set(['accept', 'modify', 'reject', 'request_clarification'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const sessionId = String(req.body?.sessionId || '').trim()
    const decision = String(req.body?.decision || '').trim().toLowerCase()
    const outputId = Number(req.body?.agentOutputId || 0)
    const agentKey = String(req.body?.agentKey || '').trim()

    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })
    if (!allowed.has(decision)) return res.status(400).json({ message: 'Invalid decision' })

    const actor = resolveActorFromRequest(req, req.body?.actor, 'Workflow Operator')
    const session = await getPlanningSessionWithChildren(sessionId)
    if (!session) return res.status(404).json({ message: 'Planning session not found' })

    const output = outputId
      ? session.outputs.find((o) => Number(o.id) === outputId)
      : session.outputs.find((o) => o.agent_key === agentKey)

    await saveHumanDecision({
      sessionId,
      agentOutputId: output ? Number(output.id) : null,
      agentKey: agentKey || output?.agent_key || null,
      decision,
      originalOutput: output?.output_json || null,
      finalOutput: req.body?.finalOutput || output?.output_json || null,
      rationale: req.body?.humanRationale || null,
      actor
    })

    await writePlanningLog({
      sessionId,
      stage: 'Human Decision',
      actor,
      message: `Decision recorded: ${decision}`,
      eventType: 'info',
      details: {
        agentKey: agentKey || output?.agent_key || null,
        agentOutputId: output?.id || null
      }
    })

    const refreshed = await getPlanningSessionWithChildren(sessionId)
    return res.status(200).json({ success: true, session: refreshed })
  } catch (err) {
    return res.status(400).json({ message: String(err?.message || err) })
  }
}
