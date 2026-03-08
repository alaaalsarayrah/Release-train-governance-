import {
  clearSession,
  clearSessionCookie,
  getSessionFromRequest
} from '../_lib/auth'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const session = getSessionFromRequest(req)
    if (session?.sessionId) {
      clearSession(session.sessionId)
    }

    res.setHeader('Set-Cookie', clearSessionCookie())
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ message: 'Logout failed', error: String(err?.message || err) })
  }
}
