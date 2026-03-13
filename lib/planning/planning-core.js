import fs from 'fs'
import path from 'path'
import { PLANNING_OUTPUT_TEMPLATE, ARCHITECTURE_NOTE_TEMPLATE } from './constants'

const personaPath = path.join(process.cwd(), 'data', 'agentic', 'personas.json')

const planningPersonaFallbacks = {
  product_owner_assistant: {
    key: 'product_owner_assistant',
    name: 'Product Owner Assistant',
    model: 'qwen3:4b',
    systemInstruction:
      'Prioritize backlog and assess readiness for sprint planning with clear rationale and confidence.'
  },
  estimation_advisor: {
    key: 'estimation_advisor',
    name: 'Estimation Advisor',
    model: 'qwen3:4b',
    systemInstruction:
      'Recommend story points with assumptions, capacity check, and low-confidence flags.'
  },
  dependency_analyst: {
    key: 'dependency_analyst',
    name: 'Dependency Analyst',
    model: 'qwen3:4b',
    systemInstruction:
      'Detect dependency links, sequencing blockers, and mitigations for sprint feasibility.'
  },
  architect_advisor: {
    key: 'architect_advisor',
    name: 'Architect Advisor',
    model: 'qwen3:4b',
    systemInstruction:
      'Identify architecture impact, technical enablers, constraints, and solution intent notes.'
  },
  risk_analyst: {
    key: 'risk_analyst',
    name: 'Risk Analyst',
    model: 'qwen3:4b',
    systemInstruction:
      'Produce governance-friendly sprint risk register with probability, impact, and mitigation.'
  }
}

function unique(items) {
  return Array.from(new Set((items || []).filter(Boolean)))
}

function asText(value, max = 4000) {
  if (value === null || value === undefined) return ''
  return String(value).trim().slice(0, max)
}

function asArray(value, max = 30) {
  if (!Array.isArray(value)) return []
  return value.map((v) => asText(v, 500)).filter(Boolean).slice(0, max)
}

function toConfidence(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0.6
  if (num > 1) return Math.max(0, Math.min(1, num / 100))
  return Math.max(0, Math.min(1, num))
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
    try {
      return JSON.parse(trimmed.slice(first, last + 1))
    } catch {
      return null
    }
  }

  return null
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

export function loadPersonas() {
  try {
    if (!fs.existsSync(personaPath)) return []
    const parsed = JSON.parse(fs.readFileSync(personaPath, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getPersonaByKey(personas, key) {
  const found = (personas || []).find((p) => p.key === key)
  if (found) return found
  return planningPersonaFallbacks[key] || null
}

export function buildPlanningFallback(agentKey, planningContext) {
  const backlogItems = Array.isArray(planningContext?.backlogItems) ? planningContext.backlogItems : []
  const firstItems = backlogItems.slice(0, 3).map((i) => i.title || i.id || 'Backlog Item')

  const base = {
    ...PLANNING_OUTPUT_TEMPLATE,
    agent_key: agentKey,
    summary: `Fallback analysis generated for ${agentKey}`,
    recommendations: firstItems.length
      ? firstItems.map((item, idx) => `${idx + 1}. Review and refine ${item}`)
      : ['Review backlog readiness and clarify acceptance criteria.'],
    rationale:
      'Generated from deterministic fallback logic because model output was unavailable or unparsable.',
    confidence: 0.55,
    risks: ['Model unavailable or response parsing failed for this run.'],
    follow_up_questions: ['What assumptions should be validated before sprint commitment?'],
    artifacts: {}
  }

  if (agentKey === 'architect_advisor') {
    base.artifacts = {
      architecture_note: {
        ...ARCHITECTURE_NOTE_TEMPLATE,
        impacted_components: ['API', 'UI'],
        technical_enablers: ['Integration contract validation'],
        recommended_actions: ['Review architecture impact in refinement session'],
        rationale: 'Fallback architecture note generated due to unavailable model output.'
      }
    }
  }

  if (agentKey === 'risk_analyst') {
    base.artifacts = {
      risk_register: [
        {
          risk_id: 'RISK-FALLBACK-001',
          title: 'Unvalidated assumptions',
          description: 'Assumptions were not fully validated before planning commitment.',
          category: 'Planning',
          probability: 'Medium',
          impact: 'Medium',
          severity: 'Medium',
          mitigation: 'Run clarification workshop before sprint commitment.',
          owner: 'Product Owner',
          status: 'Open'
        }
      ]
    }
  }

  return base
}

export function normalizePlanningOutput(agentKey, rawOutput) {
  const source = rawOutput && typeof rawOutput === 'object' ? rawOutput : {}
  const output = {
    ...PLANNING_OUTPUT_TEMPLATE,
    agent_key: asText(source.agent_key || agentKey, 80) || agentKey,
    summary: asText(source.summary || `${agentKey} analysis completed`, 2000),
    recommendations: asArray(source.recommendations, 50),
    rationale: asText(source.rationale || 'No rationale provided', 3000),
    confidence: toConfidence(source.confidence),
    risks: asArray(source.risks, 50),
    follow_up_questions: asArray(source.follow_up_questions, 30),
    artifacts: source.artifacts && typeof source.artifacts === 'object' ? source.artifacts : {}
  }

  if (agentKey === 'architect_advisor') {
    const note = output.artifacts?.architecture_note
    if (!note || typeof note !== 'object') {
      output.artifacts.architecture_note = { ...ARCHITECTURE_NOTE_TEMPLATE }
    } else {
      output.artifacts.architecture_note = {
        impacted_components: asArray(note.impacted_components, 50),
        assumptions: asArray(note.assumptions, 50),
        constraints: asArray(note.constraints, 50),
        technical_enablers: asArray(note.technical_enablers, 50),
        architecture_risks: asArray(note.architecture_risks, 50),
        recommended_actions: asArray(note.recommended_actions, 50),
        rationale: asText(note.rationale, 3000)
      }
    }
  }

  if (agentKey === 'risk_analyst') {
    const register = Array.isArray(output.artifacts?.risk_register) ? output.artifacts.risk_register : []
    output.artifacts.risk_register = register
      .map((risk, idx) => ({
        risk_id: asText(risk?.risk_id || `RISK-${String(idx + 1).padStart(3, '0')}`, 80),
        title: asText(risk?.title || 'Risk item', 200),
        description: asText(risk?.description, 1000),
        category: asText(risk?.category || 'General', 100),
        probability: asText(risk?.probability || 'Medium', 40),
        impact: asText(risk?.impact || 'Medium', 40),
        severity: asText(risk?.severity || 'Medium', 40),
        mitigation: asText(risk?.mitigation, 1000),
        owner: asText(risk?.owner || 'Team', 120),
        status: asText(risk?.status || 'Open', 40)
      }))
      .slice(0, 100)
  }

  return output
}

export async function runPersonaModel({ persona, prompt, fallback }) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  const timeoutMs = Number(process.env.OLLAMA_MODEL_TIMEOUT_MS || 45000)
  const maxAttempts = Number(process.env.OLLAMA_MAX_MODEL_ATTEMPTS || 4)

  const available = await getOllamaModels(baseUrl)
  const envFallbacks = String(process.env.OLLAMA_MODEL_FALLBACKS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  const candidates = unique([
    persona?.model,
    process.env.OLLAMA_MODEL,
    ...envFallbacks,
    'qwen3:4b',
    'qwen3:8b',
    'llama3.1',
    'llama3'
  ])

  const orderedCandidates = available.length
    ? unique([...candidates.filter((m) => available.includes(m)), ...available])
    : candidates

  let lastError = 'No model attempted'

  for (const model of orderedCandidates.slice(0, maxAttempts)) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { temperature: 0.2 }
        })
      })

      clearTimeout(timeout)
      const text = await response.text()
      const parsed = tryParseJson(text) || (() => {
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      })()

      if (!response.ok) {
        lastError = parsed?.error || parsed?.message || text || `OLLAMA error ${response.status}`
        continue
      }

      const modelResponse = parsed?.response || text
      const json = tryParseJson(modelResponse)
      if (!json) {
        lastError = 'Model returned non-JSON content'
        continue
      }

      return {
        ok: true,
        modelUsed: model,
        output: json,
        warning: null
      }
    } catch (err) {
      clearTimeout(timeout)
      lastError = err?.name === 'AbortError'
        ? `Timed out after ${timeoutMs}ms for model ${model}`
        : String(err?.message || err)
    }
  }

  return {
    ok: false,
    modelUsed: 'fallback-template',
    output: fallback,
    warning: lastError
  }
}
