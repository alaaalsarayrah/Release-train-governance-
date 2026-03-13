import fs from 'fs'
import path from 'path'

const configPath = path.join(process.cwd(), 'public', '.ado-config.json')

function loadConfig() {
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(data)
  }
  return { organization: '', project: '', pat: '', defaultAssignedTo: '' }
}

function saveConfig(config) {
  // Ensure .ado-config is not accidentally served
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export default function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const config = loadConfig()
      // Don't return the PAT in response
      return res.status(200).json({
        organization: config.organization,
        project: config.project,
        defaultAssignedTo: config.defaultAssignedTo || '',
        isPATSet: !!config.pat
      })
    }

    if (req.method === 'POST') {
      const { organization, project, pat, defaultAssignedTo } = req.body
      if (!organization || !project || !pat) {
        return res.status(400).json({ message: 'Missing organization, project, or PAT' })
      }
      saveConfig({
        organization,
        project,
        pat,
        defaultAssignedTo: String(defaultAssignedTo || '').trim()
      })
      return res.status(200).json({ message: 'ADO config saved' })
    }

    res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    console.error('ADO config error', err)
    res.status(500).json({ message: 'Config operation failed', error: String(err) })
  }
}
