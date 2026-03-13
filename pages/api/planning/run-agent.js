import { resolveActorFromRequest } from '../_lib/session-identity'
import { runSinglePlanningAgent } from '../../../lib/planning/agent-runner'
import { getPlanningSessionWithChildren, writePlanningLog } from '../../../lib/planning/planning-db'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const sessionId = String(req.body?.sessionId || '').trim()
    const agentKey = String(req.body?.agentKey || '').trim()
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })
    if (!agentKey) return res.status(400).json({ message: 'agentKey is required' })

    const actor = resolveActorFromRequest(req, req.body?.actor, 'Workflow Operator')
    const existing = await getPlanningSessionWithChildren(sessionId)
    if (!existing) return res.status(404).json({ message: 'Planning session not found' })

    const planningContext = req.body?.planningContext || existing.planning_context || {}
    const output = await runSinglePlanningAgent({
      sessionId,
      agentKey,
      planningContext,
      actor
    })

    await writePlanningLog({
      sessionId,
      stage: 'Planning Session',
      actor,
      message: `Agent re-run completed: ${agentKey}`,
      eventType: 'info'
    })

    const session = await getPlanningSessionWithChildren(sessionId)
    return res.status(200).json({ success: true, output, session })
  } catch (err) {
    return res.status(400).json({ message: String(err?.message || err) })
  }
}
