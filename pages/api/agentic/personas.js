import fs from 'fs'
import path from 'path'
import { requireAdmin } from '../_lib/auth'

const personaPath = path.join(process.cwd(), 'data', 'agentic', 'personas.json')
const requiredCoreKeys = ['orchestrator', 'demand', 'requirement']

const fallbackPersonas = [
  {
    key: 'orchestrator',
    name: 'Agentic AI_Orcastration',
    personaTitle: 'Brain Orchestrator',
    model: 'qwen3:4b',
    active: true,
    description: 'Controls the end-to-end SDLC flow, validates outputs from other personas, and decides approvals/rejections.',
    systemInstruction: 'You are Agentic AI_Orcastration (Brain). Manage SDLC transitions, enforce governance, create/fix prompts for VS Code and Copilot workflows when needed, and ensure each stage has traceable outcomes.'
  },
  {
    key: 'demand',
    name: 'Agentic AI_Demand',
    personaTitle: 'Demander',
    model: 'qwen3:4b',
    active: true,
    description: 'Analyzes approved business requests and drafts demand details including scope, budget, risks, and timeline.',
    systemInstruction: 'You are Agentic AI_Demand. Analyze approved business requests and produce a structured demand package with scope, assumptions, constraints, budget range, timeline, risks, and success criteria.'
  },
  {
    key: 'requirement',
    name: 'Agentic AI_Requirement',
    personaTitle: 'Business Analyst',
    model: 'qwen3:4b',
    active: true,
    description: 'Creates and updates BRD content based on approved demand and orchestrator feedback.',
    systemInstruction: 'You are Agentic AI_Requirement (Senior Business Analyst). Draft clear BRD content, acceptance criteria, and traceability aligned to approved demand outcomes and review comments.'
  }
]

function ensureFile() {
  const dir = path.dirname(personaPath)
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(personaPath)) {
    fs.writeFileSync(personaPath, JSON.stringify(fallbackPersonas, null, 2), 'utf-8')
  }
}

function loadPersonas() {
  ensureFile()
  try {
    const content = fs.readFileSync(personaPath, 'utf-8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : fallbackPersonas
  } catch {
    return fallbackPersonas
  }
}

function savePersonas(personas) {
  ensureFile()
  fs.writeFileSync(personaPath, JSON.stringify(personas, null, 2), 'utf-8')
}

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sanitizePersona(input) {
  const name = String(input?.name || '').trim()
  const keyFromName = toSlug(name)
  return {
    key: toSlug(input?.key || '') || keyFromName,
    name,
    personaTitle: String(input?.personaTitle || '').trim(),
    model: String(input?.model || 'qwen3:4b').trim(),
    active: input?.active !== false,
    description: String(input?.description || '').trim(),
    systemInstruction: String(input?.systemInstruction || '').trim()
  }
}

function validatePersonaSet(personas) {
  if (!Array.isArray(personas) || personas.length === 0) {
    return 'Invalid personas payload'
  }

  if (personas.some((p) => !p.key || !p.name || !p.personaTitle)) {
    return 'Persona key/name/title are required'
  }

  const keys = personas.map((p) => p.key)
  const uniqueCount = new Set(keys).size
  if (uniqueCount !== keys.length) {
    return 'Persona keys must be unique'
  }

  const missingCore = requiredCoreKeys.filter((key) => !keys.includes(key))
  if (missingCore.length) {
    return `Missing required core personas: ${missingCore.join(', ')}`
  }

  return null
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ personas: loadPersonas() })
  }

  if (req.method === 'POST') {
    const adminSession = requireAdmin(req, res)
    if (!adminSession) return

    const { persona } = req.body || {}
    if (!persona || typeof persona !== 'object') {
      return res.status(400).json({ message: 'Invalid persona payload' })
    }

    const existing = loadPersonas()
    const sanitizedNew = sanitizePersona(persona)
    if (!sanitizedNew.key || !sanitizedNew.name || !sanitizedNew.personaTitle) {
      return res.status(400).json({ message: 'Persona key/name/title are required' })
    }
    if (existing.some((p) => p.key === sanitizedNew.key)) {
      return res.status(409).json({ message: `Persona key already exists: ${sanitizedNew.key}` })
    }

    const merged = [...existing.map(sanitizePersona), sanitizedNew]
    const validationError = validatePersonaSet(merged)
    if (validationError) {
      return res.status(400).json({ message: validationError })
    }

    savePersonas(merged)
    return res.status(201).json({ success: true, personas: merged })
  }

  if (req.method === 'PUT') {
    const adminSession = requireAdmin(req, res)
    if (!adminSession) return

    const { personas } = req.body || {}
    const sanitized = Array.isArray(personas) ? personas.map(sanitizePersona) : null
    const validationError = validatePersonaSet(sanitized)
    if (validationError) {
      return res.status(400).json({ message: validationError })
    }

    savePersonas(sanitized)
    return res.status(200).json({ success: true, personas: sanitized })
  }

  if (req.method === 'DELETE') {
    const adminSession = requireAdmin(req, res)
    if (!adminSession) return

    const { key } = req.body || {}
    const targetKey = toSlug(key)
    if (!targetKey) {
      return res.status(400).json({ message: 'Persona key is required' })
    }
    if (requiredCoreKeys.includes(targetKey)) {
      return res.status(400).json({ message: `Cannot delete core persona: ${targetKey}` })
    }

    const existing = loadPersonas()
    if (!existing.some((p) => p.key === targetKey)) {
      return res.status(404).json({ message: 'Persona not found' })
    }

    const filtered = existing.filter((p) => p.key !== targetKey).map(sanitizePersona)
    const validationError = validatePersonaSet(filtered)
    if (validationError) {
      return res.status(400).json({ message: validationError })
    }

    savePersonas(filtered)
    return res.status(200).json({ success: true, personas: filtered })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
