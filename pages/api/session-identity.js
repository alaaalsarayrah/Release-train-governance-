import {
  clearIdentityCookie,
  getIdentityFromRequest,
  serializeIdentityCookie
} from './_lib/session-identity'
import { requireAdmin } from './_lib/auth'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const identity = getIdentityFromRequest(req)
    return res.status(200).json({ identity })
  }

  if (req.method === 'POST') {
    const adminSession = requireAdmin(req, res)
    if (!adminSession) return

    try {
      const body = req.body || {}
      const name = String(body.name || '').trim()
      const role = String(body.role || '').trim()
      if (!name) {
        return res.status(400).json({ message: 'Name is required' })
      }

      const cookie = serializeIdentityCookie({ name, role })
      res.setHeader('Set-Cookie', cookie)
      return res.status(200).json({
        success: true,
        identity: {
          name: name.slice(0, 80),
          role: role.slice(0, 60)
        }
      })
    } catch (err) {
      return res.status(400).json({ message: String(err.message || err) })
    }
  }

  if (req.method === 'DELETE') {
    const adminSession = requireAdmin(req, res)
    if (!adminSession) return

    res.setHeader('Set-Cookie', clearIdentityCookie())
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
