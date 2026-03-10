const fs = require('fs')
const path = require('path')

const root = process.cwd()
const outDir = path.join(root, 'public', 'docs')
const outPath = path.join(outDir, 'PROJECT_FULL_DOCUMENTATION.md')

const IGNORE_DIRS = new Set(['.git', '.next', '.vercel', 'node_modules'])

function readText(relPath) {
  const abs = path.join(root, relPath)
  if (!fs.existsSync(abs)) return ''
  return fs.readFileSync(abs, 'utf8')
}

function readJson(relPath, fallback) {
  try {
    const text = readText(relPath)
    if (!text) return fallback
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

function walkFiles(startRelPath) {
  const startAbs = path.join(root, startRelPath)
  if (!fs.existsSync(startAbs)) return []

  const out = []
  function walk(absPath, relBase) {
    const items = fs.readdirSync(absPath, { withFileTypes: true })
    for (const item of items) {
      if (IGNORE_DIRS.has(item.name)) continue
      const absChild = path.join(absPath, item.name)
      const relChild = path.join(relBase, item.name)
      if (item.isDirectory()) {
        walk(absChild, relChild)
      } else {
        out.push(relChild.replace(/\\/g, '/'))
      }
    }
  }

  walk(startAbs, startRelPath)
  return out.sort((a, b) => a.localeCompare(b))
}

function toUiRoute(filePath) {
  let route = filePath
    .replace(/^pages\//, '')
    .replace(/\.js$/, '')
    .replace(/\/index$/, '')
    .replace(/\[(.+?)\]/g, ':$1')

  if (route === 'index') route = ''
  if (route === '_app' || route === '_document' || route === '_error') return null
  if (route.startsWith('api/')) return null
  if (route === '404') return '/404'
  return route ? `/${route}` : '/'
}

function toApiRoute(filePath) {
  const rel = filePath.replace(/^pages\/api\//, '').replace(/\.js$/, '')
  return `/api/${rel}`
}

function findMethods(code) {
  const set = new Set()
  const r1 = /req\.method\s*===\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/g
  const r2 = /req\.method\s*!==\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/g

  for (const re of [r1, r2]) {
    let m = null
    while ((m = re.exec(code)) !== null) {
      set.add(String(m[1]).toUpperCase())
    }
  }

  if (!set.size) set.add('UNKNOWN')
  return Array.from(set)
}

function findActionValues(code) {
  const set = new Set()
  const re = /action\s*===\s*['"`]([^'"`]+)['"`]/g
  let m = null
  while ((m = re.exec(code)) !== null) {
    set.add(String(m[1]))
  }
  return Array.from(set)
}

function inferPurpose(route) {
  const map = {
    '/api/auth/login': 'Login and session cookie issuance',
    '/api/auth/logout': 'Logout and session invalidation',
    '/api/auth/me': 'Resolve current authenticated user',
    '/api/business-request': 'Create/list/update business requests and BRD artifact generation',
    '/api/orchestrator/stage1': 'Run stage 1 demand analysis pipeline',
    '/api/agentic/workflow-action': 'Run demand/BRD workflow actions and approvals',
    '/api/agentic/personas': 'Manage AI personas (admin protected for writes)',
    '/api/agentic/audit-logs': 'Query/export governance audit logs',
    '/api/orchestrator/events-stream': 'Stream or poll orchestrator events',
    '/api/agentic/evaluation': 'Capture and read thesis evaluation metrics',
    '/api/agentic/chapter4-evidence': 'Export chapter 4 evidence (JSON/CSV)',
    '/api/upload': 'Upload PDF/DOCX/DOC files to public uploads',
    '/api/parse-thesis': 'Parse latest thesis and extract research/evaluation signals',
    '/api/parse-brd': 'Parse BRD document into structured fields',
    '/api/team-setup': 'Read/seed/update team and sprint setup',
    '/api/ado-config': 'Save/read Azure DevOps configuration',
    '/api/ado-provision': 'Provision Azure DevOps project/team setup',
    '/api/sync-ado': 'Sync parsed requirements to Azure DevOps work items',
    '/api/create-ado-backlog': 'Create backlog items from business request context',
    '/api/ado-sync-site-users': 'Synchronize site users with ADO identity mapping',
    '/api/ado-team-admin-fix': 'Repair ADO team admin assignments',
    '/api/session-identity': 'Set/read runtime actor identity for audit traceability',
    '/api/docs/[doc]': 'Backward-compatible redirect to static markdown docs',
    '/api/admin/cleanup-site': 'Administrative site data cleanup',
    '/api/admin/cleanup-ado': 'Administrative ADO cleanup routines',
    '/api/scrum-master': 'AI scrum assistant endpoint'
  }
  return map[route] || 'See source file for implementation-specific behavior'
}

function parseTablesFromSchema(code) {
  const tables = []
  const re = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)\s*\(([^;]+?)\)\s*`/gms
  let m = null
  while ((m = re.exec(code)) !== null) {
    const name = m[1]
    const block = m[2]
    const cols = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith(')'))
      .map((line) => line.replace(/,$/, ''))
    tables.push({ name, columns: cols })
  }
  return tables
}

function buildMarkdown() {
  const generatedAt = new Date().toISOString()

  const personas = readJson('data/agentic/personas.json', [])
  const users = readJson('data/auth-users.json', [])
  const teamsSetup = readJson('data/team-setup.json', { teams: [], sprints: [] })

  const pageFiles = walkFiles('pages').filter((f) => f.endsWith('.js'))
  const uiRoutes = pageFiles.map(toUiRoute).filter(Boolean)
  const apiFiles = pageFiles.filter((f) => f.startsWith('pages/api/'))
  const internalApiModules = apiFiles.filter((f) => f.startsWith('pages/api/_lib/'))
  const publicApiFiles = apiFiles.filter((f) => !f.startsWith('pages/api/_lib/'))

  const apiCatalog = publicApiFiles.map((file) => {
    const route = toApiRoute(file)
    const code = readText(file)
    const methods = findMethods(code)
    const actions = findActionValues(code)
    return {
      file,
      route,
      methods,
      actions,
      purpose: inferPurpose(route),
      adminGuard: code.includes('requireAdmin('),
      authAware: code.includes('getSessionFromRequest(') || code.includes('resolveActorFromRequest('),
      usesAdo: code.includes('azure-devops-node-api'),
      usesOllama: code.includes('OLLAMA') || code.includes('/api/generate')
    }
  }).sort((a, b) => a.route.localeCompare(b.route))

  const requestsDbCode = readText('pages/api/_lib/requests-db.js')
  const tables = parseTablesFromSchema(requestsDbCode)

  const workflowActions = (() => {
    const code = readText('pages/api/agentic/workflow-action.js')
    return findActionValues(code)
  })()

  const stageTransitions = [
    'Business Request created (Pending) -> Business Approval decision (Approved/Rejected)',
    'Approved -> generate-demand -> Demand Generated -> Pending Brain Review',
    'review-demand approve -> BRD Drafting',
    'review-demand reject -> Demand Rework',
    'generate-brd -> BRD Draft Generated -> Pending Brain Review',
    'submit-brd -> Submitted by BA -> Pending Brain Review',
    'review-brd approve -> Ready for Epic Scoping',
    'review-brd reject -> BRD Rework',
    'Stage 1 endpoint can run only when BR status is Approved',
    'Evaluation captures metrics independently for thesis evidence and Chapter 4 exports'
  ]

  const lines = []
  lines.push('# Project Full Documentation (Exhaustive)')
  lines.push('')
  lines.push(`Generated At: ${generatedAt}`)
  lines.push(`Repository Root: ${root}`)
  lines.push('')
  lines.push('## 1) Scope and Intent')
  lines.push('- This is the canonical, exhaustive project documentation generated from source code and configuration files.')
  lines.push('- It includes every discovered UI route, API route, workflow action, persona, role, and core data table.')
  lines.push('- It is intended for operations, governance, development handover, and thesis evidence traceability.')
  lines.push('')
  lines.push('## 2) Personas (AI Agents)')
  if (Array.isArray(personas) && personas.length) {
    for (const p of personas) {
      lines.push(`- Key: ${p.key} | Name: ${p.name} | Title: ${p.personaTitle} | Model: ${p.model} | Active: ${p.active !== false}`)
      lines.push(`  - Description: ${p.description || 'N/A'}`)
    }
  } else {
    lines.push('- No personas found in data/agentic/personas.json')
  }
  lines.push('')
  lines.push('## 3) Human Roles and Access Identities')
  if (Array.isArray(users) && users.length) {
    for (const u of users) {
      lines.push(`- Username: ${u.username} | Role: ${u.role} | Display Name: ${u.name}`)
    }
  } else {
    lines.push('- No auth users found in data/auth-users.json')
  }
  lines.push('- Session identity API allows runtime actor attribution for audit trails.')
  lines.push('')
  lines.push('## 4) Team and Sprint Operating Model')
  lines.push(`- Teams configured: ${Array.isArray(teamsSetup.teams) ? teamsSetup.teams.length : 0}`)
  lines.push(`- Sprints configured: ${Array.isArray(teamsSetup.sprints) ? teamsSetup.sprints.length : 0}`)
  for (const team of teamsSetup.teams || []) {
    lines.push(`- Team: ${team.name} (${team.region || 'N/A'}) | Members: ${(team.members || []).length}`)
  }
  for (const sprint of teamsSetup.sprints || []) {
    lines.push(`- Sprint: ${sprint.name} | ${sprint.startDate || 'N/A'} -> ${sprint.endDate || 'N/A'} | Status: ${sprint.status || 'N/A'}`)
  }
  lines.push('')
  lines.push('## 5) End-to-End Workflow and Process Transitions')
  for (const s of stageTransitions) {
    lines.push(`- ${s}`)
  }
  lines.push('')
  lines.push('### Workflow Action API Commands')
  if (workflowActions.length) {
    for (const action of workflowActions) {
      lines.push(`- ${action}`)
    }
  } else {
    lines.push('- No explicit action values found.')
  }
  lines.push('')
  lines.push('## 6) UI Route Inventory (All Pages)')
  for (const route of uiRoutes.sort((a, b) => a.localeCompare(b))) {
    lines.push(`- ${route}`)
  }
  lines.push('')
  lines.push('## 7) API Inventory (All Endpoints)')
  for (const api of apiCatalog) {
    lines.push(`- Route: ${api.route}`)
    lines.push(`  - File: ${api.file}`)
    lines.push(`  - Methods: ${api.methods.join(', ')}`)
    lines.push(`  - Purpose: ${api.purpose}`)
    lines.push(`  - Admin Guard: ${api.adminGuard}`)
    lines.push(`  - Auth-Aware Actor Resolution: ${api.authAware}`)
    lines.push(`  - Uses Azure DevOps API: ${api.usesAdo}`)
    lines.push(`  - Uses OLLAMA/LLM Generation: ${api.usesOllama}`)
    if (api.actions.length) {
      lines.push(`  - Action Values: ${api.actions.join(', ')}`)
    }
  }
  lines.push('')
  lines.push('### Internal API Library Modules')
  for (const file of internalApiModules.sort((a, b) => a.localeCompare(b))) {
    lines.push(`- ${file}`)
  }
  lines.push('')
  lines.push('## 8) Data Model and Persistence')
  for (const t of tables) {
    lines.push(`- Table: ${t.name}`)
    for (const c of t.columns) {
      lines.push(`  - ${c}`)
    }
  }
  lines.push('- Additional JSON persistence files are used for personas, users, sessions (legacy/local), and team setup.')
  lines.push('')
  lines.push('## 9) Governance, Audit, and Evidence')
  lines.push('- Every important workflow action can emit orchestrator events and audit logs with actor/time metadata.')
  lines.push('- Audit export endpoint supports CSV extraction for governance/compliance evidence.')
  lines.push('- Thesis evaluation endpoint captures TAM and operational metrics and supports Chapter 4 CSV/JSON exports.')
  lines.push('')
  lines.push('## 10) Document and Thesis Processing Flows')
  lines.push('- Upload API accepts PDF/DOCX/DOC and stores files in public/uploads with safe filenames.')
  lines.push('- Thesis parser supports PDF and DOCX, extracts abstract/TOC/chapters and research/evaluation signals.')
  lines.push('- BRD parser extracts requirement data from uploaded BRD documents.')
  lines.push('- Business request API can generate standardized BRD DOCX artifacts for approved demand paths.')
  lines.push('')
  lines.push('## 11) Integrations and Delivery')
  lines.push('- Azure DevOps integration spans configuration, provisioning, backlog/work item sync, and admin repair utilities.')
  lines.push('- Web app is deployed on Vercel; mobile wrapper uses Expo/EAS configuration under mobile/.')
  lines.push('- Static docs and downloadable artifacts are served from public/docs and public/downloads.')
  lines.push('')
  lines.push('## 12) Completeness Checklist (Generated)')
  lines.push(`- UI routes documented: ${uiRoutes.length}`)
  lines.push(`- API endpoints documented: ${apiCatalog.length}`)
  lines.push(`- Internal API modules documented: ${internalApiModules.length}`)
  lines.push(`- Personas documented: ${(personas || []).length}`)
  lines.push(`- Auth users documented: ${(users || []).length}`)
  lines.push(`- DB tables documented: ${tables.length}`)
  lines.push('- Note: This file is generated from source to reduce omission risk. Re-run after code changes.')
  lines.push('')

  return lines.join('\n')
}

function main() {
  const markdown = buildMarkdown()
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outPath, markdown, 'utf8')
  console.log(`FULL_DOC_GENERATED=${outPath}`)
}

main()
