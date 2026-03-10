import { resolveActorFromRequest } from '../_lib/session-identity'
import {
  getPlanningSessionWithChildren,
  saveEstimationDecisions,
  writePlanningLog
} from '../../../lib/planning/planning-db'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const sessionId = String(req.query.sessionId || '').trim()
      if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })
      const session = await getPlanningSessionWithChildren(sessionId)
      if (!session) return res.status(404).json({ message: 'Planning session not found' })
      return res.status(200).json({ estimates: session.estimates || [] })
    }

    if (req.method === 'POST') {
      const sessionId = String(req.body?.sessionId || '').trim()
      const decisions = Array.isArray(req.body?.decisions) ? req.body.decisions : []
      if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })
      if (!decisions.length) return res.status(400).json({ message: 'decisions are required' })

      const actor = resolveActorFromRequest(req, req.body?.actor, 'Workflow Operator')
      await saveEstimationDecisions(sessionId, decisions, actor)
      await writePlanningLog({
        sessionId,
        stage: 'Estimation Advisor',
        actor,
        message: 'Estimation decisions saved',
        eventType: 'info',
        details: { count: decisions.length }
      })

      const session = await getPlanningSessionWithChildren(sessionId)
      return res.status(200).json({ success: true, estimates: session?.estimates || [] })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    return res.status(400).json({ message: String(err?.message || err) })
  }
}
