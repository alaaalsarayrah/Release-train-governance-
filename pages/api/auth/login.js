import {
  authenticateUser,
  buildSessionCookie,
  createSession
} from '../_lib/auth'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { username, password } = req.body || {}
    const user = authenticateUser(username, password)
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' })
    }

    const sessionId = createSession(user)
    res.setHeader('Set-Cookie', buildSessionCookie(sessionId))
    return res.status(200).json({
      success: true,
      user
    })
  } catch (err) {
    return res.status(500).json({ message: 'Login failed', error: String(err?.message || err) })
  }
}
