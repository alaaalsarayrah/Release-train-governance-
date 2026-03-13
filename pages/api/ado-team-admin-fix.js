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

async function rawAdoRequest({ org, pat, method = 'GET', pathWithQuery, body }) {
  const url = `https://dev.azure.com/${org}${pathWithQuery}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(pat),
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

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    json,
    message: json?.message || json?.raw || `${res.status} ${res.statusText}`
  }
}

function flatten(node, out = []) {
  if (!node) return out
  out.push(node)
  for (const child of node.children || []) flatten(child, out)
  return out
}

function findNodeByTeamSprint(nodes, project, teamName, sprintName) {
  const candidates = [
    `\\${project}\\Iteration\\${teamName}\\${sprintName}`.toLowerCase(),
    `\\${project}\\${teamName}\\${sprintName}`.toLowerCase()
  ]
  return nodes.find((n) => {
    const p = String(n.path || '').toLowerCase()
    return candidates.some((c) => p === c || p.endsWith(c.replace(`\\${project}`, '')))
  }) || null
}

function findNodeByTeamRoot(nodes, project, teamName) {
  const candidates = [
    `\\${project}\\Iteration\\${teamName}`.toLowerCase(),
    `\\${project}\\${teamName}`.toLowerCase()
  ]
  return nodes.find((n) => {
    const p = String(n.path || '').toLowerCase()
    return candidates.some((c) => p === c || p.endsWith(c.replace(`\\${project}`, '')))
  }) || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const ado = loadJson(adoConfigPath)
    const setup = loadJson(teamSetupPath)

    if (!ado?.organization || !ado?.project || !ado?.pat) {
      return res.status(400).json({ message: 'ADO is not configured' })
    }
    if (!setup?.teams?.length || !setup?.sprints?.length) {
      return res.status(400).json({ message: 'Team setup not initialized yet' })
    }

    const org = ado.organization
    const project = ado.project
    const pat = ado.pat

    const report = {
      project,
      teamSettings: [],
      sprintAssignments: [],
      diagnostics: []
    }

    const teamsResp = await rawAdoRequest({
      org,
      pat,
      pathWithQuery: `/_apis/projects/${encodeURIComponent(project)}/teams?api-version=7.1-preview.3`
    })
    if (!teamsResp.ok) {
      return res.status(500).json({ message: 'Failed to load ADO teams', detail: teamsResp.message })
    }
    const teamByName = new Map((teamsResp.json?.value || []).map((t) => [t.name, t]))

    const itResp = await rawAdoRequest({
      org,
      pat,
      pathWithQuery: `/${encodeURIComponent(project)}/_apis/wit/classificationnodes/Iterations?$depth=7&api-version=7.1`
    })
    if (!itResp.ok) {
      return res.status(500).json({ message: 'Failed to load iterations', detail: itResp.message })
    }
    const nodes = flatten(itResp.json)

    const defaultSprint = setup.sprints[0]?.name || 'Sprint 1'
    const rootIteration = nodes.find((n) => {
      const p = String(n.path || '').toLowerCase()
      return p === `\\${project}\\iteration`.toLowerCase() || p === `\\${project}`.toLowerCase()
    })

    for (const team of setup.teams) {
      const adoTeam = teamByName.get(team.name)
      if (!adoTeam?.id) {
        report.diagnostics.push({ team: team.name, step: 'lookup', ok: false, message: 'Team not found in ADO' })
        continue
      }

      const teamRoot = findNodeByTeamRoot(nodes, project, team.name)
      const teamDefault = findNodeByTeamSprint(nodes, project, team.name, defaultSprint)

      if (!teamRoot?.path || !teamDefault?.path || !rootIteration?.identifier) {
        report.diagnostics.push({
          team: team.name,
          step: 'iteration-path-resolve',
          ok: false,
          message: `Missing required iteration nodes (${team.name}/${defaultSprint})`
        })
        continue
      }

      const settingsResp = await rawAdoRequest({
        org,
        pat,
        method: 'PATCH',
        pathWithQuery: `/${encodeURIComponent(project)}/${encodeURIComponent(adoTeam.id)}/_apis/work/teamsettings?api-version=7.1`,
        body: {
          backlogIteration: rootIteration.identifier
        }
      })

      const fieldResp = await rawAdoRequest({
        org,
        pat,
        method: 'PATCH',
        pathWithQuery: `/${encodeURIComponent(project)}/${encodeURIComponent(adoTeam.id)}/_apis/work/teamsettings/teamfieldvalues?api-version=7.1`,
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

      report.teamSettings.push({
        team: team.name,
        ok: settingsResp.ok && fieldResp.ok,
        status: settingsResp.status,
        message: `${settingsResp.message}; teamFieldValues=${fieldResp.status} ${fieldResp.message}`
      })

      for (const sprint of setup.sprints) {
        const sprintNode = findNodeByTeamSprint(nodes, project, team.name, sprint.name)
        if (!sprintNode?.identifier) {
          report.sprintAssignments.push({
            team: team.name,
            sprint: sprint.name,
            ok: false,
            status: 0,
            message: 'Iteration identifier missing'
          })
          continue
        }

        const assignResp = await rawAdoRequest({
          org,
          pat,
          method: 'POST',
          pathWithQuery: `/${encodeURIComponent(project)}/${encodeURIComponent(adoTeam.id)}/_apis/work/teamsettings/iterations?api-version=7.1`,
          body: { id: sprintNode.identifier }
        })

        report.sprintAssignments.push({
          team: team.name,
          sprint: sprint.name,
          ok: assignResp.ok,
          status: assignResp.status,
          message: assignResp.message
        })
      }
    }

    return res.status(200).json({ success: true, report })
  } catch (err) {
    return res.status(500).json({ message: 'ADO admin fix failed', error: String(err.message || err) })
  }
}