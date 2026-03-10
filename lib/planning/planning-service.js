import fs from 'fs'
import path from 'path'
import * as azdev from 'azure-devops-node-api'

const backlogPath = path.join(process.cwd(), 'data', 'agentic', 'planning-backlog.json')
const adoConfigPath = path.join(process.cwd(), 'public', '.ado-config.json')

function loadAdoConfig() {
  try {
    if (!fs.existsSync(adoConfigPath)) return null
    return JSON.parse(fs.readFileSync(adoConfigPath, 'utf-8'))
  } catch {
    return null
  }
}

export function loadLocalBacklog() {
  try {
    if (!fs.existsSync(backlogPath)) return []
    const parsed = JSON.parse(fs.readFileSync(backlogPath, 'utf-8'))
    return Array.isArray(parsed?.items) ? parsed.items : []
  } catch {
    return []
  }
}

export async function loadAdoBacklog({ top = 50 } = {}) {
  const config = loadAdoConfig()
  if (!config?.organization || !config?.project || !config?.pat) {
    return {
      source: 'ado',
      items: [],
      warning: 'ADO config not set. Using local backlog is recommended for demo mode.'
    }
  }

  try {
    const authHandler = azdev.getPersonalAccessTokenHandler(config.pat)
    const connection = new azdev.WebApi(`https://dev.azure.com/${config.organization}`, authHandler)
    const witApi = await connection.getWorkItemTrackingApi()

    const wiql = {
      query: `SELECT [System.Id], [System.Title], [System.WorkItemType], [Microsoft.VSTS.Common.Priority]
              FROM WorkItems
              WHERE [System.TeamProject] = '${config.project.replace(/'/g, "''")}'
              AND [System.WorkItemType] IN ('User Story', 'Product Backlog Item', 'Task')
              ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC`
    }

    const wiqlResult = await witApi.queryByWiql(wiql, config.project)
    const ids = (wiqlResult?.workItems || []).map((w) => w.id).filter(Boolean).slice(0, Math.max(1, Math.min(Number(top) || 50, 200)))

    if (!ids.length) {
      return { source: 'ado', items: [] }
    }

    const details = await witApi.getWorkItems(ids, [
      'System.Id',
      'System.Title',
      'System.Description',
      'System.WorkItemType',
      'Microsoft.VSTS.Common.Priority'
    ])

    const items = (details || []).map((item) => ({
      id: `ADO-${item.id}`,
      adoId: item.id,
      title: item.fields?.['System.Title'] || `Work Item ${item.id}`,
      description: item.fields?.['System.Description'] || '',
      type: item.fields?.['System.WorkItemType'] || 'Backlog Item',
      priority: item.fields?.['Microsoft.VSTS.Common.Priority'] || 'N/A',
      source: 'ado'
    }))

    return { source: 'ado', items }
  } catch (err) {
    return {
      source: 'ado',
      items: [],
      warning: `Failed to read ADO backlog: ${String(err?.message || err)}`
    }
  }
}

export async function loadPlanningBacklog({ source = 'local', top = 50 } = {}) {
  if (String(source).toLowerCase() === 'ado') {
    return loadAdoBacklog({ top })
  }

  return {
    source: 'local',
    items: loadLocalBacklog().slice(0, Math.max(1, Math.min(Number(top) || 50, 200)))
  }
}
