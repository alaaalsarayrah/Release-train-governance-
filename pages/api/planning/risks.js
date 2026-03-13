import { resolveActorFromRequest } from '../_lib/session-identity'
import {
  getPlanningSessionWithChildren,
  saveRiskRecords,
  writePlanningLog
} from '../../../lib/planning/planning-db'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const sessionId = String(req.query.sessionId || '').trim()
      if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })
      const session = await getPlanningSessionWithChildren(sessionId)
      if (!session) return res.status(404).json({ message: 'Planning session not found' })
      return res.status(200).json({ risks: session.risks || [] })
    }

    if (req.method === 'POST') {
      const sessionId = String(req.body?.sessionId || '').trim()
      const records = Array.isArray(req.body?.records) ? req.body.records : []
      if (!sessionId) return res.status(400).json({ message: 'sessionId is required' })
      if (!records.length) return res.status(400).json({ message: 'records are required' })

      const actor = resolveActorFromRequest(req, req.body?.actor, 'Workflow Operator')
      await saveRiskRecords(sessionId, records, req.body?.sourceAgent || 'risk_analyst')
      await writePlanningLog({
        sessionId,
        stage: 'Risk Analyst',
        actor,
        message: 'Risk register rows saved',
        eventType: 'info',
        details: { count: records.length }
      })

      const session = await getPlanningSessionWithChildren(sessionId)
      return res.status(200).json({ success: true, risks: session?.risks || [] })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    return res.status(400).json({ message: String(err?.message || err) })
  }
}
