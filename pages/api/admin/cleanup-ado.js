import { clearAdoProjectData } from '../_lib/admin-cleanup'
import { requireAdmin } from '../_lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const adminSession = requireAdmin(req, res)
  if (!adminSession) return

  try {
    const projectOverride = req.body?.project ? String(req.body.project) : undefined
    const report = await clearAdoProjectData({ projectOverride })
    return res.status(200).json({ success: true, report })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'ADO cleanup failed',
      error: String(err?.message || err)
    })
  }
}
