import fs from 'fs'
import path from 'path'
import * as azdev from 'azure-devops-node-api'
import { resolveStrictTypeMapping, toTypeSet } from '../../lib/ado/work-item-types'
import { sendAdoError } from './_lib/ado-error'

const configPath = path.join(process.cwd(), 'public', '.ado-config.json')

function loadConfig() {
  if (!fs.existsSync(configPath)) return {}
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const config = loadConfig()
    if (!config.organization || !config.project || !config.pat) {
      return res.status(400).json({ message: 'ADO not configured. Configure organization, project, and PAT first.' })
    }

    const authHandler = azdev.getPersonalAccessTokenHandler(config.pat)
    const connection = new azdev.WebApi(`https://dev.azure.com/${config.organization}`, authHandler)
    const witApi = await connection.getWorkItemTrackingApi()

    const supportedTypes = toTypeSet(await witApi.getWorkItemTypes(config.project))
    const mappingInfo = resolveStrictTypeMapping(supportedTypes)

    return res.status(200).json({
      organization: config.organization,
      project: config.project,
      processHint: mappingInfo.processHint,
      typeMapping: mappingInfo.typeMapping,
      guardrails: mappingInfo.warnings,
      supportedTypes: Array.from(supportedTypes.values()).sort(),
      generatedAt: new Date().toISOString()
    })
  } catch (err) {
    return sendAdoError(res, err, 'Failed to inspect ADO work item types')
  }
}
