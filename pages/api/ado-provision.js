import fs from 'fs'
import path from 'path'

const adoConfigPath = path.join(process.cwd(), 'public', '.ado-config.json')
const teamSetupPath = path.join(process.cwd(), 'data', 'team-setup.json')

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function getAuthHeader(pat) {
  const token = Buffer.from(`:${pat}`).toString('base64')
  return `Basic ${token}`
}

async function adoRequest({ org, pat, apiPath, method = 'GET', body }) {
  const url = `https://dev.azure.com/${org}${apiPath}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: getAuthHeader(pat),
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    const message = json?.message || json?.raw || `ADO request failed (${res.status})`
    throw new Error(message)
  }

  return json
}

async function inviteUser({ org, pat, email }) {
  const url = `https://vsaex.dev.azure.com/${org}/_apis/userentitlements?api-version=7.1-preview.3`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(pat),
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

  if (!res.ok || !logicalSuccess) {
    const message = opErrors[0] || json?.message || json?.raw || `User invite failed (${res.status})`
    throw new Error(message)
  }

  return json
}

function flattenIterations(node, parentPath = '', out = new Map()) {
  if (!node) return out
  const nodePath = node.path || (node.name ? `${parentPath}\${node.name}` : parentPath)
  if (node.name && nodePath) {
    out.set(nodePath.replace('\\\\', '\\'), node)
  }
  for (const child of node.children || []) {
    flattenIterations(child, nodePath, out)
  }
  return out
}

function findIterationBySuffix(iterationMap, suffix) {
  const normalized = suffix.replace(/\//g, '\\').toLowerCase()
  for (const [key, value] of iterationMap.entries()) {
    if (key.toLowerCase().endsWith(normalized)) {
      return value
    }
  }
  return null
}

async function tryCreateIterationAtPath({ org, pat, project, parentPath, name, attributes }) {
  const encodedPath = parentPath
    ? `/${parentPath.split('\\').map((p) => encodeURIComponent(p)).join('/')}`
    : ''
  const apiPath = `/${encodeURIComponent(project)}/_apis/wit/classificationnodes/Iterations${encodedPath}?api-version=7.1`
  await adoRequest({
    org,
    pat,
    method: 'POST',
    apiPath,
    body: {
      name,
      ...(attributes ? { attributes } : {})
    }
  })
}

async function patchTeamSettings({ org, pat, project, teamId, backlogIterationPath, defaultIterationPath }) {
  const apiPath = `/${encodeURIComponent(project)}/${encodeURIComponent(teamId)}/_apis/work/teamsettings?api-version=7.1`
  await adoRequest({
    org,
    pat,
    method: 'PATCH',
    apiPath,
    body: {
      backlogIteration: backlogIterationPath
    }
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const ado = loadJson(adoConfigPath)
    const setup = loadJson(teamSetupPath)
    const userEmails = req.body?.userEmails || []

    if (!ado?.organization || !ado?.project || !ado?.pat) {
      return res.status(400).json({ message: 'ADO is not configured' })
    }

    if (!setup?.teams || !setup?.sprints) {
      return res.status(400).json({ message: 'Team setup not initialized yet' })
    }

    const org = ado.organization
    const project = ado.project
    const pat = ado.pat

    const report = {
      project,
      teamsCreated: [],
      teamsExisting: [],
      sprintsCreated: [],
      sprintsExisting: [],
      sprintAssignments: [],
      teamSettingsUpdated: [],
      usersInvited: [],
      userInviteErrors: [],
      warnings: []
    }

    const projectInfo = await adoRequest({
      org,
      pat,
      apiPath: `/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`
    })
    const projectId = projectInfo?.id

    const teamsResponse = await adoRequest({
      org,
      pat,
      apiPath: `/_apis/projects/${encodeURIComponent(projectId)}/teams?api-version=7.1-preview.3`
    })
    const existingTeams = new Set((teamsResponse?.value || []).map((t) => t.name))

    for (const team of setup.teams) {
      if (existingTeams.has(team.name)) {
        report.teamsExisting.push(team.name)
        continue
      }

      await adoRequest({
        org,
        pat,
        method: 'POST',
        apiPath: `/_apis/projects/${encodeURIComponent(projectId)}/teams?api-version=7.1-preview.3`,
        body: { name: team.name, description: `${team.name} provisioned from app` }
      })
      report.teamsCreated.push(team.name)
    }

    const teamsAfter = await adoRequest({
      org,
      pat,
      apiPath: `/_apis/projects/${encodeURIComponent(projectId)}/teams?api-version=7.1-preview.3`
    })
    const teamMap = new Map((teamsAfter?.value || []).map((t) => [t.name, t]))

    const iterationsRoot = await adoRequest({
      org,
      pat,
      apiPath: `/${encodeURIComponent(project)}/_apis/wit/classificationnodes/Iterations?$depth=6&api-version=7.1`
    })

    const existingIterations = flattenIterations(iterationsRoot)

    for (const team of setup.teams) {
      const teamPath = `${project}\\${team.name}`
      const teamNode = findIterationBySuffix(existingIterations, `\\${team.name}`)
      if (!teamNode) {
        try {
          await tryCreateIterationAtPath({ org, pat, project, parentPath: '', name: team.name })
        } catch (err) {
          const msg = String(err.message || err)
          if (!msg.toLowerCase().includes('already exists')) {
            report.warnings.push(`Team iteration root create failed for ${team.name}: ${msg}`)
          }
        }
      }
    }

    for (const sprint of setup.sprints) {
      let existedEverywhere = true
      for (const team of setup.teams) {
            const teamSprintNode = findIterationBySuffix(existingIterations, `\\${team.name}\\${sprint.name}`)
            if (!teamSprintNode) {
          existedEverywhere = false
          try {
            await tryCreateIterationAtPath({
              org,
              pat,
              project,
              parentPath: team.name,
              name: sprint.name,
              attributes: {
                startDate: sprint.startDate,
                finishDate: sprint.endDate
              }
            })
          } catch (err) {
            const msg = String(err.message || err)
            if (!msg.toLowerCase().includes('already exists')) {
              report.warnings.push(`Sprint node create failed for ${team.name}/${sprint.name}: ${msg}`)
            }
          }
        }
      }
      if (existedEverywhere) {
        report.sprintsExisting.push(sprint.name)
      } else {
        report.sprintsCreated.push(sprint.name)
      }
    }

    const iterationsRootAfter = await adoRequest({
      org,
      pat,
      apiPath: `/${encodeURIComponent(project)}/_apis/wit/classificationnodes/Iterations?$depth=6&api-version=7.1`
    })
    const allIterations = flattenIterations(iterationsRootAfter)

    for (const team of setup.teams) {
      const teamInfo = teamMap.get(team.name)
      if (!teamInfo?.id) {
        report.warnings.push(`Team id not found for ${team.name}`)
        continue
      }

      const teamNode = findIterationBySuffix(allIterations, `\\${team.name}`)
      const defaultSprintName = setup.sprints[0]?.name || 'Sprint 1'
      const defaultNode = findIterationBySuffix(allIterations, `\\${team.name}\\${defaultSprintName}`)
      const rootNode = findIterationBySuffix(allIterations, '\\Iteration')
      try {
        if (!teamNode?.path || !defaultNode?.path || !rootNode?.identifier) {
          throw new Error(`Cannot resolve iteration paths for ${team.name}`)
        }
        await adoRequest({
          org,
          pat,
          method: 'PATCH',
          apiPath: `/${encodeURIComponent(project)}/${encodeURIComponent(teamInfo.id)}/_apis/work/teamsettings/teamfieldvalues?api-version=7.1`,
          body: {
            field: {
              referenceName: 'System.AreaPath'
            },
            defaultValue: project,
            values: [
              {
                value: project,
                includeChildren: false
              }
            ]
          }
        })
        await patchTeamSettings({
          org,
          pat,
          project,
          teamId: teamInfo.id,
          backlogIterationPath: rootNode.identifier,
            defaultIterationPath: defaultNode.path.replace(/^\\/, '')
        })
        report.teamSettingsUpdated.push(team.name)
      } catch (err) {
        report.warnings.push(`Team settings update failed for ${team.name}: ${String(err.message || err)}`)
      }

      for (const sprint of setup.sprints) {
        const iterationNode = findIterationBySuffix(allIterations, `\\${team.name}\\${sprint.name}`)
        if (!iterationNode?.identifier) {
          report.warnings.push(`Iteration identifier not found for ${team.name}/${sprint.name}`)
          continue
        }

        try {
          await adoRequest({
            org,
            pat,
            method: 'POST',
            apiPath: `/${encodeURIComponent(project)}/${encodeURIComponent(teamInfo.id)}/_apis/work/teamsettings/iterations?api-version=7.1`,
            body: { id: iterationNode.identifier }
          })
          report.sprintAssignments.push(`${sprint.name} -> ${team.name}`)
        } catch (err) {
          const msg = String(err.message || err)
          if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
            report.sprintAssignments.push(`${sprint.name} -> ${team.name} (already assigned)`)
          } else {
            report.warnings.push(`Sprint assignment failed for ${team.name}/${sprint.name}: ${msg}`)
          }
        }
      }
    }

    for (const email of userEmails) {
      try {
        await inviteUser({ org, pat, email })
        report.usersInvited.push(email)
      } catch (err) {
        report.userInviteErrors.push(`${email}: ${String(err.message || err)}`)
      }
    }

    if (userEmails.length === 0) {
      report.warnings.push('No user emails provided for ADO invitation. Human users and AI agents remain configured in app teams only.')
    }

    return res.status(200).json({ success: true, report })
  } catch (err) {
    return res.status(500).json({ message: 'ADO provisioning failed', error: String(err.message || err) })
  }
}