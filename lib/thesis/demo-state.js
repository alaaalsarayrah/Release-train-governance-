const THESIS_DEMO_PROFILE = 'thesis-demo'
const THESIS_DEMO_SESSION_PREFIX = 'PLAN-THESIS-DEMO'
let autoRecoveryInFlight = null

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(json?.message || `Request failed for ${url}`)
  }
  return json
}

export function resolvePreferredPlanningSession(sessions = []) {
  const rows = Array.isArray(sessions) ? sessions : []
  if (!rows.length) return null

  return rows.find((row) => String(row?.id || '').startsWith(THESIS_DEMO_SESSION_PREFIX))
    || rows.find((row) => String(row?.status || '').toLowerCase() === 'finalized')
    || rows[0]
    || null
}

function hasActiveSprint(teamSetup) {
  return Boolean((teamSetup?.sprints || []).find((row) => String(row?.status || '').toLowerCase() === 'active'))
}

function buildRecoveryReason({ teamSetup, preferredSession, status }) {
  if (!teamSetup?.teams?.length) return 'Load Thesis Demo Data to populate thesis team setup.'
  if (!teamSetup?.sprints?.length) return 'Load Thesis Demo Data to populate sprint setup.'
  if (!hasActiveSprint(teamSetup)) return 'Load Thesis Demo Data to activate the thesis demonstration sprint.'
  if (!preferredSession) return 'Load Thesis Demo Data to seed the thesis planning session.'
  if (status?.activeProfile?.profile && status.activeProfile.profile !== THESIS_DEMO_PROFILE) {
    return 'Load Thesis Demo Data to switch to the deterministic thesis profile.'
  }
  return ''
}

async function runAutoRecovery() {
  if (!autoRecoveryInFlight) {
    autoRecoveryInFlight = (async () => {
      try {
        await loadThesisDemoData()
      } finally {
        autoRecoveryInFlight = null
      }
    })()
  }

  await autoRecoveryInFlight
}

export async function loadThesisDemoData(profile = THESIS_DEMO_PROFILE) {
  const json = await fetchJson('/api/demo-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'load', profile })
  })

  return json
}

export async function resetThesisDemoData() {
  const json = await fetchJson('/api/demo-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset' })
  })

  return json
}

export async function getThesisDemoHydrationState({ autoRecover = false } = {}) {
  const [statusResult, teamSetupResult, sessionsResult] = await Promise.allSettled([
    fetchJson('/api/demo-data'),
    fetchJson('/api/team-setup'),
    fetchJson('/api/planning/session?limit=25')
  ])

  const status = statusResult.status === 'fulfilled' ? statusResult.value?.status || null : null
  const teamSetup = teamSetupResult.status === 'fulfilled'
    ? {
        teams: teamSetupResult.value?.teams || [],
        sprints: teamSetupResult.value?.sprints || []
      }
    : { teams: [], sprints: [] }
  const sessions = sessionsResult.status === 'fulfilled' ? sessionsResult.value?.sessions || [] : []
  const preferredSession = resolvePreferredPlanningSession(sessions)
  const activeSprint = (teamSetup.sprints || []).find((row) => String(row?.status || '').toLowerCase() === 'active') || null
  const profile = String(status?.activeProfile?.profile || '')
  const usesThesisProfile = profile === THESIS_DEMO_PROFILE
  const hasDemoSession = Boolean(preferredSession)
  const recoveryReason = buildRecoveryReason({ teamSetup, preferredSession, status })
  const errors = [statusResult, teamSetupResult, sessionsResult]
    .filter((result) => result.status === 'rejected')
    .map((result) => String(result.reason?.message || result.reason || 'Unknown hydration error'))
  const hasFetchFailures = errors.length > 0
  const needsRecovery = !hasFetchFailures && (!teamSetup.teams.length || !teamSetup.sprints.length || !activeSprint || !hasDemoSession || !usesThesisProfile)

  if (autoRecover && hasFetchFailures) {
    return {
      status,
      teamSetup,
      sessions,
      preferredSession,
      activeSprint,
      usesThesisProfile,
      needsRecovery: false,
      recoveryAttempted: false,
      recoveryReason: 'Unable to verify demo state because one or more APIs did not respond. Retry or refresh this page.',
      recoveryError: '',
      recovered: false,
      errors
    }
  }

  if (autoRecover && needsRecovery) {
    try {
      await runAutoRecovery()
      const recovered = await getThesisDemoHydrationState({ autoRecover: false })
      return {
        ...recovered,
        recovered: true,
        recoveryAttempted: true,
        recoveryReason
      }
    } catch (err) {
      return {
        status,
        teamSetup,
        sessions,
        preferredSession,
        activeSprint,
        usesThesisProfile,
        needsRecovery,
        recoveryAttempted: true,
        recoveryReason,
        recoveryError: String(err?.message || err),
        errors
      }
    }
  }

  return {
    status,
    teamSetup,
    sessions,
    preferredSession,
    activeSprint,
    usesThesisProfile,
    needsRecovery,
    recoveryAttempted: false,
    recoveryReason,
    recoveryError: '',
    recovered: false,
    errors
  }
}

export { THESIS_DEMO_PROFILE, THESIS_DEMO_SESSION_PREFIX }