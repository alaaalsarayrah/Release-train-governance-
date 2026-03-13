import fs from 'fs'
import path from 'path'

const teamSetupPath = path.join(process.cwd(), 'data', 'team-setup.json')

function getAuthHeader(pat) {
  const token = Buffer.from(`:${pat}`).toString('base64')
  return `Basic ${token}`
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()

  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  return { response, json }
}

function normalizeForMatch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function pickIdentityUniqueName(identity) {
  const byAccount = String(identity?.properties?.Account?.$value || '').trim()
  if (byAccount) return byAccount

  const byMail = String(identity?.properties?.Mail?.$value || '').trim()
  if (byMail) return byMail

  const bySignIn = String(identity?.properties?.SignInAddress?.$value || '').trim()
  if (bySignIn) return bySignIn

  const byDisplay = String(identity?.providerDisplayName || '').trim()
  return byDisplay || null
}

function isLikelyPlaceholderEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  if (!value.includes('@')) return true

  const blockedDomains = ['test.com', 'example.com', 'example.org', 'example.net', 'invalid', 'local']
  const domain = value.split('@')[1] || ''
  return blockedDomains.some((x) => domain === x)
}

function isHumanMember(member) {
  const type = String(member?.type || '').trim().toLowerCase()
  const name = String(member?.name || '').trim().toLowerCase()
  if (type.startsWith('ai')) return false
  if (name.startsWith('ai ')) return false
  if (name.includes(' ai ') || name.includes(' ai-')) return false
  return true
}

function loadTeamSetup() {
  if (!fs.existsSync(teamSetupPath)) return null
  try {
    return JSON.parse(fs.readFileSync(teamSetupPath, 'utf-8'))
  } catch {
    return null
  }
}

function unique(items) {
  return Array.from(new Set((items || []).map((x) => String(x || '').trim()).filter(Boolean)))
}

async function fetchEntitledUsers({ org, pat }) {
  if (!org || !pat) return []
  try {
    const url = `https://vsaex.dev.azure.com/${encodeURIComponent(org)}/_apis/userentitlements?top=500&api-version=7.1-preview.3`
    const { response, json } = await fetchJson(url, {
      headers: {
        Authorization: getAuthHeader(pat),
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return []

    return (json?.items || []).map((item) => ({
      displayName: String(item?.user?.displayName || '').trim(),
      principalName: String(item?.user?.principalName || '').trim(),
      mail: String(item?.user?.mailAddress || '').trim()
    }))
  } catch {
    return []
  }
}

async function resolveIdentityCandidate({ org, pat, candidate }) {
  const clean = String(candidate || '').trim()
  if (!org || !pat || !clean) return null

  try {
    const url = `https://vssps.dev.azure.com/${encodeURIComponent(org)}/_apis/identities?searchFilter=General&filterValue=${encodeURIComponent(clean)}&queryMembership=None&api-version=7.1-preview.1`
    const { response, json } = await fetchJson(url, {
      headers: {
        Authorization: getAuthHeader(pat),
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return null
    const identities = Array.isArray(json?.value) ? json.value : []
    if (!identities.length) return null

    const normalizedCandidate = normalizeForMatch(clean)
    const exactMatch = identities.find((identity) => {
      const display = normalizeForMatch(identity?.providerDisplayName)
      const account = normalizeForMatch(identity?.properties?.Account?.$value)
      const signIn = normalizeForMatch(identity?.properties?.SignInAddress?.$value)
      return normalizedCandidate && (display === normalizedCandidate || account === normalizedCandidate || signIn === normalizedCandidate)
    })

    const best = exactMatch || identities[0]
    return pickIdentityUniqueName(best)
  } catch {
    return null
  }
}

function mapCandidatesToEntitledUsers(candidates, entitledUsers) {
  const principalSet = new Set()
  const byDisplayName = new Map()

  for (const user of entitledUsers || []) {
    const principal = String(user?.principalName || '').trim()
    const displayName = String(user?.displayName || '').trim()
    const mail = String(user?.mail || '').trim()
    if (principal) principalSet.add(principal.toLowerCase())
    if (mail) principalSet.add(mail.toLowerCase())
    if (displayName && principal) {
      byDisplayName.set(normalizeForMatch(displayName), principal)
    }
  }

  const mapped = []
  for (const candidate of candidates || []) {
    const clean = String(candidate || '').trim()
    if (!clean) continue

    const directKey = clean.toLowerCase()
    if (principalSet.has(directKey)) {
      mapped.push(clean)
      continue
    }

    const byName = byDisplayName.get(normalizeForMatch(clean))
    if (byName) {
      mapped.push(byName)
    }
  }

  return unique(mapped)
}

async function prioritizeKnownAssignableCandidates({ org, pat, candidates, entitledUsers }) {
  const entitledPrincipals = unique(
    (entitledUsers || []).flatMap((user) => [user?.principalName, user?.mail])
  )

  const entitledSet = new Set(entitledPrincipals.map((x) => x.toLowerCase()))
  const known = []
  const unknown = []

  for (const rawCandidate of candidates || []) {
    const candidate = String(rawCandidate || '').trim()
    if (!candidate) continue

    if (entitledSet.has(candidate.toLowerCase())) {
      known.push(candidate)
    } else {
      unknown.push(candidate)
    }
  }

  const resolved = []
  const unresolved = []
  const identityCache = new Map()

  for (const candidate of unknown) {
    const key = candidate.toLowerCase()
    let identity = identityCache.get(key)
    if (identity === undefined) {
      identity = await resolveIdentityCandidate({ org, pat, candidate })
      identityCache.set(key, identity || null)
    }

    if (identity) {
      resolved.push(identity)
    } else {
      unresolved.push(candidate)
    }
  }

  return unique([
    ...known,
    ...resolved,
    ...unresolved,
    ...entitledPrincipals
  ])
}

function findTeamAssigneeCandidates(setup, teamName, options = {}) {
  const allowNameFallback = options.allowNameFallback === true
  const includeFallbackTeams = options.includeFallbackTeams !== false
  if (!setup?.teams?.length) return []

  const teams = setup.teams
  const targetTeam = teamName
    ? teams.find((t) => String(t?.name || '').trim().toLowerCase() === String(teamName).trim().toLowerCase())
    : null

  const teamScopes = targetTeam
    ? (includeFallbackTeams ? [targetTeam, ...teams.filter((t) => t !== targetTeam)] : [targetTeam])
    : teams

  const preferredRoles = ['product owner', 'scrum master', 'delivery lead', 'business analyst', 'developer', 'tester']
  const candidateValues = []

  for (const role of preferredRoles) {
    for (const team of teamScopes) {
      const match = (team?.members || []).find((m) => {
        if (!isHumanMember(m)) return false
        const memberRole = String(m?.role || '').trim().toLowerCase()
        if (memberRole !== role) return false
        const email = String(m?.email || '').trim()
        return email && !isLikelyPlaceholderEmail(email)
      })

      if (match?.email) candidateValues.push(String(match.email).trim())
    }
  }

  for (const team of teamScopes) {
    const withEmail = (team?.members || []).find((m) => {
      if (!isHumanMember(m)) return false
      const email = String(m?.email || '').trim()
      return email && !isLikelyPlaceholderEmail(email)
    })
    if (withEmail?.email) candidateValues.push(String(withEmail.email).trim())
  }

  if (allowNameFallback) {
    for (const team of teamScopes) {
      const withName = (team?.members || []).find((m) => isHumanMember(m) && String(m?.name || '').trim())
      if (withName?.name) candidateValues.push(String(withName.name).trim())
    }

    // Include all human members as fallback names to maximize assignment options.
    for (const role of preferredRoles) {
      for (const team of teamScopes) {
        const byRole = (team?.members || []).find((m) => {
          if (!isHumanMember(m)) return false
          const memberRole = String(m?.role || '').trim().toLowerCase()
          return memberRole === role && String(m?.name || '').trim()
        })
        if (byRole?.name) candidateValues.push(String(byRole.name).trim())
      }
    }
  }

  return unique(candidateValues)
}

async function resolvePatOwner({ org, pat }) {
  if (!org || !pat) return null
  try {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/connectionData?connectOptions=includeServices&lastChangeId=-1&lastChangeId64=-1&api-version=7.1-preview.1`
    const response = await fetch(url, {
      headers: {
        Authorization: getAuthHeader(pat),
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return null
    const data = await response.json()
    const user = data?.authenticatedUser || {}

    const byUniqueName = String(user?.uniqueName || '').trim()
    if (byUniqueName) return byUniqueName

    const byDisplayName = String(user?.providerDisplayName || user?.customDisplayName || '').trim()
    return byDisplayName || null
  } catch {
    return null
  }
}

export function appendAssignedToPatch(patch, assignee) {
  const clean = String(assignee || '').trim()
  if (!clean) return patch
  return [...patch, { op: 'add', path: '/fields/System.AssignedTo', value: clean }]
}

export function removeAssignedToPatch(patch) {
  return (patch || []).filter((entry) => entry?.path !== '/fields/System.AssignedTo')
}

export function isAssigneeError(error) {
  const msg = String(error || '').toLowerCase()
  return (
    msg.includes('system.assignedto') ||
    msg.includes('assigned to') ||
    msg.includes('cannot find user') ||
    msg.includes('is not a valid user') ||
    msg.includes('identity')
  )
}

export async function resolveAssigneeCandidatesForAdo({ config, teamName, includeFallbackTeams = true }) {
  const explicit = String(
    config?.defaultAssignedTo ||
    config?.assignedTo ||
    process.env.ADO_DEFAULT_ASSIGNEE ||
    ''
  ).trim()

  const setup = loadTeamSetup()
  const teamCandidates = findTeamAssigneeCandidates(setup, teamName, {
    allowNameFallback: true,
    includeFallbackTeams
  })
  const entitledUsers = await fetchEntitledUsers({ org: config?.organization, pat: config?.pat })
  const mappedTeamCandidates = mapCandidatesToEntitledUsers(teamCandidates, entitledUsers)

  const fromPatOwner = await resolvePatOwner({ org: config?.organization, pat: config?.pat })

  const preCandidates = unique([
    ...mappedTeamCandidates,
    ...teamCandidates,
    explicit,
    fromPatOwner
  ])

  return prioritizeKnownAssignableCandidates({
    org: config?.organization,
    pat: config?.pat,
    candidates: preCandidates,
    entitledUsers
  })
}

export async function resolveAssigneeForAdo({ config, teamName }) {
  const candidates = await resolveAssigneeCandidatesForAdo({ config, teamName })
  return candidates[0] || null
}
