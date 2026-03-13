import fs from 'fs'
import path from 'path'
import { sendAdoError } from './_lib/ado-error'

const adoConfigPath = path.join(process.cwd(), 'public', '.ado-config.json')
const teamSetupPath = path.join(process.cwd(), 'data', 'team-setup.json')

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function authHeader(pat) {
  const token = Buffer.from(`:${pat}`).toString('base64')
  return `Basic ${token}`
}

function isLikelyValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

function isPlaceholderEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  const domains = ['test.com', 'example.com', 'example.org', 'example.net', 'invalid.local', 'invalid', 'local']
  return domains.some((domain) => value.endsWith(`@${domain}`))
}

function normalizeForMatch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function isHumanMember(member) {
  const type = String(member?.type || '').trim().toLowerCase()
  const name = String(member?.name || '').trim().toLowerCase()
  if (type.startsWith('ai')) return false
  if (name.startsWith('ai ')) return false
  if (name.includes(' ai ') || name.includes(' ai-')) return false
  return true
}

async function fetchEntitledUsers({ org, pat }) {
  const url = `https://vsaex.dev.azure.com/${encodeURIComponent(org)}/_apis/userentitlements?top=500&api-version=7.1-preview.3`
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(pat),
      'Content-Type': 'application/json'
    }
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    const err = new Error(json?.message || json?.raw || `Failed to load ADO entitled users (${res.status})`)
    err.status = res.status
    throw err
  }

  return (json?.items || []).map((item) => ({
    displayName: String(item?.user?.displayName || '').trim(),
    principalName: String(item?.user?.principalName || '').trim(),
    mail: String(item?.user?.mailAddress || '').trim(),
    subjectKind: String(item?.user?.subjectKind || '').trim()
  }))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const ado = loadJson(adoConfigPath)
    const setup = loadJson(teamSetupPath)

    if (!ado?.organization || !ado?.pat) {
      return res.status(400).json({ message: 'ADO is not configured' })
    }

    if (!setup?.teams?.length) {
      return res.status(400).json({ message: 'No team setup found' })
    }

    const entitledUsers = await fetchEntitledUsers({ org: ado.organization, pat: ado.pat })

    const byPrincipal = new Map()
    const byDisplay = new Map()

    for (const user of entitledUsers) {
      const principal = String(user.principalName || '').trim().toLowerCase()
      const mail = String(user.mail || '').trim().toLowerCase()
      const display = normalizeForMatch(user.displayName)

      if (principal) byPrincipal.set(principal, user)
      if (mail) byPrincipal.set(mail, user)
      if (display && !byDisplay.has(display)) byDisplay.set(display, user)
    }

    const memberChecks = []
    const suggestedEmailUpdates = []

    for (const team of setup.teams) {
      for (const member of team.members || []) {
        if (!isHumanMember(member)) {
          memberChecks.push({
            team: team.name,
            member: member.name,
            role: member.role,
            email: member.email || '',
            status: 'skipped_ai',
            assignable: false,
            reason: 'AI/Agent member'
          })
          continue
        }

        const name = String(member.name || '').trim()
        const email = String(member.email || '').trim()
        const emailLower = email.toLowerCase()
        const byEmail = email ? byPrincipal.get(emailLower) : null
        const byName = byDisplay.get(normalizeForMatch(name))

        let status = 'unresolved'
        let assignable = false
        let reason = 'No matching entitled ADO user'
        let matchedUser = null

        if (!email) {
          status = 'missing_email'
          reason = 'Missing email in team setup'
        } else if (!isLikelyValidEmail(email)) {
          status = 'invalid_email'
          reason = 'Invalid email format'
        } else if (isPlaceholderEmail(email)) {
          if (byName) {
            status = 'placeholder_email_name_match'
            assignable = true
            reason = 'Placeholder email but name matches entitled ADO user'
            matchedUser = byName
          } else {
            status = 'placeholder_email'
            reason = 'Placeholder/test email'
          }
        } else if (byEmail) {
          status = 'assignable_by_email'
          assignable = true
          reason = 'Email matches entitled ADO user'
          matchedUser = byEmail
        } else if (byName) {
          status = 'assignable_by_name'
          assignable = true
          reason = 'Name matches entitled ADO user'
          matchedUser = byName
        }

        const normalizedMatchedPrincipal = String(matchedUser?.principalName || '').trim()
        if (
          matchedUser &&
          normalizedMatchedPrincipal &&
          String(email || '').trim().toLowerCase() !== normalizedMatchedPrincipal.toLowerCase()
        ) {
          suggestedEmailUpdates.push({
            team: team.name,
            member: name,
            currentEmail: email || null,
            suggestedEmail: normalizedMatchedPrincipal
          })
        }

        memberChecks.push({
          team: team.name,
          member: name,
          role: member.role,
          email,
          status,
          assignable,
          reason,
          matchedAdoDisplayName: matchedUser?.displayName || null,
          matchedAdoPrincipalName: normalizedMatchedPrincipal || null
        })
      }
    }

    const summary = {
      totalMembers: memberChecks.length,
      humanMembers: memberChecks.filter((x) => x.status !== 'skipped_ai').length,
      assignableHumans: memberChecks.filter((x) => x.assignable).length,
      unresolvedHumans: memberChecks.filter((x) => x.status !== 'skipped_ai' && !x.assignable).length,
      missingEmail: memberChecks.filter((x) => x.status === 'missing_email').length,
      invalidEmail: memberChecks.filter((x) => x.status === 'invalid_email').length,
      placeholderEmail: memberChecks.filter((x) => x.status === 'placeholder_email').length,
      aiSkipped: memberChecks.filter((x) => x.status === 'skipped_ai').length,
      entitledAdoUsers: entitledUsers.length,
      suggestedEmailUpdates: suggestedEmailUpdates.length
    }

    return res.status(200).json({
      success: true,
      organization: ado.organization,
      summary,
      entitledUsers,
      memberChecks,
      suggestedEmailUpdates
    })
  } catch (err) {
    return sendAdoError(res, err, 'Failed to compute assignment readiness')
  }
}
