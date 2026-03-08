import fs from 'fs'
import path from 'path'

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

async function inviteUser({ org, pat, email }) {
  const url = `https://vsaex.dev.azure.com/${org}/_apis/userentitlements?api-version=7.1-preview.3`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(pat),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accessLevel: { accountLicenseType: 'express' },
      user: { principalName: email, subjectKind: 'user' }
    })
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  const opSuccess = json?.operationResult?.isSuccess
  const rootSuccess = json?.isSuccess
  const logicalSuccess = opSuccess === true || rootSuccess === true
  const opErrors = (json?.operationResult?.errors || []).map((e) => e.value).filter(Boolean)

  return {
    ok: res.ok && logicalSuccess,
    status: res.status,
    message:
      opErrors[0] ||
      json?.message ||
      json?.raw ||
      `${res.status} ${res.statusText}`
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const org = ado.organization
    const pat = ado.pat
    const report = {
      invited: [],
      failed: [],
      skippedNoEmail: [],
      skippedAiAgents: [],
      duplicates: []
    }

    const seenEmails = new Set()

    for (const team of setup.teams) {
      for (const member of team.members || []) {
        if (member.type !== 'Human') {
          report.skippedAiAgents.push({ team: team.name, member: member.name })
          continue
        }

        const email = (member.email || '').trim()
        if (!email) {
          report.skippedNoEmail.push({ team: team.name, member: member.name })
          continue
        }

        if (seenEmails.has(email.toLowerCase())) {
          report.duplicates.push({ team: team.name, member: member.name, email })
          continue
        }
        seenEmails.add(email.toLowerCase())

        const result = await inviteUser({ org, pat, email })
        if (result.ok) {
          report.invited.push({ team: team.name, member: member.name, email })
        } else {
          report.failed.push({ team: team.name, member: member.name, email, status: result.status, message: result.message })
        }
      }
    }

    return res.status(200).json({ success: true, report })
  } catch (err) {
    return res.status(500).json({ message: 'User sync failed', error: String(err.message || err) })
  }
}