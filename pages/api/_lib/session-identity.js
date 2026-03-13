function parseCookieHeader(headerValue) {
  const out = {}
  if (!headerValue) return out

  const parts = String(headerValue).split(';')
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (!rawKey) continue
    out[rawKey] = rest.join('=')
  }
  return out
}

function normalizeIdentity(value) {
  if (!value || typeof value !== 'object') return null
  const name = String(value.name || '').trim()
  const role = String(value.role || '').trim()
  if (!name) return null
  return {
    name: name.slice(0, 80),
    role: role.slice(0, 60)
  }
}

export function getIdentityFromRequest(req) {
  try {
    const cookies = parseCookieHeader(req?.headers?.cookie || '')
    const raw = cookies.agentic_identity
    if (!raw) return null
    const decoded = decodeURIComponent(raw)
    const parsed = JSON.parse(decoded)
    return normalizeIdentity(parsed)
  } catch {
    return null
  }
}

export function formatIdentityActor(identity) {
  if (!identity?.name) return null
  return identity.role ? `${identity.name} (${identity.role})` : identity.name
}

export function resolveActorFromRequest(req, explicitActor, fallback = 'Workflow Operator') {
  const explicit = String(explicitActor || '').trim()
  if (explicit) return explicit
  const identity = getIdentityFromRequest(req)
  return formatIdentityActor(identity) || fallback
}

export function serializeIdentityCookie(identity) {
  const normalized = normalizeIdentity(identity)
  if (!normalized) {
    throw new Error('Name is required')
  }

  const payload = encodeURIComponent(JSON.stringify(normalized))
  return `agentic_identity=${payload}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`
}

export function clearIdentityCookie() {
  return 'agentic_identity=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
}
