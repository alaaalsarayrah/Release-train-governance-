import { resolveActorFromRequest } from '../_lib/session-identity'
import {
  getPlanningSessionWithChildren,
  saveArchitectureNote,
  writePlanningLog
} from '../../../lib/planning/planning-db'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const sessionId = String(req.query.sessionId || '').trim()
      if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })
      const session = await getPlanningSessionWithChildren(sessionId)
      if (!session) return res.status(404).json({ message: 'Planning session not found' })
      return res.status(200).json({ architectureNotes: session.architectureNotes || [] })
    }

    if (req.method === 'POST') {
      const sessionId = String(req.body?.sessionId || '').trim()
      if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })

      const note = req.body?.note || {}
      const actor = resolveActorFromRequest(req, req.body?.actor, 'Workflow Operator')
      await saveArchitectureNote(sessionId, note, req.body?.agentOutputId || null)

      await writePlanningLog({
        sessionId,
        stage: 'Architect Advisor',
        actor,
        message: 'Architecture note saved',
        eventType: 'info'
      })

      const session = await getPlanningSessionWithChildren(sessionId)
      return res.status(200).json({ success: true, architectureNotes: session?.architectureNotes || [] })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    return res.status(400).json({ message: String(err?.message || err) })
  }
}
