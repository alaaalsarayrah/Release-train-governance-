import { resolveActorFromRequest } from '../../pages/api/_lib/session-identity'
import {
  createPlanningSession,
  getPlanningSessionWithChildren,
  newPlanningSessionId,
  writePlanningLog
} from './planning-db'
import { runSinglePlanningAgent } from './agent-runner'

export async function runSingleAgentEndpoint(req, res, agentKey) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const actor = resolveActorFromRequest(req, req.body?.actor, 'Workflow Operator')
    let sessionId = String(req.body?.sessionId || '').trim()
    let planningContext = req.body?.planningContext || null

    if (!sessionId) {
      sessionId = newPlanningSessionId()
      await createPlanningSession({
        id: sessionId,
        title: `${agentKey} ad-hoc run`,
        teamId: req.body?.teamId || null,
        teamName: req.body?.teamName || null,
        sprintId: req.body?.sprintId || null,
        sprintName: req.body?.sprintName || null,
        planningContext: planningContext || {},
        selectedAgents: [agentKey],
        createdBy: actor
      })

      await writePlanningLog({
        sessionId,
        stage: 'Planning Session',
        actor,
        message: 'Ad-hoc planning session created',
        eventType: 'info',
        details: { selectedAgents: [agentKey] }
      })
    }

    if (!planningContext) {
      const existing = await getPlanningSessionWithChildren(sessionId)
      planningContext = existing?.planning_context || {}
    }

    const output = await runSinglePlanningAgent({
      agentKey,
      planningContext,
      sessionId,
      actor
    })

    const session = await getPlanningSessionWithChildren(sessionId)
    return res.status(200).json({ success: true, sessionId, output, session })
  } catch (err) {
    return res.status(400).json({ message: String(err?.message || err) })
  }
}
