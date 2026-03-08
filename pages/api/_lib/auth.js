import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const usersPath = path.join(process.cwd(), 'data', 'auth-users.json')
const sessionsPath = path.join(process.cwd(), 'data', 'auth-sessions.json')
const cookieName = 'agentic_auth_session'
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000

const defaultUsers = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Administrator'
  },
  {
    username: 'operator',
    password: 'operator123',
    role: 'user',
    name: 'Operator'
  }
]

function ensureFile(filePath, defaultValue) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8')
  }
}

function parseJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

function parseCookieHeader(headerValue) {
  const out = {}
  if (!headerValue) return out

  for (const entry of String(headerValue).split(';')) {
    const [rawKey, ...rest] = entry.trim().split('=')
    if (!rawKey) continue
    out[rawKey] = rest.join('=')
  }
  return out
}

function ensureAuthStorage() {
  ensureFile(usersPath, defaultUsers)
  ensureFile(sessionsPath, {})
}

function loadUsers() {
  ensureAuthStorage()
  const users = parseJsonFile(usersPath, defaultUsers)
  return Array.isArray(users) ? users : defaultUsers
}

function loadSessions() {
  ensureAuthStorage()
  const sessions = parseJsonFile(sessionsPath, {})
  return sessions && typeof sessions === 'object' ? sessions : {}
}

function saveSessions(sessions) {
  ensureAuthStorage()
  saveJsonFile(sessionsPath, sessions)
}

function sanitizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase()
  return normalized === 'admin' ? 'admin' : 'user'
}

function sanitizeSessionUser(user) {
  return {
    username: String(user.username || '').trim(),
    name: String(user.name || user.username || '').trim().slice(0, 80),
    role: sanitizeRole(user.role)
  }
}

function cleanupExpiredSessions(sessions) {
  const now = Date.now()
  let changed = false
  for (const [sessionId, value] of Object.entries(sessions)) {
    const createdAt = Number(value?.createdAt || 0)
    if (!createdAt || now - createdAt > sessionTtlMs) {
      delete sessions[sessionId]
      changed = true
    }
  }
  if (changed) saveSessions(sessions)
}

export function authenticateUser(username, password) {
  const cleanUsername = String(username || '').trim().toLowerCase()
  const cleanPassword = String(password || '')
  if (!cleanUsername || !cleanPassword) return null

  const user = loadUsers().find((u) => String(u.username || '').trim().toLowerCase() === cleanUsername)
  if (!user) return null
  if (String(user.password || '') !== cleanPassword) return null
  return sanitizeSessionUser(user)
}

export function createSession(user) {
  const sessions = loadSessions()
  cleanupExpiredSessions(sessions)
  const sessionId = crypto.randomUUID()
  sessions[sessionId] = {
    ...sanitizeSessionUser(user),
    createdAt: Date.now()
  }
  saveSessions(sessions)
  return sessionId
}

export function clearSession(sessionId) {
  if (!sessionId) return
  const sessions = loadSessions()
  if (sessions[sessionId]) {
    delete sessions[sessionId]
    saveSessions(sessions)
  }
}

export function getSessionFromRequest(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie || '')
  const sessionId = cookies[cookieName]
  if (!sessionId) return null

  const sessions = loadSessions()
  cleanupExpiredSessions(sessions)
  const record = sessions[sessionId]
  if (!record) return null

  return {
    sessionId,
    user: sanitizeSessionUser(record)
  }
}

export function buildSessionCookie(sessionId) {
  return `${cookieName}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
}

export function requireAdmin(req, res) {
  const session = getSessionFromRequest(req)
  if (!session) {
    res.status(401).json({ message: 'Authentication required' })
    return null
  }
  if (session.user.role !== 'admin') {
    res.status(403).json({ message: 'Admin role required' })
    return null
  }
  return session
}
