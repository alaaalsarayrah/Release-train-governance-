import fs from 'fs'
import path from 'path'
import * as azdev from 'azure-devops-node-api'
import {
  addAuditLog,
  addOrchestratorEvent,
  dbGet,
  updateBusinessRequestFields,
  withDb
} from '../_lib/requests-db'
import { resolveActorFromRequest } from '../_lib/session-identity'
import {
  appendAssignedToPatch,
  isAssigneeError,
  removeAssignedToPatch,
  resolveAssigneeForAdo
} from '../../../lib/ado/assignment'

const personaPath = path.join(process.cwd(), 'data', 'agentic', 'personas.json')
const adoConfigPath = path.join(process.cwd(), 'public', '.ado-config.json')

function nowIso() {
  return new Date().toISOString()
}

function formatError(err) {
  return String(err?.message || err)
}

async function withTimeout(promiseFactory, timeoutMs, label) {
  let timeoutHandle = null
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promiseFactory(), timeoutPromise])
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}

function loadPersonas() {
  if (!fs.existsSync(personaPath)) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(personaPath, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getPersona(personas, key) {
  return personas.find((p) => p.key === key) || null
}

function loadAdoConfig() {
  if (!fs.existsSync(adoConfigPath)) return null
  try {
    return JSON.parse(fs.readFileSync(adoConfigPath, 'utf-8'))
  } catch {
    return null
  }
}

async function updateBr(id, fields) {
  await withDb(async (db) => {
    await updateBusinessRequestFields(db, id, fields)
  })
}

function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    // continue
  }

  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) {
    const candidate = trimmed.slice(first, last + 1)
    try {
      return JSON.parse(candidate)
    } catch {
      return null
    }
  }

  return null
}

function unique(items) {
  return [...new Set(Array.isArray(items) ? items : [])].filter(Boolean)
}

async function getOllamaModels(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) return []
    const json = await response.json()
    const models = Array.isArray(json?.models) ? json.models : []
    return unique(models.map((m) => m.name || m.model).filter(Boolean))
  } catch {
    return []
  }
}

function buildDemandFallback(br) {
  return {
    demandSummary: `Demand package for ${br.id}`,
    businessProblem: br.description || 'Business request requires analysis',
    scope: [
      `Analyze request for ${br.unit || 'business unit'}`,
      'Define delivery scope and phased milestones',
      'Prepare cost and risk baseline'
    ],
    budgetEstimate: br.urgency === 'High' ? '100k - 180k' : '50k - 120k',
    timelineEstimate: br.urgency === 'High' ? '8-12 weeks' : '10-16 weeks',
    risks: [
      'Ambiguous requirement details',
      'Cross-team dependency delays',
      'Integration and data quality constraints'
    ],
    successMetrics: [
      'Approved BRD with traceability',
      'Delivery milestones met within baseline variance',
      'Stakeholder signoff for go-live readiness'
    ]
  }
}

function buildBrdFallback(br, demandOutput) {
  const scope = Array.isArray(demandOutput?.scope) ? demandOutput.scope : []
  const successMetrics = Array.isArray(demandOutput?.successMetrics) ? demandOutput.successMetrics : []
  const risks = Array.isArray(demandOutput?.risks) ? demandOutput.risks : []

  const functionalRequirements = scope.length
    ? scope.map((item, idx) => ({
      id: `FR-${String(idx + 1).padStart(3, '0')}`,
      title: `Functional Requirement ${idx + 1}`,
      description: String(item),
      priority: idx < 2 ? 'High' : 'Medium',
      rationale: 'Derived from approved demand scope',
      acceptanceCriteria: [`System supports: ${String(item)}`]
    }))
    : [
      {
        id: 'FR-001',
        title: 'Workflow Lifecycle Management',
        description: 'System shall manage business request, demand, and BRD lifecycle states with approvals.',
        priority: 'High',
        rationale: 'Core delivery capability',
        acceptanceCriteria: ['Lifecycle transitions are persisted and visible in dashboard']
      },
      {
        id: 'FR-002',
        title: 'Brain Review Loop',
        description: 'System shall support approve/reject decisions with comments for demand and BRD.',
        priority: 'High',
        rationale: 'Governance and quality gate',
        acceptanceCriteria: ['Review decisions include actor, reason, and timestamp']
      }
    ]

  return {
    title: `BRD - ${br.id}`,
    documentControl: {
      version: '1.0',
      status: 'Draft',
      preparedBy: 'Agentic AI_Requirement',
      preparedOn: nowIso(),
      reviewedBy: 'Agentic AI_Orcastration'
    },
    executiveSummary: demandOutput?.demandSummary || br.description || 'Business requirements baseline generated from approved demand.',
    businessProblem: demandOutput?.businessProblem || br.description || 'Need to improve SDLC workflow governance and delivery predictability.',
    businessObjectives: successMetrics.length ? successMetrics : [
      'Establish clear and testable business requirements',
      'Reduce delivery risk through approval gates',
      'Improve traceability from demand to implementation'
    ],
    inScope: scope.length ? scope : [
      'Business request to BRD lifecycle orchestration',
      'Approval workflow with actor and timestamp audit',
      'Operational visibility through dashboard and audit trail'
    ],
    outOfScope: [
      'Legacy system rewrite unrelated to BR scope',
      'Enterprise-wide data migration activities',
      'Production support model redesign'
    ],
    stakeholders: [
      { role: 'Business Owner', responsibility: 'Defines expected outcomes and prioritization' },
      { role: 'Business Analyst', responsibility: 'Drafts and refines BRD content' },
      { role: 'Brain Orchestrator', responsibility: 'Reviews and approves key stage outputs' },
      { role: 'Delivery Team', responsibility: 'Implements approved requirements' }
    ],
    functionalRequirements,
    nonFunctionalRequirements: [
      { id: 'NFR-001', category: 'Auditability', requirement: 'All lifecycle transitions must be logged with actor and timestamp.' },
      { id: 'NFR-002', category: 'Availability', requirement: 'Workflow dashboard must remain available during business hours with graceful degradation.' },
      { id: 'NFR-003', category: 'Security', requirement: 'Only authorized users can approve, reject, or modify BRD lifecycle states.' },
      { id: 'NFR-004', category: 'Performance', requirement: 'Key workflow actions should complete within agreed operational SLAs.' }
    ],
    dataRequirements: [
      'Persist BR metadata, demand outputs, and BRD version history',
      'Store review comments with decision timestamps',
      'Support exportable audit records for compliance reporting'
    ],
    integrationRequirements: [
      'Azure DevOps work item synchronization for stage checkpoints',
      'LLM service integration for demand/BRD draft generation',
      'Document upload/storage integration for BRD artifacts'
    ],
    reportingAndAnalytics: [
      'Status distribution by workflow stage',
      'Approval/rejection trend over time',
      'Action-level audit export for governance reviews'
    ],
    assumptions: [
      'Required external services are reachable during execution windows',
      'Stakeholders provide timely review feedback',
      'Team members have role-appropriate access permissions'
    ],
    constraints: [
      'Delivery timeline is influenced by review turnaround time',
      'Dependency systems may impose API throughput limits',
      'Budget allocations may constrain scope expansion'
    ],
    risks: risks.length ? risks : [
      'Requirement ambiguity causes rework',
      'Dependency delays impact milestone commitments',
      'Integration failures require fallback execution paths'
    ],
    dependencies: [
      'Availability of Azure DevOps project configuration',
      'Operational health of configured LLM model endpoints',
      'Access to document storage path for BRD artifacts'
    ],
    acceptanceCriteria: [
      'All high-priority functional requirements are validated in UAT',
      'Brain review decisions are fully traceable in audit logs',
      'Approved BRD artifact is available as a Word document for handover'
    ],
    traceabilityMatrix: functionalRequirements.map((fr) => ({
      businessObjective: 'Controlled and auditable SDLC execution',
      requirementId: fr.id,
      verificationMethod: 'UAT and workflow audit verification'
    })),
    uatScenarios: [
      { id: 'UAT-001', scenario: 'Create BR and validate auto progression to approved BRD', expectedResult: 'Workflow reaches Ready for Epic Scoping with approved BRD' },
      { id: 'UAT-002', scenario: 'Reject and resubmit BRD flow', expectedResult: 'Version increments and final approved state is achieved' }
    ],
    implementationPlan: {
      phases: [
        { name: 'Phase 1 - Foundation', deliverables: ['Persona configuration', 'Workflow APIs', 'Audit capture'] },
        { name: 'Phase 2 - BRD Standardization', deliverables: ['Detailed BRD schema', 'Word artifact generation', 'Review traceability'] },
        { name: 'Phase 3 - Operational Readiness', deliverables: ['Validation runbook', 'Monitoring hooks', 'Handover package'] }
      ]
    },
    signOff: [
      { role: 'Business Owner', status: 'Pending' },
      { role: 'Brain Orchestrator', status: 'Approved' },
      { role: 'Program Manager', status: 'Pending' }
    ]
  }
}

async function runOllama({ model, prompt, fallbackFactory = null }) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  const modelTimeoutMs = Number(process.env.OLLAMA_MODEL_TIMEOUT_MS || 45000)
  const maxModelAttempts = Number(process.env.OLLAMA_MAX_MODEL_ATTEMPTS || 3)
  const available = await getOllamaModels(baseUrl)
  const envFallbacks = String(process.env.OLLAMA_MODEL_FALLBACKS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  const preferredCandidates = unique([
    model,
    process.env.OLLAMA_MODEL,
    ...envFallbacks,
    'qwen3:4b',
    'qwen3:8b',
    'llama3.1',
    'llama3'
  ])

  const candidates = available.length > 0
    ? unique([...preferredCandidates.filter((x) => available.includes(x)), ...available])
    : preferredCandidates

  let lastError = ''
  for (const candidateModel of candidates.slice(0, maxModelAttempts)) {
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), modelTimeoutMs)

    let response = null
    try {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: candidateModel,
          prompt,
          stream: false,
          options: { temperature: 0.2 }
        }),
        signal: controller.signal
      })
    } catch (err) {
      const isTimeout = err && err.name === 'AbortError'
      lastError = isTimeout
        ? `Timed out after ${modelTimeoutMs}ms for model ${candidateModel}`
        : String(err?.message || err)
      clearTimeout(timeoutHandle)
      continue
    }

    clearTimeout(timeoutHandle)

    const text = await response.text()
    let parsed = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = null
    }

    if (!response.ok) {
      lastError = parsed?.error || parsed?.message || text || `OLLAMA error (${response.status})`
      continue
    }

    if (!parsed?.response) {
      lastError = 'OLLAMA did not return a response body'
      continue
    }

    return {
      text: parsed.response,
      modelUsed: candidateModel,
      source: 'ollama',
      warning: null
    }
  }

  if (fallbackFactory) {
    return {
      text: JSON.stringify(fallbackFactory(), null, 2),
      modelUsed: 'template-fallback',
      source: 'fallback-template',
      warning: lastError || 'No working OLLAMA model found'
    }
  }

  throw new Error(lastError || 'OLLAMA generation failed')
}

async function syncStageToAdo({ brId, stageName, title, description, tags }) {
  const config = loadAdoConfig()
  const adoTimeoutMs = Number(process.env.ADO_TIMEOUT_MS || 15000)
  if (!config?.organization || !config?.project || !config?.pat) {
    return { skipped: true, reason: 'ADO is not configured' }
  }

  let witApi = null
  try {
    const authHandler = azdev.getPersonalAccessTokenHandler(config.pat)
    const connection = new azdev.WebApi(`https://dev.azure.com/${config.organization}`, authHandler)
    witApi = await withTimeout(
      () => connection.getWorkItemTrackingApi(),
      adoTimeoutMs,
      'ADO API connection'
    )
  } catch (err) {
    return {
      skipped: true,
      reason: `ADO unavailable: ${formatError(err)}`
    }
  }

  const patch = [
    { op: 'add', path: '/fields/System.Title', value: `[Stage Checkpoint][${stageName}] ${brId} - ${title}` },
    { op: 'add', path: '/fields/System.Description', value: description },
    { op: 'add', path: '/fields/System.Tags', value: tags || `Agentic;StageCheckpoint;${stageName}` }
  ]
  const assignedTo = await resolveAssigneeForAdo({ config })
  const patchWithAssignee = appendAssignedToPatch(patch, assignedTo)
  const patchWithoutAssignee = removeAssignedToPatch(patchWithAssignee)

  let checkpointType = 'Task'
  try {
    const types = await withTimeout(
      () => witApi.getWorkItemTypes(config.project),
      adoTimeoutMs,
      'ADO work item type lookup'
    )
    const available = new Set((types || []).map((x) => String(x?.name || '').trim()))
    checkpointType = available.has('Issue') ? 'Issue' : (available.has('Task') ? 'Task' : 'User Story')
  } catch {
    checkpointType = 'Task'
  }

  try {
    const item = await withTimeout(
      () => witApi.createWorkItem(null, patchWithAssignee, config.project, checkpointType),
      adoTimeoutMs,
      `ADO ${checkpointType} creation`
    )
    return {
      skipped: false,
      category: 'stage-checkpoint',
      workItemType: checkpointType,
      workItemId: item?.id || null,
      url: item?.id
        ? `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${item.id}`
        : null
    }
  } catch (primaryErr) {
    if (assignedTo && isAssigneeError(primaryErr)) {
      try {
        const itemWithoutAssignee = await withTimeout(
          () => witApi.createWorkItem(null, patchWithoutAssignee, config.project, checkpointType),
          adoTimeoutMs,
          `ADO ${checkpointType} creation (without assignee)`
        )
        return {
          skipped: false,
          category: 'stage-checkpoint',
          workItemType: checkpointType,
          workItemId: itemWithoutAssignee?.id || null,
          url: itemWithoutAssignee?.id
            ? `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${itemWithoutAssignee.id}`
            : null
        }
      } catch {
        // Continue to Task fallback.
      }
    }

    try {
      const task = await withTimeout(
        () => witApi.createWorkItem(null, patchWithAssignee, config.project, 'Task'),
        adoTimeoutMs,
        'ADO Task creation'
      )
      return {
        skipped: false,
        category: 'stage-checkpoint',
        workItemType: 'Task',
        workItemId: task?.id || null,
        url: task?.id
          ? `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${task.id}`
          : null
      }
    } catch (taskErr) {
      if (assignedTo && isAssigneeError(taskErr)) {
        try {
          const taskWithoutAssignee = await withTimeout(
            () => witApi.createWorkItem(null, patchWithoutAssignee, config.project, 'Task'),
            adoTimeoutMs,
            'ADO Task creation (without assignee)'
          )
          return {
            skipped: false,
            category: 'stage-checkpoint',
            workItemType: 'Task',
            workItemId: taskWithoutAssignee?.id || null,
            url: taskWithoutAssignee?.id
              ? `https://dev.azure.com/${config.organization}/${config.project}/_workitems/edit/${taskWithoutAssignee.id}`
              : null
          }
        } catch {
          // Fall through to unified failure message.
        }
      }

      return {
        skipped: true,
        reason: `ADO create failed: ${formatError(primaryErr)} | ${formatError(taskErr)}`
      }
    }
  }
}

async function writeLog({ id, stage, actor, eventType, message, details = null }) {
  await addOrchestratorEvent({
    brId: id,
    stage,
    eventType,
    message,
    payload: {
      actor,
      ...(details || {})
    }
  })

  await addAuditLog({
    brId: id,
    stage,
    actor,
    action: message,
    details
  })
}

function getDemandPrompt({ persona, br }) {
  return [
    persona.systemInstruction || 'Analyze approved business request and produce demand output in JSON.',
    '',
    'Return valid JSON with fields:',
    '{',
    '  "demandSummary": "string",',
    '  "businessProblem": "string",',
    '  "scope": ["string"],',
    '  "budgetEstimate": "string",',
    '  "timelineEstimate": "string",',
    '  "risks": ["string"],',
    '  "successMetrics": ["string"]',
    '}',
    '',
    'Business Request:',
    JSON.stringify(
      {
        id: br.id,
        description: br.description,
        unit: br.unit,
        urgency: br.urgency,
        requestedDate: br.date,
        justification: br.justif
      },
      null,
      2
    )
  ].join('\n')
}

function getBrdPrompt({ persona, br, demandOutput }) {
  return [
    persona.systemInstruction || 'Draft BRD content from approved demand.',
    '',
    'Create a detailed enterprise-standard BRD draft in valid JSON.',
    'Be specific and actionable. Avoid vague placeholders.',
    'Use requirement IDs, priorities, rationale, and verification criteria.',
    '',
    'Return JSON with this exact top-level structure:',
    '{',
    '  "title": "string",',
    '  "documentControl": {',
    '    "version": "string",',
    '    "status": "string",',
    '    "preparedBy": "string",',
    '    "preparedOn": "ISO date string",',
    '    "reviewedBy": "string"',
    '  },',
    '  "executiveSummary": "string",',
    '  "businessProblem": "string",',
    '  "businessObjectives": ["string"],',
    '  "inScope": ["string"],',
    '  "outOfScope": ["string"],',
    '  "stakeholders": [{ "role": "string", "responsibility": "string" }],',
    '  "functionalRequirements": [{',
    '    "id": "FR-001",',
    '    "title": "string",',
    '    "description": "string",',
    '    "priority": "High|Medium|Low",',
    '    "rationale": "string",',
    '    "acceptanceCriteria": ["string"]',
    '  }],',
    '  "nonFunctionalRequirements": [{ "id": "NFR-001", "category": "string", "requirement": "string" }],',
    '  "dataRequirements": ["string"],',
    '  "integrationRequirements": ["string"],',
    '  "reportingAndAnalytics": ["string"],',
    '  "assumptions": ["string"],',
    '  "constraints": ["string"],',
    '  "risks": ["string"],',
    '  "dependencies": ["string"],',
    '  "acceptanceCriteria": ["string"],',
    '  "traceabilityMatrix": [{ "businessObjective": "string", "requirementId": "FR-001", "verificationMethod": "string" }],',
    '  "uatScenarios": [{ "id": "UAT-001", "scenario": "string", "expectedResult": "string" }],',
    '  "implementationPlan": { "phases": [{ "name": "string", "deliverables": ["string"] }] },',
    '  "signOff": [{ "role": "string", "status": "Pending|Approved|Rejected" }]',
    '}',
    '',
    'Business Request:',
    JSON.stringify(
      {
        id: br.id,
        description: br.description,
        unit: br.unit,
        urgency: br.urgency
      },
      null,
      2
    ),
    '',
    'Approved Demand Output:',
    JSON.stringify(demandOutput || {}, null, 2)
  ].join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { action, id, decision, reason, brdUrl, brdSummary, brdDetails, triggeredBy } = req.body || {}
  if (!action || !id) {
    return res.status(400).json({ message: 'Missing action or id' })
  }
  const operator = resolveActorFromRequest(req, triggeredBy, 'Workflow Operator')

  const personas = loadPersonas()

  const br = await withDb(async (db) => {
    return dbGet(db, 'SELECT * FROM business_requests WHERE id = ?', [id])
  })

  if (!br) {
    return res.status(404).json({ message: 'Business request not found' })
  }

  try {
    if (action === 'generate-demand') {
      const persona = getPersona(personas, 'demand')
      if (!persona || persona.active === false) {
        return res.status(400).json({ message: 'Agentic AI_Demand persona is missing or disabled' })
      }

      if (String(br.status || '').toLowerCase() !== 'approved') {
        return res.status(400).json({ message: 'Business request must be approved first' })
      }

      await updateBr(id, {
        demand_status: 'Running',
        demand_model: persona.model,
        workflow_current_stage: 'Demand Analysis'
      })

      await writeLog({
        id,
        stage: 'Demand',
        actor: persona.name,
        eventType: 'info',
        message: 'Demand analysis started',
        details: { model: persona.model, triggeredBy: operator }
      })

      const aiTotalTimeoutMs = Number(process.env.OLLAMA_TOTAL_TIMEOUT_MS || 120000)
      let aiResult = null
      try {
        aiResult = await withTimeout(
          () => runOllama({
            model: persona.model || 'llama3.1',
            prompt: getDemandPrompt({ persona, br }),
            fallbackFactory: () => buildDemandFallback(br)
          }),
          aiTotalTimeoutMs,
          'Demand AI generation'
        )
      } catch (err) {
        aiResult = {
          text: JSON.stringify(buildDemandFallback(br), null, 2),
          modelUsed: 'guard-timeout-fallback',
          source: 'guard-timeout-fallback',
          warning: formatError(err)
        }
      }

      const demandOutput = tryParseJson(aiResult.text) || { raw: aiResult.text }

      const ado = await syncStageToAdo({
        brId: id,
        stageName: 'Demand',
        title: 'Demand package generated',
        description: `<p><strong>BR:</strong> ${id}</p><pre>${JSON.stringify(demandOutput, null, 2)}</pre>`,
        tags: 'Agentic;Demand;AI_Demand'
      })

      await updateBr(id, {
        demand_status: 'Generated',
        demand_output: JSON.stringify(demandOutput),
        demand_model: aiResult.modelUsed,
        demand_review_status: 'Pending Brain Review',
        demand_review_reason: null,
        workflow_current_stage: 'Demand Review',
        stage1_status: 'Completed',
        stage1_output: JSON.stringify(demandOutput),
        stage1_model: aiResult.modelUsed,
        stage1_completed_at: nowIso(),
        demand_ado_work_item_id: ado.workItemId ? String(ado.workItemId) : null,
        stage1_ado_work_item_id: ado.workItemId ? String(ado.workItemId) : null
      })

      await writeLog({
        id,
        stage: 'Demand',
        actor: persona.name,
        eventType: 'success',
        message: 'Demand analysis completed',
        details: {
          adoWorkItemId: ado.workItemId || null,
          triggeredBy: operator,
          modelUsed: aiResult.modelUsed,
          source: aiResult.source,
          warning: aiResult.warning
        }
      })

      return res.status(200).json({ success: true, output: demandOutput, ado })
    }

    if (action === 'review-demand') {
      const persona = getPersona(personas, 'orchestrator')
      if (!persona || persona.active === false) {
        return res.status(400).json({ message: 'Agentic AI_Orcastration persona is missing or disabled' })
      }

      const approved = String(decision || '').toLowerCase() === 'approve'
      if (!approved && String(decision || '').toLowerCase() !== 'reject') {
        return res.status(400).json({ message: 'Decision must be approve or reject' })
      }

      const ado = await syncStageToAdo({
        brId: id,
        stageName: 'Demand Review',
        title: approved ? 'Demand approved by Brain' : 'Demand rejected by Brain',
        description: `<p><strong>BR:</strong> ${id}</p><p><strong>Decision:</strong> ${approved ? 'Approved' : 'Rejected'}</p><p><strong>Reason:</strong> ${reason || 'N/A'}</p>`,
        tags: 'Agentic;DemandReview;Orchestrator'
      })

      await updateBr(id, {
        demand_review_status: approved ? 'Approved' : 'Rejected',
        demand_status: approved ? 'Approved by Brain' : 'Rejected by Brain',
        demand_review_reason: reason || null,
        demand_reviewed_at: nowIso(),
        workflow_current_stage: approved ? 'BRD Drafting' : 'Demand Rework'
      })

      await writeLog({
        id,
        stage: 'Demand Review',
        actor: persona.name,
        eventType: approved ? 'success' : 'warning',
        message: approved ? 'Brain approved demand output' : 'Brain rejected demand output',
        details: { reason: reason || null, adoWorkItemId: ado.workItemId || null, triggeredBy: operator }
      })

      return res.status(200).json({ success: true, approved, ado })
    }

    if (action === 'generate-brd') {
      const persona = getPersona(personas, 'requirement')
      if (!persona || persona.active === false) {
        return res.status(400).json({ message: 'Agentic AI_Requirement persona is missing or disabled' })
      }

      if (String(br.demand_review_status || '').toLowerCase() !== 'approved') {
        return res.status(400).json({ message: 'Demand must be approved by Brain before BRD generation' })
      }

      await updateBr(id, {
        requirement_status: 'Running',
        workflow_current_stage: 'BRD Drafting'
      })

      await writeLog({
        id,
        stage: 'BRD Drafting',
        actor: persona.name,
        eventType: 'info',
        message: 'BRD generation started',
        details: { model: persona.model, triggeredBy: operator }
      })

      const demandOutput = tryParseJson(br.demand_output || '') || null
      const aiTotalTimeoutMs = Number(process.env.OLLAMA_TOTAL_TIMEOUT_MS || 120000)
      let aiResult = null
      try {
        aiResult = await withTimeout(
          () => runOllama({
            model: persona.model || 'llama3.1',
            prompt: getBrdPrompt({ persona, br, demandOutput }),
            fallbackFactory: () => buildBrdFallback(br, demandOutput)
          }),
          aiTotalTimeoutMs,
          'BRD AI generation'
        )
      } catch (err) {
        aiResult = {
          text: JSON.stringify(buildBrdFallback(br, demandOutput), null, 2),
          modelUsed: 'guard-timeout-fallback',
          source: 'guard-timeout-fallback',
          warning: formatError(err)
        }
      }
      const brdDraft = tryParseJson(aiResult.text) || { raw: aiResult.text }
      const nextVersion = Number(br.requirement_brd_version || 0) + 1

      const ado = await syncStageToAdo({
        brId: id,
        stageName: 'BRD',
        title: `BRD draft v${nextVersion} generated`,
        description: `<p><strong>BR:</strong> ${id}</p><pre>${JSON.stringify(brdDraft, null, 2)}</pre>`,
        tags: 'Agentic;BRD;BusinessAnalyst'
      })

      await updateBr(id, {
        requirement_status: 'Draft Generated by BA',
        requirement_brd_version: nextVersion,
        requirement_details: JSON.stringify({ source: 'AI Draft', version: nextVersion, draft: brdDraft, generatedAt: nowIso() }),
        requirement_review_status: 'Pending Brain Review',
        requirement_review_reason: null,
        workflow_current_stage: 'BRD Review',
        requirement_ado_work_item_id: ado.workItemId ? String(ado.workItemId) : br.requirement_ado_work_item_id || null
      })

      await writeLog({
        id,
        stage: 'BRD Drafting',
        actor: persona.name,
        eventType: 'success',
        message: 'BRD draft generated',
        details: {
          version: nextVersion,
          adoWorkItemId: ado.workItemId || null,
          triggeredBy: operator,
          modelUsed: aiResult.modelUsed,
          source: aiResult.source,
          warning: aiResult.warning
        }
      })

      return res.status(200).json({ success: true, draft: brdDraft, version: nextVersion, ado })
    }

    if (action === 'submit-brd') {
      const persona = getPersona(personas, 'requirement')
      if (!persona || persona.active === false) {
        return res.status(400).json({ message: 'Agentic AI_Requirement persona is missing or disabled' })
      }

      const existingDetails = tryParseJson(br.requirement_details || '')
      const hasExistingArtifact = Boolean(existingDetails || br.requirement_doc)

      if (!brdSummary && !brdUrl && !brdDetails && !hasExistingArtifact) {
        return res.status(400).json({ message: 'Provide BRD summary, details, or document URL' })
      }

      const summaryFallback =
        existingDetails?.summary ||
        existingDetails?.executiveSummary ||
        existingDetails?.title ||
        existingDetails?.draft?.executiveSummary ||
        existingDetails?.draft?.title ||
        null

      const summaryToPersist = brdSummary || summaryFallback
      const detailsToPersist = brdDetails || (existingDetails ? JSON.stringify(existingDetails) : null)
      const docUrlToPersist = brdUrl || br.requirement_doc || null

      const nextVersion = Number(br.requirement_brd_version || 0) + 1
      const mergedDetails = {
        source: 'BA Submission',
        version: nextVersion,
        summary: summaryToPersist,
        details: detailsToPersist,
        usedExistingDraft: !brdSummary && !brdDetails && Boolean(hasExistingArtifact),
        submittedAt: nowIso()
      }

      const ado = await syncStageToAdo({
        brId: id,
        stageName: 'BRD Submission',
        title: `BRD v${nextVersion} submitted by BA`,
        description: `<p><strong>BR:</strong> ${id}</p><p><strong>Summary:</strong> ${summaryToPersist || 'N/A'}</p><p><strong>Document URL:</strong> ${docUrlToPersist || 'N/A'}</p>`,
        tags: 'Agentic;BRDSubmission;BusinessAnalyst'
      })

      await updateBr(id, {
        requirement_status: 'Submitted by BA',
        requirement_doc: docUrlToPersist,
        requirement_details: JSON.stringify(mergedDetails),
        requirement_brd_version: nextVersion,
        requirement_review_status: 'Pending Brain Review',
        requirement_review_reason: null,
        workflow_current_stage: 'BRD Review',
        requirement_ado_work_item_id: ado.workItemId ? String(ado.workItemId) : br.requirement_ado_work_item_id || null
      })

      await writeLog({
        id,
        stage: 'BRD Submission',
        actor: persona.name,
        eventType: 'info',
        message: 'BRD submitted for Brain review',
        details: {
          version: nextVersion,
          brdUrl: docUrlToPersist,
          summary: summaryToPersist,
          adoWorkItemId: ado.workItemId || null,
          triggeredBy: operator,
          usedExistingDraft: !brdSummary && !brdDetails && Boolean(hasExistingArtifact)
        }
      })

      return res.status(200).json({ success: true, version: nextVersion, ado })
    }

    if (action === 'review-brd') {
      const persona = getPersona(personas, 'orchestrator')
      if (!persona || persona.active === false) {
        return res.status(400).json({ message: 'Agentic AI_Orcastration persona is missing or disabled' })
      }

      const approved = String(decision || '').toLowerCase() === 'approve'
      if (!approved && String(decision || '').toLowerCase() !== 'reject') {
        return res.status(400).json({ message: 'Decision must be approve or reject' })
      }

      const ado = await syncStageToAdo({
        brId: id,
        stageName: 'BRD Review',
        title: approved ? 'BRD approved by Brain' : 'BRD rejected by Brain',
        description: `<p><strong>BR:</strong> ${id}</p><p><strong>Decision:</strong> ${approved ? 'Approved' : 'Rejected'}</p><p><strong>Reason:</strong> ${reason || 'N/A'}</p>`,
        tags: 'Agentic;BRDReview;Orchestrator'
      })

      await updateBr(id, {
        requirement_review_status: approved ? 'Approved' : 'Rejected',
        requirement_status: approved ? 'Approved by Brain' : 'Rejected by Brain',
        requirement_review_reason: reason || null,
        requirement_reviewed_at: nowIso(),
        requirement_created: approved ? 1 : 0,
        epic_status: approved ? (br.epic_status || 'Ready for Creation') : (br.epic_status || null),
        user_story_status: approved ? (br.user_story_status || 'Ready for Creation') : (br.user_story_status || null),
        workflow_current_stage: approved ? 'Ready for Epic Scoping' : 'BRD Rework'
      })

      await writeLog({
        id,
        stage: 'BRD Review',
        actor: persona.name,
        eventType: approved ? 'success' : 'warning',
        message: approved ? 'Brain approved BRD' : 'Brain rejected BRD',
        details: { reason: reason || null, adoWorkItemId: ado.workItemId || null, triggeredBy: operator }
      })

      return res.status(200).json({ success: true, approved, ado })
    }

    return res.status(400).json({ message: `Unknown action: ${action}` })
  } catch (err) {
    const errorMessage = String(err.message || err)
    await writeLog({
      id,
      stage: 'Workflow Action',
      actor: operator,
      eventType: 'error',
      message: `Action failed: ${action}`,
      details: { error: errorMessage }
    })
    return res.status(500).json({ message: 'Workflow action failed', error: errorMessage })
  }
}
