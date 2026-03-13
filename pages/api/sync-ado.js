import fs from 'fs'
import path from 'path'
import * as azdev from 'azure-devops-node-api'
import { resolveStrictTypeMapping, toTypeSet } from '../../lib/ado/work-item-types'
import { sendAdoError } from './_lib/ado-error'
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
    const { requirements } = req.body || {}
    const config = loadConfig()

    if (!Array.isArray(requirements) || requirements.length === 0) {
      return res.status(400).json({
        error: 'Invalid request body',
        errorCode: 'INVALID_INPUT',
        retryable: false,
        message: 'Provide a non-empty requirements array to sync to ADO.'
      })
    }

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
        const title = String(requirement?.title || '').trim()
        const description = String(requirement?.description || '').trim()
        const acceptanceCriteria = Array.isArray(requirement?.acceptanceCriteria)
          ? requirement.acceptanceCriteria
          : []

        if (!title || !description) {
          results.push({
            title: title || 'Untitled requirement',
            status: 'Failed',
            error: 'Requirement is missing title or description'
          })
          continue
        }

        // Create work item with process-aware type fallback.
        const doc = [
          { op: 'add', path: '/fields/System.Title', value: title },
          { op: 'add', path: '/fields/System.Description', value: description }
        ]

        if (acceptanceCriteria.length > 0) {
          doc.push({
            op: 'add',
            path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
            value: acceptanceCriteria.join('\n')
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
          title,
          workItemId: wi.id,
          url: wi.url,
          status: 'Created'
        })
      } catch (err) {
        results.push({
          title: requirement?.title || 'Untitled requirement',
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
    return sendAdoError(res, err, 'Sync to ADO failed')
  }
}
