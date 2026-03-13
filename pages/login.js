import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [currentSessionUser, setCurrentSessionUser] = useState(null)
  const [message, setMessage] = useState('')
  const showDevLoginNote = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN_NOTE === 'true'

  useEffect(() => {
    void checkExistingSession()
  }, [])

  async function checkExistingSession() {
    setCheckingSession(true)
    try {
      const res = await fetch('/api/auth/me')
      const json = await res.json()
      setCurrentSessionUser(json?.authenticated && json?.user ? json.user : null)
    } catch {
      setCurrentSessionUser(null)
    } finally {
      setCheckingSession(false)
    }
  }

  function getRedirectTarget(role) {
    const next = typeof router.query.next === 'string' ? router.query.next : ''
    if (next && next.startsWith('/')) return next
    return String(role || '').toLowerCase() === 'admin' ? '/administrator' : '/dashboard'
  }

  async function login(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Login failed')
      setCurrentSessionUser(json?.user || null)
      router.push(getRedirectTarget(json?.user?.role))
    } catch (err) {
      setMessage(`Login failed: ${err.message || err}`)
    } finally {
      setBusy(false)
    }
  }

  async function logoutCurrentSession() {
    setBusy(true)
    setMessage('')
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setCurrentSessionUser(null)
      setMessage('Signed out. You can now sign in with a different account.')
    } catch (err) {
      setMessage(`Sign-out failed: ${err.message || err}`)
    } finally {
      setBusy(false)
    }
  }

  function continueAsCurrentUser() {
    if (!currentSessionUser) return
    router.push(getRedirectTarget(currentSessionUser.role))
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />
      <section className="card">
        <h1>Sign In</h1>
        <p>Use your role-based account to access administrator or user features.</p>

        {checkingSession ? <p className="sessionInfo">Checking current session...</p> : null}

        {!checkingSession && currentSessionUser ? (
          <div className="sessionCard">
            <p>
              You are already signed in as <strong>{currentSessionUser.name || currentSessionUser.username}</strong>
              {' '}
              ({currentSessionUser.role}).
            </p>
            <div className="sessionActions">
              <button type="button" onClick={continueAsCurrentUser} disabled={busy}>Continue</button>
              <button type="button" className="secondary" onClick={logoutCurrentSession} disabled={busy}>Sign Out</button>
            </div>
            <p className="hint">To switch roles, sign out first or sign in below with another account.</p>
          </div>
        ) : null}

        <form onSubmit={login}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign In'}</button>
        </form>

        {message ? <div className="msg">{message}</div> : null}

        {showDevLoginNote ? (
          <div className="demoAccounts">
            <h3>Development Access Note</h3>
            <p>Use locally configured accounts for development sign-in.</p>
          </div>
        ) : null}
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          position: relative;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
          color: #11253d;
        }

        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 10% 12%, rgba(20, 143, 180, 0.15), transparent 42%),
            radial-gradient(circle at 86% 8%, rgba(57, 118, 218, 0.15), transparent 45%),
            linear-gradient(180deg, #f8fbff, #eef4ff);
        }

        .card {
          width: min(460px, 100%);
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.08);
          padding: 16px;
          display: grid;
          gap: 10px;
        }

        .sessionInfo {
          font-size: 13px;
          color: #36516d;
        }

        .sessionCard {
          border: 1px solid #cce2fa;
          background: #f3f8ff;
          border-radius: 12px;
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .sessionActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hint {
          font-size: 12px;
          color: #4f6781;
          margin: 0;
        }

        h1 {
          margin: 0;
          font-size: 32px;
        }

        p {
          margin: 0;
          color: #4c647e;
        }

        form {
          display: grid;
          gap: 9px;
        }

        label {
          display: grid;
          gap: 4px;
          color: #35506b;
          font-size: 12px;
          font-weight: 700;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          padding: 9px;
          font-size: 14px;
          color: #10223a;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        button {
          border: none;
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
          color: #fff;
          font-weight: 700;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
        }

        .secondary {
          background: linear-gradient(135deg, #475569, #334155);
        }

        button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .msg {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          border-radius: 10px;
          padding: 8px;
          font-size: 13px;
          font-weight: 700;
        }

        .demoAccounts {
          border-top: 1px solid #e2ecf8;
          padding-top: 10px;
          display: grid;
          gap: 4px;
        }

        .demoAccounts h3 {
          margin: 0;
          font-size: 14px;
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
