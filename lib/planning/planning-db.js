import crypto from 'crypto'
import {
  addAuditLog,
  addOrchestratorEvent,
  dbAll,
  dbGet,
  dbRun,
  withDb
} from '../../pages/api/_lib/requests-db'

function nowIso() {
  return new Date().toISOString()
}

function asJson(value) {
  return JSON.stringify(value === undefined ? null : value)
}

function parseJson(value, fallback = null) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function newPlanningSessionId() {
  return `PLAN-${crypto.randomUUID()}`
}

export async function writePlanningLog({ sessionId, stage, actor, message, details, eventType = 'info' }) {
  await addOrchestratorEvent({
    brId: sessionId,
    stage,
    eventType,
    message,
    payload: details || null
  })

  await addAuditLog({
    brId: sessionId,
    stage,
    actor,
    action: message,
    details: details || null
  })
}

export async function createPlanningSession({
  id,
  title,
  teamId,
  teamName,
  sprintId,
  sprintName,
  planningContext,
  selectedAgents,
  createdBy
}) {
  return withDb(async (db) => {
    await dbRun(
      db,
      `INSERT INTO planning_sessions (
        id,
        title,
        team_id,
        team_name,
        sprint_id,
        sprint_name,
        status,
        planning_context,
        selected_agents,
        created_by,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title || id,
        teamId || null,
        teamName || null,
        sprintId || null,
        sprintName || null,
        'running',
        asJson(planningContext || {}),
        asJson(selectedAgents || []),
        createdBy || 'Workflow Operator',
        nowIso()
      ]
    )
  })
}

export async function updatePlanningSession(id, fields = {}) {
  return withDb(async (db) => {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined)
    if (!entries.length) return
    const sets = entries.map(([key]) => `${key} = ?`).join(', ')
    const values = entries.map(([, value]) => value)
    values.push(id)
    await dbRun(db, `UPDATE planning_sessions SET ${sets} WHERE id = ?`, values)
  })
}

export async function savePlanningAgentOutput({ sessionId, agentKey, output, actor, confidence }) {
  return withDb(async (db) => {
    const result = await dbRun(
      db,
      `INSERT INTO planning_agent_outputs (
        session_id,
        agent_key,
        summary,
        confidence,
        output_json,
        created_by,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        agentKey,
        output?.summary || '',
        Number.isFinite(Number(confidence)) ? Number(confidence) : null,
        asJson(output),
        actor || 'Workflow Operator',
        nowIso()
      ]
    )

    return Number(result?.lastID || 0)
  })
}

export async function saveHumanDecision({
  sessionId,
  agentOutputId,
  agentKey,
  decision,
  originalOutput,
  finalOutput,
  rationale,
  actor
}) {
  return withDb(async (db) => {
    await dbRun(
      db,
      `INSERT INTO planning_human_decisions (
        session_id,
        agent_output_id,
        agent_key,
        decision,
        original_output_json,
        final_output_json,
        human_rationale,
        actor,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        agentOutputId || null,
        agentKey || null,
        decision,
        asJson(originalOutput || null),
        asJson(finalOutput || null),
        rationale || null,
        actor || 'Workflow Operator',
        nowIso()
      ]
    )
  })
}

export async function saveDependencyRecords(sessionId, records = []) {
  if (!Array.isArray(records) || !records.length) return
  await withDb(async (db) => {
    for (const item of records) {
      await dbRun(
        db,
        `INSERT INTO planning_dependency_records (
          session_id,
          source_item,
          target_item,
          dependency_type,
          severity,
          description,
          mitigation,
          threatens_sprint,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          item.source_item || null,
          item.target_item || null,
          item.dependency_type || null,
          item.severity || null,
          item.description || null,
          item.mitigation || null,
          item.threatens_sprint ? 1 : 0,
          nowIso()
        ]
      )
    }
  })
}

export async function saveEstimationDecisions(sessionId, rows = [], actor = 'Workflow Operator') {
  if (!Array.isArray(rows) || !rows.length) return
  await withDb(async (db) => {
    for (const item of rows) {
      await dbRun(
        db,
        `INSERT INTO planning_estimation_decisions (
          session_id,
          backlog_item_id,
          backlog_item_title,
          ai_estimate,
          final_estimate,
          confidence,
          assumptions,
          actor,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          item.backlog_item_id || null,
          item.backlog_item_title || null,
          Number.isFinite(Number(item.ai_estimate)) ? Number(item.ai_estimate) : null,
          Number.isFinite(Number(item.final_estimate)) ? Number(item.final_estimate) : null,
          Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : null,
          item.assumptions ? asJson(item.assumptions) : null,
          actor,
          nowIso()
        ]
      )
    }
  })
}

export async function saveArchitectureNote(sessionId, note = {}, agentOutputId = null) {
  await withDb(async (db) => {
    await dbRun(
      db,
      `INSERT INTO planning_architecture_notes (
        session_id,
        agent_output_id,
        impacted_components,
        assumptions,
        constraints,
        technical_enablers,
        architecture_risks,
        recommended_actions,
        rationale,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        sessionId,
        agentOutputId,
        asJson(note.impacted_components || []),
        asJson(note.assumptions || []),
        asJson(note.constraints || []),
        asJson(note.technical_enablers || []),
        asJson(note.architecture_risks || []),
        asJson(note.recommended_actions || []),
        note.rationale || null,
        nowIso()
      ]
    )
  })
}

export async function saveRiskRecords(sessionId, records = [], sourceAgent = 'risk_analyst') {
  if (!Array.isArray(records) || !records.length) return
  await withDb(async (db) => {
    for (const risk of records) {
      await dbRun(
        db,
        `INSERT INTO planning_risk_records (
          session_id,
          risk_id,
          title,
          description,
          category,
          probability,
          impact,
          severity,
          mitigation,
          owner,
          status,
          source_agent,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          sessionId,
          risk.risk_id || null,
          risk.title || null,
          risk.description || null,
          risk.category || null,
          risk.probability || null,
          risk.impact || null,
          risk.severity || null,
          risk.mitigation || null,
          risk.owner || null,
          risk.status || null,
          sourceAgent,
          nowIso()
        ]
      )
    }
  })
}

export async function getPlanningSessionWithChildren(sessionId) {
  return withDb(async (db) => {
    const session = await dbGet(db, 'SELECT * FROM planning_sessions WHERE id = ?', [sessionId])
    if (!session) return null

    const outputs = await dbAll(
      db,
      `SELECT id, session_id, agent_key, summary, confidence, output_json, created_by, created_at
       FROM planning_agent_outputs
       WHERE session_id = ?
       ORDER BY id ASC`,
      [sessionId]
    )

    const decisions = await dbAll(
      db,
      `SELECT id, session_id, agent_output_id, agent_key, decision, original_output_json, final_output_json, human_rationale, actor, created_at
       FROM planning_human_decisions
       WHERE session_id = ?
       ORDER BY id ASC`,
      [sessionId]
    )

    const dependencies = await dbAll(
      db,
      `SELECT id, session_id, source_item, target_item, dependency_type, severity, description, mitigation, threatens_sprint, created_at
       FROM planning_dependency_records
       WHERE session_id = ?
       ORDER BY id ASC`,
      [sessionId]
    )

    const estimates = await dbAll(
      db,
      `SELECT id, session_id, backlog_item_id, backlog_item_title, ai_estimate, final_estimate, confidence, assumptions, actor, created_at
       FROM planning_estimation_decisions
       WHERE session_id = ?
       ORDER BY id ASC`,
      [sessionId]
    )

    const architectureNotes = await dbAll(
      db,
      `SELECT id, session_id, agent_output_id, impacted_components, assumptions, constraints, technical_enablers, architecture_risks, recommended_actions, rationale, created_at
       FROM planning_architecture_notes
       WHERE session_id = ?
       ORDER BY id ASC`,
      [sessionId]
    )

    const risks = await dbAll(
      db,
      `SELECT id, session_id, risk_id, title, description, category, probability, impact, severity, mitigation, owner, status, source_agent, created_at
       FROM planning_risk_records
       WHERE session_id = ?
       ORDER BY id ASC`,
      [sessionId]
    )

    return {
      ...session,
      planning_context: parseJson(session.planning_context, {}),
      selected_agents: parseJson(session.selected_agents, []),
      final_summary: parseJson(session.final_summary, null),
      outputs: outputs.map((row) => ({ ...row, output_json: parseJson(row.output_json, {}) })),
      decisions: decisions.map((row) => ({
        ...row,
        original_output_json: parseJson(row.original_output_json, null),
        final_output_json: parseJson(row.final_output_json, null)
      })),
      dependencies,
      estimates: estimates.map((row) => ({ ...row, assumptions: parseJson(row.assumptions, null) })),
      architectureNotes: architectureNotes.map((row) => ({
        ...row,
        impacted_components: parseJson(row.impacted_components, []),
        assumptions: parseJson(row.assumptions, []),
        constraints: parseJson(row.constraints, []),
        technical_enablers: parseJson(row.technical_enablers, []),
        architecture_risks: parseJson(row.architecture_risks, []),
        recommended_actions: parseJson(row.recommended_actions, [])
      })),
      risks
    }
  })
}

export async function listPlanningSessions(limit = 50) {
  return withDb(async (db) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 300))
    return dbAll(
      db,
      `SELECT id, title, team_id, team_name, sprint_id, sprint_name, status, selected_agents, created_by, finalized_by, finalized_at, created_at
       FROM planning_sessions
       ORDER BY created_at DESC
       LIMIT ?`,
      [safeLimit]
    )
  })
}

export async function createScenarioRun({
  runId,
  scenario,
  participantId,
  participantRole,
  instructions,
  syntheticData
}) {
  return withDb(async (db) => {
    await dbRun(
      db,
      `INSERT INTO planning_scenario_runs (
        id,
        scenario_key,
        scenario_name,
        participant_id,
        participant_role,
        instructions,
        synthetic_data,
        started_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        runId,
        scenario.key,
        scenario.name,
        participantId || null,
        participantRole || null,
        instructions || null,
        asJson(syntheticData || {}),
        nowIso(),
        nowIso()
      ]
    )
  })
}

export async function updateScenarioRun(runId, fields = {}) {
  return withDb(async (db) => {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined)
    if (!entries.length) return
    const sets = entries.map(([k]) => `${k} = ?`).join(', ')
    const values = entries.map(([, v]) => v)
    values.push(runId)
    await dbRun(db, `UPDATE planning_scenario_runs SET ${sets} WHERE id = ?`, values)
  })
}

export async function saveScenarioInteraction({ runId, recommendationId, action, actor, notes }) {
  return withDb(async (db) => {
    await dbRun(
      db,
      `INSERT INTO planning_scenario_interactions (
        run_id,
        recommendation_id,
        action,
        actor,
        notes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [runId, recommendationId || null, action || null, actor || null, notes || null, nowIso()]
    )
  })
}

export async function getScenarioRuns(limit = 200) {
  return withDb(async (db) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 2000))
    const runs = await dbAll(
      db,
      `SELECT * FROM planning_scenario_runs ORDER BY created_at DESC LIMIT ?`,
      [safeLimit]
    )

    const interactions = await dbAll(
      db,
      `SELECT * FROM planning_scenario_interactions ORDER BY created_at DESC LIMIT ?`,
      [safeLimit * 5]
    )

    const byRun = new Map()
    for (const row of interactions) {
      const current = byRun.get(row.run_id) || []
      current.push(row)
      byRun.set(row.run_id, current)
    }

    return runs.map((row) => ({
      ...row,
      synthetic_data: parseJson(row.synthetic_data, {}),
      interactions: byRun.get(row.id) || []
    }))
  })
}
