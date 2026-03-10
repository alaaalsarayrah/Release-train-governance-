import fs from 'fs'
import path from 'path'
import * as azdev from 'azure-devops-node-api'
import { resolveStrictTypeMapping, toTypeSet } from '../../lib/ado/work-item-types'
import {
  appendAssignedToPatch,
  isAssigneeError,
  removeAssignedToPatch,
  resolveAssigneeForAdo
} from '../../lib/ado/assignment'

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

    const supportedTypes = toTypeSet(await witApi.getWorkItemTypes(config.project))
    const mappingInfo = resolveStrictTypeMapping(supportedTypes)
    const storyType = mappingInfo.typeMapping.storyType
    const assignedTo = await resolveAssigneeForAdo({ config })

    const results = []
    for (const requirement of requirements) {
      try {
        // Create work item with process-aware type fallback.
        const doc = [
          { op: 'add', path: '/fields/System.Title', value: requirement.title },
          { op: 'add', path: '/fields/System.Description', value: requirement.description }
        ]

        if (requirement.acceptanceCriteria.length > 0) {
          doc.push({
            op: 'add',
            path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
            value: requirement.acceptanceCriteria.join('\n')
          })
        }

        const docWithAssignment = appendAssignedToPatch(doc, assignedTo)

        let wi = null
        try {
          wi = await witApi.createWorkItem(
            null,
            docWithAssignment,
            config.project,
            storyType
          )
        } catch (err) {
          if (!isAssigneeError(err) || !assignedTo) throw err

          wi = await witApi.createWorkItem(
            null,
            removeAssignedToPatch(docWithAssignment),
            config.project,
            storyType
          )
        }

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

    res.status(200).json({
      results,
      created: results.filter((r) => r.status === 'Created').length,
      assignedTo: assignedTo || null,
      workItemType: storyType,
      processHint: mappingInfo.processHint,
      guardrails: mappingInfo.warnings
    })
  } catch (err) {
    console.error('ADO sync error', err)
    res.status(500).json({ message: 'Sync to ADO failed', error: String(err) })
  }
}
