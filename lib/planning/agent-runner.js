import { PLANNING_AGENT_KEYS } from './constants'
import { getPersonaByKey, loadPersonas } from './planning-core'
import {
  saveArchitectureNote,
  saveDependencyRecords,
  saveEstimationDecisions,
  savePlanningAgentOutput,
  saveRiskRecords,
  updatePlanningSession,
  writePlanningLog
} from './planning-db'
import { runProductOwnerAssistant } from './services/product-owner-assistant'
import { runEstimationAdvisor } from './services/estimation-advisor'
import { runDependencyAnalyst } from './services/dependency-analyst'
import { runArchitectAdvisor } from './services/architect-advisor'
import { runRiskAnalyst } from './services/risk-analyst'

const serviceMap = {
  product_owner_assistant: runProductOwnerAssistant,
  estimation_advisor: runEstimationAdvisor,
  dependency_analyst: runDependencyAnalyst,
  architect_advisor: runArchitectAdvisor,
  risk_analyst: runRiskAnalyst
}

function normalizeAgentKey(agentKey) {
  return String(agentKey || '').trim().toLowerCase()
}

function ensureAgentKey(agentKey) {
  const key = normalizeAgentKey(agentKey)
  if (!PLANNING_AGENT_KEYS.includes(key)) {
    throw new Error(`Unsupported planning agent: ${agentKey}`)
  }
  return key
}

export async function runSinglePlanningAgent({ agentKey, planningContext, sessionId, actor }) {
  const key = ensureAgentKey(agentKey)
  const personas = loadPersonas()
  const persona = getPersonaByKey(personas, key)

  if (!persona || persona.active === false) {
    throw new Error(`Persona ${key} is missing or disabled`)
  }

  const runner = serviceMap[key]
  if (!runner) {
    throw new Error(`Service not implemented for ${key}`)
  }

  await writePlanningLog({
    sessionId,
    stage: 'Planning',
    actor: persona.name || key,
    message: `${key} started`,
    eventType: 'info',
    details: {
      triggeredBy: actor,
      model: persona.model
    }
  })

  const result = await runner({ persona, planningContext })

  const outputId = await savePlanningAgentOutput({
    sessionId,
    agentKey: key,
    output: result.output,
    actor,
    confidence: result.output?.confidence
  })

  if (key === 'dependency_analyst') {
    await saveDependencyRecords(sessionId, result.output?.artifacts?.dependencies || [])
  }

  if (key === 'estimation_advisor') {
    const estimates = Array.isArray(result.output?.artifacts?.estimates)
      ? result.output.artifacts.estimates
      : []

    await saveEstimationDecisions(
      sessionId,
      estimates.map((item) => ({
        backlog_item_id: item.backlog_item_id,
        backlog_item_title: item.backlog_item_title,
        ai_estimate: item.ai_estimate,
        final_estimate: null,
        confidence: item.confidence,
        assumptions: item.assumptions || []
      })),
      actor
    )
  }

  if (key === 'architect_advisor') {
    await saveArchitectureNote(sessionId, result.output?.artifacts?.architecture_note || {}, outputId)
  }

  if (key === 'risk_analyst') {
    await saveRiskRecords(sessionId, result.output?.artifacts?.risk_register || [], key)
  }

  await writePlanningLog({
    sessionId,
    stage: 'Planning',
    actor: persona.name || key,
    message: `${key} completed`,
    eventType: result.warning ? 'warning' : 'success',
    details: {
      triggeredBy: actor,
      modelUsed: result.modelUsed,
      warning: result.warning,
      outputId
    }
  })

  return {
    id: outputId,
    agent_key: key,
    model_used: result.modelUsed,
    warning: result.warning,
    output: result.output
  }
}

export async function runSelectedPlanningAgents({ sessionId, selectedAgents, planningContext, actor }) {
  const keys = (Array.isArray(selectedAgents) && selectedAgents.length
    ? selectedAgents
    : PLANNING_AGENT_KEYS
  ).map((k) => ensureAgentKey(k))

  const outputs = []
  for (const key of keys) {
    const output = await runSinglePlanningAgent({
      agentKey: key,
      planningContext,
      sessionId,
      actor
    })
    outputs.push(output)
  }

  await updatePlanningSession(sessionId, {
    status: 'agents_completed'
  })

  return outputs
}
