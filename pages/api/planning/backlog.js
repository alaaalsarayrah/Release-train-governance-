import { loadPlanningBacklog } from '../../../lib/planning/planning-service'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const source = String(req.query.source || 'local').toLowerCase()
    const top = Number(req.query.top || 50)
    const result = await loadPlanningBacklog({ source, top })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load planning backlog', error: String(err?.message || err) })
  }
}
