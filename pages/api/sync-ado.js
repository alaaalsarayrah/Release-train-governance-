import fs from 'fs'
import path from 'path'
import * as azdev from 'azure-devops-node-api'
import { WorkItemTrackingApi } from 'azure-devops-node-api'

const configPath = path.join(process.cwd(), 'public', '.ado-config.json')

function loadConfig() {
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(data)
  }
  return {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { requirements } = req.body
    const config = loadConfig()

    if (!config.organization || !config.project || !config.pat) {
      return res.status(400).json({ message: 'ADO not configured. Set config first.' })
    }

    // Connect to ADO
    const authHandler = azdev.getPersonalAccessTokenHandler(config.pat)
    const connection = new azdev.WebApi(`https://dev.azure.com/${config.organization}`, authHandler)

    const witApi = await connection.getWorkItemTrackingApi()

    const results = []
    for (const requirement of requirements) {
      try {
        // Create work item (User Story)
        const doc = [
          { op: 'add', path: '/fields/System.Title', value: requirement.title },
          { op: 'add', path: '/fields/System.Description', value: requirement.description },
          { op: 'add', path: '/fields/System.WorkItemType', value: 'User Story' },
          { op: 'add', path: '/fields/System.AssignedTo', value: '' }
        ]

        if (requirement.acceptanceCriteria.length > 0) {
          doc.push({
            op: 'add',
            path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
            value: requirement.acceptanceCriteria.join('\n')
          })
        }

        const wi = await witApi.createWorkItem(
          null,
          doc,
          config.project,
          'User Story'
        )

        results.push({
          title: requirement.title,
          workItemId: wi.id,
          url: wi.url,
          status: 'Created'
        })
      } catch (err) {
        results.push({
          title: requirement.title,
          status: 'Failed',
          error: String(err)
        })
      }
    }

    res.status(200).json({ results, created: results.filter(r => r.status === 'Created').length })
  } catch (err) {
    console.error('ADO sync error', err)
    res.status(500).json({ message: 'Sync to ADO failed', error: String(err) })
  }
}
