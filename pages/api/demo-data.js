import { requireAdmin } from './_lib/auth'
import { resolveActorFromRequest } from './_lib/session-identity'
import {
  getDemoDataStatus,
  loadThesisDemoData,
  resetDemoData
} from './_lib/demo-data'

function requireAdminIfProduction(req, res) {
  if (process.env.NODE_ENV !== 'production') return true
  const session = requireAdmin(req, res)
  return Boolean(session)
}

export default async function handler(req, res) {
  if (!requireAdminIfProduction(req, res)) return

  try {
    if (req.method === 'GET') {
      const status = await getDemoDataStatus()
      return res.status(200).json({ success: true, status })
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || 'load').trim().toLowerCase()
      const actor = resolveActorFromRequest(req, req.body?.actor, 'Demo Operator')

      if (action === 'load') {
        const profile = req.body?.profile || 'thesis-demo'
        const result = await loadThesisDemoData({ profile, actor })
        const status = await getDemoDataStatus()
        return res.status(200).json({ success: true, result, status })
      }

      if (action === 'reset') {
        const result = await resetDemoData({ actor })
        const status = await getDemoDataStatus()
        return res.status(200).json({ success: true, result, status })
      }

      return res.status(400).json({ message: `Unsupported action: ${action}` })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Demo data operation failed',
      error: String(err?.message || err)
    })
  }
}