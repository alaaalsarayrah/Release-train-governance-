import { resolveActorFromRequest } from '../_lib/session-identity'
import { PLANNING_AGENT_KEYS } from '../../../lib/planning/constants'
import { runSelectedPlanningAgents } from '../../../lib/planning/agent-runner'
import {
  createPlanningSession,
  getPlanningSessionWithChildren,
  listPlanningSessions,
  newPlanningSessionId,
  updatePlanningSession,
  writePlanningLog
} from '../../../lib/planning/planning-db'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const sessionId = String(req.query.sessionId || '').trim()
      if (sessionId) {
        const session = await getPlanningSessionWithChildren(sessionId)
        if (!session) return res.status(404).json({ message: 'Planning session not found' })
        return res.status(200).json({ session })
      }

      const sessions = await listPlanningSessions(Number(req.query.limit || 50))
      return res.status(200).json({ sessions })
    }

    if (req.method === 'POST') {
      const actor = resolveActorFromRequest(req, req.body?.actor, 'Workflow Operator')
      const sessionId = newPlanningSessionId()
      const selectedAgents = Array.isArray(req.body?.selectedAgents) && req.body.selectedAgents.length
        ? req.body.selectedAgents
        : PLANNING_AGENT_KEYS

      const planningContext = req.body?.planningContext || {}

      await createPlanningSession({
        id: sessionId,
        title: req.body?.title || `Sprint Planning Session ${new Date().toLocaleString()}`,
        teamId: req.body?.teamId || null,
        teamName: req.body?.teamName || null,
        sprintId: req.body?.sprintId || null,
        sprintName: req.body?.sprintName || null,
        planningContext,
        selectedAgents,
        createdBy: actor
      })

      await writePlanningLog({
        sessionId,
        stage: 'Planning Session',
        actor,
        message: 'Planning session created',
        eventType: 'info',
        details: { selectedAgents }
      })

      const runAgents = req.body?.runAgents !== false
      let outputs = []
      if (runAgents) {
        outputs = await runSelectedPlanningAgents({
          sessionId,
          selectedAgents,
          planningContext,
          actor
        })
      } else {
        await updatePlanningSession(sessionId, { status: 'draft' })
      }

      const session = await getPlanningSessionWithChildren(sessionId)
      return res.status(201).json({ success: true, sessionId, outputs, session })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    return res.status(400).json({ message: String(err?.message || err) })
  }
}
