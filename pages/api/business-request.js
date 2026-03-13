import fs from 'fs'
import path from 'path'
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import {
  addAuditLog,
  addOrchestratorEvent,
  dbAll,
  dbGet,
  dbRun,
  updateBusinessRequestFields,
  withDb
} from './_lib/requests-db'
import { resolveActorFromRequest } from './_lib/session-identity'
import { requireAdmin } from './_lib/auth'

function nowIso() {
  return new Date().toISOString()
}

function safeSlug(value) {
  return String(value || 'brd')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80)
}

function asString(value, fallback = 'N/A') {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function makeBulletLines(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [new Paragraph({ text: 'N/A' })]
  }

  return items.map((item) => {
    return new Paragraph({
      text: asString(item),
      bullet: { level: 0 }
    })
  })
}

function normalizeStandardBrd(brId, draft) {
  const input = draft && typeof draft === 'object' ? draft : {}
  const functionalFromLegacy = Array.isArray(input.functionalRequirements)
    ? input.functionalRequirements
    : Array.isArray(input.scope)
      ? input.scope
      : []

  const normalizedFr = functionalFromLegacy.map((item, idx) => {
    if (item && typeof item === 'object') {
      return {
        id: item.id || `FR-${String(idx + 1).padStart(3, '0')}`,
        title: item.title || `Functional Requirement ${idx + 1}`,
        description: item.description || asString(item),
        priority: item.priority || 'Medium',
        rationale: item.rationale || 'Derived from approved demand and BR scope',
        acceptanceCriteria: Array.isArray(item.acceptanceCriteria) ? item.acceptanceCriteria : ['Requirement behavior is validated in UAT']
      }
    }

    return {
      id: `FR-${String(idx + 1).padStart(3, '0')}`,
      title: `Functional Requirement ${idx + 1}`,
      description: asString(item),
      priority: idx < 2 ? 'High' : 'Medium',
      rationale: 'Derived from approved demand and BR scope',
      acceptanceCriteria: [`System supports: ${asString(item)}`]
    }
  })

  const functionalRequirements = normalizedFr.length
    ? normalizedFr
    : [
      {
        id: 'FR-001',
        title: 'Workflow Lifecycle Governance',
        description: 'System shall orchestrate business request to approved BRD lifecycle with mandatory approval gates.',
        priority: 'High',
        rationale: 'Core governance objective',
        acceptanceCriteria: ['Lifecycle state transitions are persisted and visible in dashboard']
      },
      {
        id: 'FR-002',
        title: 'Review Decision Traceability',
        description: 'System shall capture approve/reject outcomes with actor, timestamp, and reason.',
        priority: 'High',
        rationale: 'Audit and compliance requirement',
        acceptanceCriteria: ['All review events appear in audit trail export']
      },
      {
        id: 'FR-003',
        title: 'BRD Artifact Management',
        description: 'System shall produce a downloadable BRD Word document for approved requirement packages.',
        priority: 'Medium',
        rationale: 'Handover readiness',
        acceptanceCriteria: ['Approved BRD has non-empty DOCX artifact path']
      }
    ]

  return {
    title: input.title || `Business Requirements Document - ${brId}`,
    documentControl: input.documentControl || {
      version: '1.0',
      status: 'Draft',
      preparedBy: 'Agentic AI_Requirement',
      preparedOn: nowIso(),
      reviewedBy: 'Agentic AI_Orcastration'
    },
    executiveSummary: input.executiveSummary || input.overview || 'This BRD defines detailed business and solution requirements for the approved business request.',
    businessProblem: input.businessProblem || 'Current process gaps and fragmented controls are impacting predictable delivery outcomes.',
    businessObjectives: Array.isArray(input.businessObjectives) && input.businessObjectives.length ? input.businessObjectives : [
      'Establish clear, testable and prioritized requirements',
      'Improve governance and decision transparency',
      'Reduce rework through explicit acceptance criteria'
    ],
    inScope: Array.isArray(input.inScope) && input.inScope.length ? input.inScope : [
      'Demand to BRD lifecycle management',
      'Approval and audit traceability controls',
      'Standardized BRD artifact generation'
    ],
    outOfScope: Array.isArray(input.outOfScope) && input.outOfScope.length ? input.outOfScope : [
      'Unrelated legacy modernization streams',
      'Enterprise platform replacement initiatives'
    ],
    stakeholders: Array.isArray(input.stakeholders) && input.stakeholders.length ? input.stakeholders : [
      { role: 'Business Owner', responsibility: 'Approves business outcomes and priorities' },
      { role: 'Business Analyst', responsibility: 'Owns requirement quality and completeness' },
      { role: 'Delivery Team', responsibility: 'Implements and validates approved requirements' }
    ],
    functionalRequirements,
    nonFunctionalRequirements: Array.isArray(input.nonFunctionalRequirements) && input.nonFunctionalRequirements.length
      ? input.nonFunctionalRequirements
      : [
        { id: 'NFR-001', category: 'Security', requirement: 'Access controls enforce least privilege on workflow actions.' },
        { id: 'NFR-002', category: 'Auditability', requirement: 'All lifecycle actions are traceable by actor and timestamp.' },
        { id: 'NFR-003', category: 'Performance', requirement: 'Workflow actions complete within operational SLA thresholds.' }
      ],
    dataRequirements: Array.isArray(input.dataRequirements) && input.dataRequirements.length ? input.dataRequirements : [
      'Persist BR metadata and lifecycle statuses',
      'Store BRD version history and review decisions',
      'Maintain audit records for compliance exports'
    ],
    integrationRequirements: Array.isArray(input.integrationRequirements) && input.integrationRequirements.length ? input.integrationRequirements : [
      'Azure DevOps synchronization for stage-level work tracking',
      'LLM integration for demand and BRD drafting',
      'Document storage path for BRD artifacts'
    ],
    reportingAndAnalytics: Array.isArray(input.reportingAndAnalytics) && input.reportingAndAnalytics.length ? input.reportingAndAnalytics : [
      'Workflow status and aging by stage',
      'Approval/rejection trend analytics',
      'Audit export for governance reviews'
    ],
    assumptions: Array.isArray(input.assumptions) && input.assumptions.length ? input.assumptions : [
      'Stakeholders are available for timely reviews',
      'External integrations remain reachable during execution windows'
    ],
    constraints: Array.isArray(input.constraints) && input.constraints.length ? input.constraints : [
      'Timeline depends on review turnaround',
      'Upstream API limits may affect throughput'
    ],
    risks: Array.isArray(input.risks) && input.risks.length ? input.risks : [
      'Ambiguous requirements causing rework',
      'Dependency delays impacting schedule'
    ],
    dependencies: Array.isArray(input.dependencies) && input.dependencies.length ? input.dependencies : [
      'ADO project and team configuration',
      'Operational model endpoint availability'
    ],
    acceptanceCriteria: Array.isArray(input.acceptanceCriteria) && input.acceptanceCriteria.length ? input.acceptanceCriteria : [
      'All high-priority requirements validated in UAT',
      'Brain approvals completed with full audit records',
      'Approved BRD Word artifact available for handover'
    ],
    traceabilityMatrix: Array.isArray(input.traceabilityMatrix) && input.traceabilityMatrix.length
      ? input.traceabilityMatrix
      : functionalRequirements.map((fr) => ({
        businessObjective: 'Controlled and auditable SDLC execution',
        requirementId: fr.id,
        verificationMethod: 'UAT and audit evidence'
      })),
    uatScenarios: Array.isArray(input.uatScenarios) && input.uatScenarios.length ? input.uatScenarios : [
      { id: 'UAT-001', scenario: 'Create BR and complete to approved BRD', expectedResult: 'Workflow reaches Ready for Epic Scoping' },
      { id: 'UAT-002', scenario: 'Reject then re-approve BRD', expectedResult: 'Version increments and final approval is recorded' }
    ],
    implementationPlan: input.implementationPlan || {
      phases: [
        { name: 'Phase 1', deliverables: ['Requirement baseline', 'Stakeholder alignment'] },
        { name: 'Phase 2', deliverables: ['Build and integration', 'Validation test execution'] },
        { name: 'Phase 3', deliverables: ['Go-live readiness', 'Operational handover'] }
      ]
    },
    signOff: Array.isArray(input.signOff) && input.signOff.length ? input.signOff : [
      { role: 'Business Owner', status: 'Pending' },
      { role: 'Brain Orchestrator', status: 'Approved' },
      { role: 'Program Manager', status: 'Pending' }
    ]
  }
}

async function createAutoBrdFile({ brId, draft }) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  fs.mkdirSync(uploadDir, { recursive: true })

  const safeId = safeSlug(brId)
  const fileName = `${safeId}_auto_brd_${Date.now()}.docx`
  const filePath = path.join(uploadDir, fileName)

  const brd = normalizeStandardBrd(brId, draft)
  const generatedAt = nowIso()

  const stakeholderLines = (Array.isArray(brd.stakeholders) ? brd.stakeholders : []).map((item) => {
    const role = asString(item?.role)
    const responsibility = asString(item?.responsibility)
    return new Paragraph({ text: `${role}: ${responsibility}`, bullet: { level: 0 } })
  })

  const functionalLines = (Array.isArray(brd.functionalRequirements) ? brd.functionalRequirements : []).flatMap((fr) => {
    const criteria = Array.isArray(fr.acceptanceCriteria) ? fr.acceptanceCriteria : []
    const header = new Paragraph({
      children: [
        new TextRun({ text: `${asString(fr.id)} - ${asString(fr.title)}`, bold: true })
      ]
    })
    const body = new Paragraph(asString(fr.description))
    const priority = new Paragraph({
      children: [
        new TextRun({ text: 'Priority: ', bold: true }),
        new TextRun(asString(fr.priority))
      ]
    })
    const rationale = new Paragraph({
      children: [
        new TextRun({ text: 'Rationale: ', bold: true }),
        new TextRun(asString(fr.rationale))
      ]
    })
    const criteriaLabel = new Paragraph({
      children: [
        new TextRun({ text: 'Acceptance Criteria', bold: true })
      ]
    })
    const criteriaLines = criteria.length ? makeBulletLines(criteria) : [new Paragraph('N/A')]
    return [header, body, priority, rationale, criteriaLabel, ...criteriaLines, new Paragraph('')]
  })

  const nfrLines = (Array.isArray(brd.nonFunctionalRequirements) ? brd.nonFunctionalRequirements : []).map((nfr) => {
    return new Paragraph({
      text: `${asString(nfr.id)} [${asString(nfr.category)}]: ${asString(nfr.requirement)}`,
      bullet: { level: 0 }
    })
  })

  const traceLines = (Array.isArray(brd.traceabilityMatrix) ? brd.traceabilityMatrix : []).map((row) => {
    return new Paragraph({
      text: `${asString(row.businessObjective)} -> ${asString(row.requirementId)} (${asString(row.verificationMethod)})`,
      bullet: { level: 0 }
    })
  })

  const uatLines = (Array.isArray(brd.uatScenarios) ? brd.uatScenarios : []).flatMap((row) => {
    return [
      new Paragraph({ children: [new TextRun({ text: `${asString(row.id)} - ${asString(row.scenario)}`, bold: true })] }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Expected Result: ', bold: true }),
          new TextRun(asString(row.expectedResult))
        ]
      }),
      new Paragraph('')
    ]
  })

  const implementationLines = (Array.isArray(brd.implementationPlan?.phases) ? brd.implementationPlan.phases : []).flatMap((phase) => {
    const header = new Paragraph({ children: [new TextRun({ text: asString(phase.name), bold: true })] })
    const deliverables = makeBulletLines(Array.isArray(phase.deliverables) ? phase.deliverables : [])
    return [header, ...deliverables, new Paragraph('')]
  })

  const signOffLines = (Array.isArray(brd.signOff) ? brd.signOff : []).map((item) => {
    return new Paragraph({ text: `${asString(item.role)}: ${asString(item.status)}`, bullet: { level: 0 } })
  })

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `Business Requirements Document - ${brId}`,
            heading: HeadingLevel.TITLE
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Generated By: ', bold: true }),
              new TextRun('Agentic AI_Requirement')
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Document Version: ', bold: true }),
              new TextRun(asString(brd.documentControl?.version, '1.0'))
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Document Status: ', bold: true }),
              new TextRun(asString(brd.documentControl?.status, 'Draft'))
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Generated At: ', bold: true }),
              new TextRun(generatedAt)
            ]
          }),

          new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_1 }),
          new Paragraph(asString(brd.executiveSummary)),

          new Paragraph({ text: 'Business Problem', heading: HeadingLevel.HEADING_1 }),
          new Paragraph(asString(brd.businessProblem)),

          new Paragraph({ text: 'Business Objectives', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.businessObjectives),

          new Paragraph({ text: 'Scope', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: 'In Scope', bold: true })] }),
          ...makeBulletLines(brd.inScope),
          new Paragraph({ children: [new TextRun({ text: 'Out of Scope', bold: true })] }),
          ...makeBulletLines(brd.outOfScope),

          new Paragraph({ text: 'Stakeholders', heading: HeadingLevel.HEADING_1 }),
          ...(stakeholderLines.length ? stakeholderLines : [new Paragraph('N/A')]),

          new Paragraph({ text: 'Functional Requirements', heading: HeadingLevel.HEADING_1 }),
          ...(functionalLines.length ? functionalLines : [new Paragraph('N/A')]),

          new Paragraph({ text: 'Non-Functional Requirements', heading: HeadingLevel.HEADING_1 }),
          ...(nfrLines.length ? nfrLines : [new Paragraph('N/A')]),

          new Paragraph({ text: 'Data Requirements', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.dataRequirements),

          new Paragraph({ text: 'Integration Requirements', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.integrationRequirements),

          new Paragraph({ text: 'Reporting and Analytics', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.reportingAndAnalytics),

          new Paragraph({ text: 'Assumptions', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.assumptions),

          new Paragraph({ text: 'Constraints', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.constraints),

          new Paragraph({ text: 'Risks', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.risks),

          new Paragraph({ text: 'Dependencies', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.dependencies),

          new Paragraph({ text: 'Acceptance Criteria', heading: HeadingLevel.HEADING_1 }),
          ...makeBulletLines(brd.acceptanceCriteria),

          new Paragraph({ text: 'Traceability Matrix', heading: HeadingLevel.HEADING_1 }),
          ...(traceLines.length ? traceLines : [new Paragraph('N/A')]),

          new Paragraph({ text: 'UAT Scenarios', heading: HeadingLevel.HEADING_1 }),
          ...(uatLines.length ? uatLines : [new Paragraph('N/A')]),

          new Paragraph({ text: 'Implementation Plan', heading: HeadingLevel.HEADING_1 }),
          ...(implementationLines.length ? implementationLines : [new Paragraph('N/A')]),

          new Paragraph({ text: 'Sign-Off', heading: HeadingLevel.HEADING_1 }),
          ...(signOffLines.length ? signOffLines : [new Paragraph('N/A')]),

          new Paragraph({ text: 'Planning Estimates', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Budget: ', bold: true }),
              new TextRun(asString(brd.budgetEstimate))
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Timeline: ', bold: true }),
              new TextRun(asString(brd.timelineEstimate))
            ]
          })
        ]
      }
    ]
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(filePath, buffer)
  return `/uploads/${encodeURIComponent(fileName)}`
}

function getSelfBaseUrl(req) {
  const protoHeader = req.headers['x-forwarded-proto']
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : (protoHeader || 'http')
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  return `${proto}://${host}`
}

async function postWorkflowAction(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/api/agentic/workflow-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!response.ok) {
    throw new Error(json?.message || json?.error || text || `Workflow action failed (${response.status})`)
  }

  return json || {}
}

async function runAutoWorkflow({ req, brId, actor }) {
  const baseUrl = getSelfBaseUrl(req)
  const triggeredBy = actor || 'Agentic AI_Orcastration'

  await addAuditLog({
    brId,
    stage: 'Auto Workflow',
    actor: triggeredBy,
    action: 'Auto workflow started',
    details: { startedAt: nowIso() }
  })
  await addOrchestratorEvent({
    brId,
    stage: 'auto-workflow',
    eventType: 'info',
    message: 'Auto workflow started',
    payload: { actor: triggeredBy }
  })

  await postWorkflowAction(baseUrl, {
    id: brId,
    action: 'generate-demand',
    triggeredBy
  })
  await postWorkflowAction(baseUrl, {
    id: brId,
    action: 'review-demand',
    decision: 'approve',
    reason: 'Auto-approved by Brain',
    triggeredBy
  })
  const brdDraftResult = await postWorkflowAction(baseUrl, {
    id: brId,
    action: 'generate-brd',
    triggeredBy
  })

  let brdUrl = ''
  try {
    brdUrl = await createAutoBrdFile({
      brId,
      draft: brdDraftResult?.draft || {}
    })
  } catch (fileErr) {
    await addAuditLog({
      brId,
      stage: 'BRD Submission',
      actor: triggeredBy,
      action: 'Auto BRD file generation skipped',
      details: { error: String(fileErr?.message || fileErr) }
    })
  }

  await postWorkflowAction(baseUrl, {
    id: brId,
    action: 'submit-brd',
    brdSummary: `Auto-submitted BRD for ${brId}`,
    brdDetails: 'Generated and submitted by supporting demand-and-BRD workflow automation.',
    brdUrl,
    triggeredBy
  })
  await postWorkflowAction(baseUrl, {
    id: brId,
    action: 'review-brd',
    decision: 'approve',
    reason: 'Auto-approved by Brain',
    triggeredBy
  })

  await addAuditLog({
    brId,
    stage: 'Auto Workflow',
    actor: triggeredBy,
    action: 'Auto workflow completed',
    details: { completedAt: nowIso() }
  })
  await addOrchestratorEvent({
    brId,
    stage: 'auto-workflow',
    eventType: 'success',
    message: 'Auto workflow completed',
    payload: { actor: triggeredBy }
  })
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { brid, description, unit, urgency, date, justif, actor } = req.body || {}
    if (!brid || !description) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    try {
      await withDb(async (db) => {
        await dbRun(
          db,
          `INSERT INTO business_requests(id, description, unit, urgency, date, justif)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [brid, description, unit || '', urgency || '', date || '', justif || '']
        )
      })

      const createdBy = resolveActorFromRequest(req, actor, 'Business User')
      await addAuditLog({
        brId: brid,
        stage: 'Business Request',
        actor: createdBy,
        action: 'Business request created',
        details: { unit: unit || '', urgency: urgency || '' }
      })
      await addOrchestratorEvent({
        brId: brid,
        stage: 'business-request',
        eventType: 'info',
        message: 'Business request created',
        payload: { actor: createdBy }
      })

      // Auto-approve on creation so orchestration can begin immediately.
      await withDb(async (db) => {
        await updateBusinessRequestFields(db, brid, {
          status: 'Approved',
          decision_reason: 'Auto-approved by Brain',
          workflow_current_stage: 'Demand Analysis'
        })
      })
      await addAuditLog({
        brId: brid,
        stage: 'Business Approval',
        actor: 'Agentic AI_Orcastration',
        action: 'Business request approved',
        details: { reason: 'Auto-approved on create' }
      })
      await addOrchestratorEvent({
        brId: brid,
        stage: 'business-request',
        eventType: 'info',
        message: 'Business request approved',
        payload: { actor: 'Agentic AI_Orcastration', reason: 'Auto-approved on create' }
      })

      void runAutoWorkflow({
        req,
        brId: brid,
        actor: 'Agentic AI_Orcastration'
      }).catch(async (workflowError) => {
        const errorMessage = String(workflowError?.message || workflowError)
        await addAuditLog({
          brId: brid,
          stage: 'Auto Workflow',
          actor: 'Agentic AI_Orcastration',
          action: 'Auto workflow failed',
          details: { error: errorMessage }
        })
        await addOrchestratorEvent({
          brId: brid,
          stage: 'auto-workflow',
          eventType: 'error',
          message: 'Auto workflow failed',
          payload: { error: errorMessage }
        })
      })

      return res.status(201).json({
        success: true,
        id: brid,
        status: 'Approved',
        autoFlowStarted: true
      })
    } catch (err) {
      if (String(err.message || err).includes('UNIQUE constraint failed')) {
        return res.status(409).json({ message: 'BR ID already exists. Please try again.' })
      }
      console.error('DB insert error', err)
      return res.status(500).json({ message: 'Insert failed', error: String(err.message || err) })
    }
  }

  if (req.method === 'PATCH') {
    const body = req.body || {}
    const {
      id,
      status,
      decision_reason,
      requirement_created,
      requirement_doc,
      requirement_details,
      synced_to_ado,
      ado_backlog_id,
      team_name,
      sprint_name,
      epic_status,
      feature_status,
      user_story_status,
      task_status,
      sprint_status,
      story_points_total,
      weighted_points_total,
      ado_sync_summary,
      ado_board_url,
      ado_dashboard_url,
      ado_iteration_path,
      ado_assigned_to,
      safe_pi_name,
      safe_art_name,
      safe_dor_checks,
      safe_dod_checks,
      safe_capacity_guardrails,
      safe_wsjf_summary,
      safe_dependency_metrics,
      stage1_status,
      stage1_output,
      stage1_error,
      stage1_completed_at,
      stage1_ado_work_item_id,
      stage1_model,
      demand_status,
      demand_output,
      demand_model,
      demand_review_status,
      demand_review_reason,
      demand_reviewed_at,
      demand_ado_work_item_id,
      requirement_status,
      requirement_brd_version,
      requirement_review_status,
      requirement_review_reason,
      requirement_reviewed_at,
      requirement_ado_work_item_id,
      workflow_current_stage,
      actor,
      auditStage,
      auditAction
    } = body

    if (!id) {
      return res.status(400).json({ message: 'Missing id' })
    }

    try {
      const fields = {
        status,
        decision_reason,
        requirement_created: requirement_created === undefined ? undefined : (requirement_created ? 1 : 0),
        requirement_doc,
        requirement_details,
        synced_to_ado: synced_to_ado === undefined ? undefined : (synced_to_ado ? 1 : 0),
        ado_backlog_id,
        team_name,
        sprint_name,
        epic_status,
        feature_status,
        user_story_status,
        task_status,
        sprint_status,
        story_points_total,
        weighted_points_total,
        ado_sync_summary,
        ado_board_url,
        ado_dashboard_url,
        ado_iteration_path,
        ado_assigned_to,
        safe_pi_name,
        safe_art_name,
        safe_dor_checks,
        safe_dod_checks,
        safe_capacity_guardrails,
        safe_wsjf_summary,
        safe_dependency_metrics,
        stage1_status,
        stage1_output,
        stage1_error,
        stage1_completed_at,
        stage1_ado_work_item_id,
        stage1_model,
        demand_status,
        demand_output,
        demand_model,
        demand_review_status,
        demand_review_reason,
        demand_reviewed_at,
        demand_ado_work_item_id,
        requirement_status,
        requirement_brd_version,
        requirement_review_status,
        requirement_review_reason,
        requirement_reviewed_at,
        requirement_ado_work_item_id,
        workflow_current_stage
      }

      if (Object.values(fields).every((value) => value === undefined)) {
        return res.status(400).json({ message: 'Nothing to update' })
      }

      await withDb(async (db) => {
        await updateBusinessRequestFields(db, id, fields)
      })

      const auditActor = resolveActorFromRequest(req, actor, 'Workflow Operator')
      const stage =
        auditStage ||
        (status === 'Approved' || status === 'Rejected'
          ? 'Business Approval'
          : stage1_status
            ? 'Stage 1'
            : requirement_created === true
              ? 'Requirements'
              : workflow_current_stage || 'Business Request')

      const action =
        auditAction ||
        (status === 'Approved'
          ? 'Business request approved'
          : status === 'Rejected'
            ? 'Business request rejected'
            : stage1_status
              ? `Stage 1 status updated to ${stage1_status}`
              : requirement_created === true
                ? 'Requirements submitted'
                : 'Business request updated')

      await addAuditLog({
        brId: id,
        stage,
        actor: auditActor,
        action,
        details: {
          status,
          decision_reason,
          stage1_status,
          requirement_created,
          workflow_current_stage
        }
      })

      await addOrchestratorEvent({
        brId: id,
        stage: 'business-request',
        eventType: 'info',
        message: action,
        payload: { actor: auditActor, stage }
      })

      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('DB update error', err)
      return res.status(500).json({ message: 'Update failed', error: String(err.message || err) })
    }
  }

  if (req.method === 'GET') {
    try {
      const requests = await withDb(async (db) => {
        return dbAll(db, 'SELECT * FROM business_requests ORDER BY created_at DESC')
      })
      return res.status(200).json({ requests })
    } catch (err) {
      console.error('DB select error', err)
      return res.status(500).json({ message: 'Query failed', error: String(err.message || err) })
    }
  }

  if (req.method === 'DELETE') {
    const adminSession = requireAdmin(req, res)
    if (!adminSession) return

    try {
      const report = await withDb(async (db) => {
        const before = await dbGet(
          db,
          `SELECT
            (SELECT COUNT(*) FROM business_requests) AS br,
            (SELECT COUNT(*) FROM orchestrator_events) AS ev,
            (SELECT COUNT(*) FROM audit_logs) AS al`
        )

        await dbRun(db, 'DELETE FROM business_requests')
        await dbRun(db, 'DELETE FROM orchestrator_events')
        await dbRun(db, 'DELETE FROM audit_logs')

        return {
          businessRequestsDeleted: Number(before?.br || 0),
          eventsDeleted: Number(before?.ev || 0),
          auditLogsDeleted: Number(before?.al || 0)
        }
      })

      return res.status(200).json({ success: true, report })
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Business request cleanup failed',
        error: String(err.message || err)
      })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
