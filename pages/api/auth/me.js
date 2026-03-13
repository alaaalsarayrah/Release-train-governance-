import { getSessionFromRequest } from '../_lib/auth'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const session = getSessionFromRequest(req)
  return res.status(200).json({
    authenticated: Boolean(session),
    user: session?.user || null
  })
}
