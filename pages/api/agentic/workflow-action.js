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
const teamSetupPath = path.join(process.cwd(), 'data', 'team-setup.json')

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

function loadTeamSetup() {
  if (!fs.existsSync(teamSetupPath)) return null
  try {
    return JSON.parse(fs.readFileSync(teamSetupPath, 'utf-8'))
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

function getSelfBaseUrl(req) {
  const protoHeader = req.headers['x-forwarded-proto']
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : (protoHeader || 'http')
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  return `${proto}://${host}`
}

async function postLocalJson({ req, apiPath, payload, timeoutMs = 180000 }) {
  const baseUrl = getSelfBaseUrl(req)
  const response = await withTimeout(
    () => fetch(`${baseUrl}${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }),
    timeoutMs,
    `${apiPath} request`
  )

  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!response.ok) {
    throw new Error(json?.message || json?.error || text || `Request failed (${response.status})`)
  }

  return json || {}
}

function resolveTeamAndSprint(br, overrides = {}) {
  const setup = loadTeamSetup()
  const teamOverride = String(overrides.teamName || '').trim()
  const sprintOverride = String(overrides.sprintName || '').trim()
  const fromBrTeam = String(br?.team_name || '').trim()
  const fromBrSprint = String(br?.sprint_name || '').trim()

  const teamName = teamOverride || fromBrTeam || String(setup?.teams?.[0]?.name || '').trim()
  const sprintName = sprintOverride || fromBrSprint || String(setup?.sprints?.[0]?.name || '').trim()

  return {
    teamName: teamName || null,
    sprintName: sprintName || null
  }
}

function priorityWeight(priority) {
  const normalized = String(priority || '').toLowerCase()
  if (normalized.includes('high')) return 1.3
  if (normalized.includes('low')) return 0.8
  return 1
}

function calculateStoryPointMetrics(backlog) {
  const features = Array.isArray(backlog?.features) ? backlog.features : []
  const stories = Array.isArray(backlog?.userStories) ? backlog.userStories : []
  const featureWeight = new Map(features.map((feature) => [feature.title, priorityWeight(feature.priority)]))

  let totalPoints = 0
  let weightedPoints = 0
  for (const story of stories) {
    const points = Number(story?.points || 0) || 0
    const explicitWeight = Number(story?.weight || 0)
    const weight = explicitWeight > 0 ? explicitWeight : (featureWeight.get(story?.feature) || 1)
    totalPoints += points
    weightedPoints += points * weight
  }

  return {
    totalPoints,
    weightedPoints: Number(weightedPoints.toFixed(2))
  }
}

function buildAdoUrls(config, teamName) {
  if (!config?.organization || !config?.project) {
    return {
      backlogUrl: null,
      boardUrl: null,
      sprintsUrl: null,
      dashboardsUrl: null
    }
  }

  const org = encodeURIComponent(config.organization)
  const project = encodeURIComponent(config.project)
  const teamSegment = teamName ? `/t/${encodeURIComponent(teamName)}` : ''

  return {
    backlogUrl: `https://dev.azure.com/${org}/${project}/_backlogs/backlog`,
    boardUrl: `https://dev.azure.com/${org}/${project}/_boards/board${teamSegment}`,
    sprintsUrl: `https://dev.azure.com/${org}/${project}/_sprints`,
    dashboardsUrl: `https://dev.azure.com/${org}/${project}/_dashboards`
  }
}

function parseJsonObject(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const DEFAULT_PI_NAME = 'PI-2026-Q1'
const DEFAULT_ART_NAME = 'Digital ART'
const DEFAULT_CAPACITY_GUARDRAILS = {
  business: 60,
  enabler: 20,
  defectRisk: 20
}

function safeBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return fallback
}

function normalizeCapacityGuardrails(value) {
  const parsed = parseJsonObject(value)
  const normalized = {
    business: Number(parsed.business ?? parsed.businessPercent ?? DEFAULT_CAPACITY_GUARDRAILS.business) || 0,
    enabler: Number(parsed.enabler ?? parsed.enablerPercent ?? DEFAULT_CAPACITY_GUARDRAILS.enabler) || 0,
    defectRisk: Number(parsed.defectRisk ?? parsed.defect_risk ?? parsed.defectRiskPercent ?? DEFAULT_CAPACITY_GUARDRAILS.defectRisk) || 0,
    maxDeviation: Number(parsed.maxDeviation ?? parsed.max_deviation ?? 35) || 35
  }

  return {
    ...normalized,
    total: Number((normalized.business + normalized.enabler + normalized.defectRisk).toFixed(2))
  }
}

function inferWorkType(featureOrStory) {
  const text = String(
    featureOrStory?.workType ||
    `${featureOrStory?.title || ''} ${featureOrStory?.description || ''} ${featureOrStory?.feature || ''}`
  ).toLowerCase()

  if (text.includes('defect') || text.includes('risk') || text.includes('compliance') || text.includes('audit') || text.includes('bug')) {
    return 'Defect-Risk'
  }
  if (text.includes('enabler') || text.includes('platform') || text.includes('architecture') || text.includes('automation') || text.includes('infra')) {
    return 'Enabler'
  }
  return 'Business'
}

function mapPriorityToBusinessValue(priority) {
  const normalized = String(priority || '').toLowerCase()
  if (normalized.includes('high')) return 20
  if (normalized.includes('low')) return 8
  return 13
}

function mapUrgencyToTimeCriticality(urgency) {
  const normalized = String(urgency || '').toLowerCase()
  if (normalized.includes('high')) return 20
  if (normalized.includes('low')) return 8
  return 13
}

function enrichBacklogWithSafeMetrics(backlog, br) {
  const features = Array.isArray(backlog?.features) ? [...backlog.features] : []
  const stories = Array.isArray(backlog?.userStories) ? [...backlog.userStories] : []
  const urgencyScore = mapUrgencyToTimeCriticality(br?.urgency)

  const storiesByFeature = new Map()
  for (const story of stories) {
    const key = String(story?.feature || '').trim()
    if (!storiesByFeature.has(key)) storiesByFeature.set(key, [])
    storiesByFeature.get(key).push(story)
  }

  const wsjfRankings = features.map((feature) => {
    const featureStories = storiesByFeature.get(String(feature?.title || '').trim()) || []
    const points = featureStories.reduce((sum, story) => sum + (Number(story?.points || 0) || 0), 0)
    const workType = inferWorkType(feature)
    const wsjfInput = parseJsonObject(feature?.wsjf)
    const businessValue = Number(wsjfInput.businessValue ?? feature?.businessValueScore ?? mapPriorityToBusinessValue(feature?.priority)) || 0
    const timeCriticality = Number(wsjfInput.timeCriticality ?? feature?.timeCriticality ?? urgencyScore) || 0
    const riskReductionOpportunity = Number(
      wsjfInput.riskReductionOpportunity ??
      feature?.riskReductionOpportunity ??
      (workType === 'Defect-Risk' ? 13 : (workType === 'Enabler' ? 8 : 5))
    ) || 0
    const jobSize = Number(wsjfInput.jobSize ?? feature?.jobSize ?? Math.max(3, Math.round(points || featureStories.length || 3))) || 1
    const wsjfScore = Number(((businessValue + timeCriticality + riskReductionOpportunity) / Math.max(jobSize, 1)).toFixed(2))

    return {
      featureTitle: feature?.title,
      workType,
      businessValue,
      timeCriticality,
      riskReductionOpportunity,
      jobSize,
      wsjfScore
    }
  })

  const wsjfByFeature = new Map(wsjfRankings.map((item) => [String(item.featureTitle || ''), item]))
  const orderedFeatures = [...features].sort((a, b) => {
    const scoreA = wsjfByFeature.get(String(a?.title || ''))?.wsjfScore || 0
    const scoreB = wsjfByFeature.get(String(b?.title || ''))?.wsjfScore || 0
    return scoreB - scoreA
  })

  const featureRank = new Map(orderedFeatures.map((feature, index) => [String(feature?.title || ''), index]))
  const orderedStories = [...stories]
    .map((story) => {
      const workType = inferWorkType({ ...story, workType: wsjfByFeature.get(String(story?.feature || ''))?.workType })
      const score = wsjfByFeature.get(String(story?.feature || ''))?.wsjfScore || 0
      return {
        ...story,
        workType,
        wsjfScore: score,
        dependencies: Array.isArray(story?.dependencies) ? story.dependencies : []
      }
    })
    .sort((a, b) => {
      const rankA = featureRank.get(String(a?.feature || '')) ?? 999
      const rankB = featureRank.get(String(b?.feature || '')) ?? 999
      if (rankA !== rankB) return rankA - rankB
      return (Number(b?.points || 0) || 0) - (Number(a?.points || 0) || 0)
    })

  // Inject lightweight dependency chains to support dashboard heatmap metrics.
  const perFeatureChain = new Map()
  for (const story of orderedStories) {
    const key = String(story?.feature || '').trim()
    if (!perFeatureChain.has(key)) perFeatureChain.set(key, [])
    perFeatureChain.get(key).push(story)
  }
  for (const featureStories of perFeatureChain.values()) {
    for (let i = 1; i < featureStories.length; i++) {
      const current = featureStories[i]
      if (Array.isArray(current.dependencies) && current.dependencies.length > 0) continue
      const previous = featureStories[i - 1]
      current.dependencies = [
        {
          type: 'Blocks',
          story: previous?.title,
          crossTeam: i % 3 === 0,
          ageDays: 2 + (i * 2)
        }
      ]
    }
  }

  const dependencyLinks = orderedStories.flatMap((story) =>
    (story.dependencies || []).map((dep) => ({
      ...dep,
      sourceStory: story.title,
      ageDays: Number(dep?.ageDays || 0) || 0,
      crossTeam: Boolean(dep?.crossTeam)
    }))
  )

  const dependencyMetrics = {
    blockedStories: orderedStories.filter((story) => (story.dependencies || []).length > 0).length,
    crossTeamLinks: dependencyLinks.filter((dep) => dep.crossTeam).length,
    agingBlockers: dependencyLinks.filter((dep) => dep.ageDays >= 7).length
  }
  dependencyMetrics.heatScore = Number(
    (dependencyMetrics.blockedStories * 2 + dependencyMetrics.crossTeamLinks * 3 + dependencyMetrics.agingBlockers * 4).toFixed(2)
  )

  const workTypePoints = orderedStories.reduce((acc, story) => {
    const bucket = story.workType === 'Enabler'
      ? 'enabler'
      : story.workType === 'Defect-Risk'
        ? 'defectRisk'
        : 'business'
    const points = Number(story?.points || 0) || 0
    acc[bucket] += points
    return acc
  }, { business: 0, enabler: 0, defectRisk: 0 })
  const totalPoints = Number((workTypePoints.business + workTypePoints.enabler + workTypePoints.defectRisk).toFixed(2))
  const capacityActual = {
    ...workTypePoints,
    totalPoints,
    businessPercent: totalPoints > 0 ? Number(((workTypePoints.business / totalPoints) * 100).toFixed(2)) : 0,
    enablerPercent: totalPoints > 0 ? Number(((workTypePoints.enabler / totalPoints) * 100).toFixed(2)) : 0,
    defectRiskPercent: totalPoints > 0 ? Number(((workTypePoints.defectRisk / totalPoints) * 100).toFixed(2)) : 0
  }

  const enrichedFeatures = orderedFeatures.map((feature) => {
    const ranking = wsjfByFeature.get(String(feature?.title || ''))
    return {
      ...feature,
      workType: ranking?.workType || inferWorkType(feature),
      wsjf: ranking
        ? {
          businessValue: ranking.businessValue,
          timeCriticality: ranking.timeCriticality,
          riskReductionOpportunity: ranking.riskReductionOpportunity,
          jobSize: ranking.jobSize,
          score: ranking.wsjfScore
        }
        : undefined,
      wsjfScore: ranking?.wsjfScore || 0
    }
  })

  return {
    backlog: {
      ...backlog,
      features: enrichedFeatures,
      userStories: orderedStories
    },
    wsjfSummary: {
      rankedAt: nowIso(),
      totalFeatures: wsjfRankings.length,
      rankings: wsjfRankings.sort((a, b) => b.wsjfScore - a.wsjfScore)
    },
    dependencyMetrics,
    capacityActual
  }
}

function buildSafeControls(br, overrides = {}) {
  const piName = String(overrides?.piName || br?.safe_pi_name || DEFAULT_PI_NAME).trim()
  const artName = String(overrides?.artName || br?.safe_art_name || DEFAULT_ART_NAME).trim()

  const dorDefaults = {
    brdApproved: String(br?.requirement_review_status || '').toLowerCase() === 'approved',
    wsjfRanked: true,
    dependenciesReviewed: true,
    capacityPlanned: true,
    architectureRunwayReady: true,
    nfrAligned: true
  }

  const dodDefaults = {
    acceptanceCriteriaReady: String(br?.user_story_status || '').toLowerCase().includes('created'),
    testEvidenceReady: String(br?.task_status || '').toLowerCase().includes('created'),
    releasePlanReady: String(br?.sprint_status || '').toLowerCase().includes('prepared'),
    observabilityReady: false,
    securityReviewComplete: false,
    opsHandoverReady: false
  }

  const storedDor = parseJsonObject(br?.safe_dor_checks)
  const storedDod = parseJsonObject(br?.safe_dod_checks)
  const overrideDor = parseJsonObject(overrides?.dorChecks)
  const overrideDod = parseJsonObject(overrides?.dodChecks)
  const storedCapacity = normalizeCapacityGuardrails(br?.safe_capacity_guardrails)
  const overrideCapacity = overrides?.capacityGuardrails
    ? normalizeCapacityGuardrails(overrides.capacityGuardrails)
    : null

  const dorChecks = {
    brdApproved: safeBool(overrideDor.brdApproved, safeBool(storedDor.brdApproved, dorDefaults.brdApproved)),
    wsjfRanked: safeBool(overrideDor.wsjfRanked, safeBool(storedDor.wsjfRanked, dorDefaults.wsjfRanked)),
    dependenciesReviewed: safeBool(overrideDor.dependenciesReviewed, safeBool(storedDor.dependenciesReviewed, dorDefaults.dependenciesReviewed)),
    capacityPlanned: safeBool(overrideDor.capacityPlanned, safeBool(storedDor.capacityPlanned, dorDefaults.capacityPlanned)),
    architectureRunwayReady: safeBool(overrideDor.architectureRunwayReady, safeBool(storedDor.architectureRunwayReady, dorDefaults.architectureRunwayReady)),
    nfrAligned: safeBool(overrideDor.nfrAligned, safeBool(storedDor.nfrAligned, dorDefaults.nfrAligned))
  }

  const dodChecks = {
    acceptanceCriteriaReady: safeBool(overrideDod.acceptanceCriteriaReady, safeBool(storedDod.acceptanceCriteriaReady, dodDefaults.acceptanceCriteriaReady)),
    testEvidenceReady: safeBool(overrideDod.testEvidenceReady, safeBool(storedDod.testEvidenceReady, dodDefaults.testEvidenceReady)),
    releasePlanReady: safeBool(overrideDod.releasePlanReady, safeBool(storedDod.releasePlanReady, dodDefaults.releasePlanReady)),
    observabilityReady: safeBool(overrideDod.observabilityReady, safeBool(storedDod.observabilityReady, dodDefaults.observabilityReady)),
    securityReviewComplete: safeBool(overrideDod.securityReviewComplete, safeBool(storedDod.securityReviewComplete, dodDefaults.securityReviewComplete)),
    opsHandoverReady: safeBool(overrideDod.opsHandoverReady, safeBool(storedDod.opsHandoverReady, dodDefaults.opsHandoverReady))
  }

  const capacityGuardrails = overrideCapacity || storedCapacity || {
    ...DEFAULT_CAPACITY_GUARDRAILS,
    total: 100
  }

  return {
    piName: piName || DEFAULT_PI_NAME,
    artName: artName || DEFAULT_ART_NAME,
    dorChecks,
    dodChecks,
    capacityGuardrails
  }
}

function validateDorGate({ controls, wsjfSummary, dependencyMetrics, capacityActual }) {
  const checks = {
    ...controls.dorChecks,
    wsjfRanked: Boolean(controls.dorChecks.wsjfRanked && Number(wsjfSummary?.totalFeatures || 0) > 0),
    dependenciesReviewed: Boolean(controls.dorChecks.dependenciesReviewed && dependencyMetrics),
    capacityPlanned: Boolean(controls.dorChecks.capacityPlanned && Number(capacityActual?.totalPoints || 0) > 0),
    architectureRunwayReady: Boolean(controls.dorChecks.architectureRunwayReady),
    nfrAligned: Boolean(controls.dorChecks.nfrAligned)
  }

  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key)
  return {
    passed: missing.length === 0,
    checks,
    missing
  }
}

function validateDodGate(controls) {
  const checks = Object.entries(controls.dodChecks || {}).reduce((acc, [key, value]) => {
    acc[key] = Boolean(value)
    return acc
  }, {})
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key)
  return {
    passed: missing.length === 0,
    checks,
    missing
  }
}

function validateCapacityGuardrails({ guardrails, capacityActual, maxDeviation = 35 }) {
  const effectiveDeviation = Number(guardrails?.maxDeviation ?? maxDeviation)
  const total = Number(guardrails?.total || 0)
  if (Math.abs(total - 100) > 0.2) {
    return {
      passed: false,
      reason: `Capacity guardrails must total 100 (current: ${total})`,
      deviations: []
    }
  }

  if (!capacityActual || Number(capacityActual.totalPoints || 0) <= 0) {
    return {
      passed: false,
      reason: 'No story point allocation available to validate capacity guardrails',
      deviations: []
    }
  }

  const deviations = [
    { key: 'business', target: Number(guardrails.business || 0), actual: Number(capacityActual.businessPercent || 0) },
    { key: 'enabler', target: Number(guardrails.enabler || 0), actual: Number(capacityActual.enablerPercent || 0) },
    { key: 'defectRisk', target: Number(guardrails.defectRisk || 0), actual: Number(capacityActual.defectRiskPercent || 0) }
  ].map((item) => ({
    ...item,
    deviation: Number(Math.abs(item.actual - item.target).toFixed(2))
  }))

  const failed = deviations.filter((item) => item.deviation > effectiveDeviation)
  return {
    passed: failed.length === 0,
    reason: failed.length > 0
      ? `Capacity allocation deviates beyond ${effectiveDeviation}% for: ${failed.map((x) => x.key).join(', ')}`
      : null,
    deviations,
    maxDeviation: effectiveDeviation
  }
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function evaluateAssignmentReadiness(syncSummary) {
  const summary = parseJsonObject(syncSummary)
  const metadata = parseJsonObject(summary?.adoMetadata)
  const coverage = parseJsonObject(metadata?.assignmentCoverage)
  const pool = unique(Array.isArray(coverage?.assigneePool) ? coverage.assigneePool : [])
  const byAssignee = coverage?.byAssignee && typeof coverage.byAssignee === 'object'
    ? coverage.byAssignee
    : {}

  const storiesTotal = finiteNumber(coverage?.storiesTotal, 0)
  const storiesAssigned = finiteNumber(coverage?.storiesAssigned, 0)
  const tasksTotal = finiteNumber(coverage?.tasksTotal, 0)
  const tasksAssigned = finiteNumber(coverage?.tasksAssigned, 0)
  const storiesAssignedRatio = storiesTotal > 0
    ? Number((storiesAssigned / storiesTotal).toFixed(2))
    : finiteNumber(coverage?.storiesAssignedRatio, 0)
  const tasksAssignedRatio = tasksTotal > 0
    ? Number((tasksAssigned / tasksTotal).toFixed(2))
    : finiteNumber(coverage?.tasksAssignedRatio, 0)
  const uniqueAssigneesUsed = Object.values(byAssignee).filter((row) => finiteNumber(row?.total, 0) > 0).length
  const expectedUniqueAssignees = pool.length > 1 ? 2 : 1

  const issues = []
  if (storiesTotal <= 0) {
    issues.push('No ADO user stories were created during backlog sync')
  }
  if (storiesAssignedRatio < 1) {
    issues.push(`Story assignment coverage is ${storiesAssigned}/${storiesTotal}`)
  }
  if (tasksTotal > 0 && tasksAssignedRatio < 1) {
    issues.push(`Task assignment coverage is ${tasksAssigned}/${tasksTotal}`)
  }
  if (pool.length <= 0) {
    issues.push('No assignable ADO assignee pool was resolved')
  }
  if (uniqueAssigneesUsed < expectedUniqueAssignees) {
    issues.push(`Assignment spread is ${uniqueAssigneesUsed} unique assignee(s), expected at least ${expectedUniqueAssignees}`)
  }

  return {
    passed: issues.length === 0,
    issues,
    assigneePool: pool,
    expectedUniqueAssignees,
    uniqueAssigneesUsed,
    storiesTotal,
    storiesAssigned,
    storiesAssignedRatio,
    tasksTotal,
    tasksAssigned,
    tasksAssignedRatio
  }
}

function evaluateSingleAssigneeFallback(readiness) {
  const state = parseJsonObject(readiness)
  const issues = Array.isArray(state?.issues) ? state.issues : []
  const onlySpreadIssue = issues.length === 1 && /assignment spread is \d+ unique assignee\(s\), expected at least \d+/i.test(String(issues[0] || ''))
  const uniqueAssigneesUsed = finiteNumber(state?.uniqueAssigneesUsed, 0)
  const expectedUniqueAssignees = finiteNumber(state?.expectedUniqueAssignees, 1)
  const storiesAssignedRatio = finiteNumber(state?.storiesAssignedRatio, 0)
  const tasksTotal = finiteNumber(state?.tasksTotal, 0)
  const tasksAssignedRatio = finiteNumber(state?.tasksAssignedRatio, 0)
  const tasksFullyAssigned = tasksTotal <= 0 || tasksAssignedRatio >= 1

  const allowed = Boolean(
    !state?.passed &&
    onlySpreadIssue &&
    uniqueAssigneesUsed === 1 &&
    expectedUniqueAssignees === 2 &&
    storiesAssignedRatio >= 1 &&
    tasksFullyAssigned
  )

  return {
    allowed,
    reason: allowed
      ? 'Single-assignee fallback applied because tenant policy blocks multi-user entitlement in ADO.'
      : null
  }
}

function formatCreationStatus(count, errorCount) {
  const safeCount = Number(count || 0)
  const safeErrors = Number(errorCount || 0)
  if (safeCount <= 0 && safeErrors > 0) return 'Failed'
  if (safeCount <= 0) return 'Not Created'
  return `${safeErrors > 0 ? 'Created with Warnings' : 'Created'} (${safeCount})`
}

async function reloadBusinessRequest(id) {
  return withDb(async (db) => {
    return dbGet(db, 'SELECT * FROM business_requests WHERE id = ?', [id])
  })
}

async function runBacklogSyncForBr({ req, id, br, operator, teamName, sprintName, piName, artName, dorChecks, dodChecks, capacityGuardrails }) {
  const approved = String(br?.requirement_review_status || '').toLowerCase() === 'approved'
  if (!approved) {
    throw new Error('BRD review must be approved before ADO backlog sync')
  }

  const resolved = resolveTeamAndSprint(br, { teamName, sprintName })
  const safeControls = buildSafeControls(br, {
    piName,
    artName,
    dorChecks,
    dodChecks,
    capacityGuardrails
  })

  await writeLog({
    id,
    stage: 'ADO Backlog Sync',
    actor: operator,
    eventType: 'info',
    message: 'Backlog hierarchy sync started',
    details: {
      teamName: resolved.teamName,
      sprintName: resolved.sprintName,
      piName: safeControls.piName,
      artName: safeControls.artName
    }
  })

  const backlogResponse = await postLocalJson({
    req,
    apiPath: '/api/scrum-master',
    payload: { brId: id },
    timeoutMs: 60000
  })
  const backlog = backlogResponse?.backlog || null
  if (!backlog) {
    throw new Error('Backlog generator returned no backlog payload')
  }

  const safeBacklog = enrichBacklogWithSafeMetrics(backlog, br)
  const enrichedBacklog = safeBacklog.backlog

  const pointMetrics = calculateStoryPointMetrics(enrichedBacklog)

  const adoSync = await postLocalJson({
    req,
    apiPath: '/api/create-ado-backlog',
    payload: {
      backlog: enrichedBacklog,
      teamName: resolved.teamName,
      sprintName: resolved.sprintName,
      brId: id,
      piName: safeControls.piName,
      artName: safeControls.artName
    },
    timeoutMs: 180000
  })

  const summary = adoSync?.summary || {}
  const results = adoSync?.results || {}
  const metadata = adoSync?.metadata || {}

  const epicsCreated = Number(summary.epicsCreated || 0)
  const featuresCreated = Number(summary.featuresCreated || 0)
  const storiesCreated = Number(summary.userStoriesCreated || 0)
  const tasksCreated = Number(summary.tasksCreated || 0)
  const errors = Number(summary.errors || 0)
  const synced = epicsCreated > 0 || featuresCreated > 0 || storiesCreated > 0

  const config = loadAdoConfig()
  const adoUrls = buildAdoUrls(config, resolved.teamName)

  const previousSummary = parseJsonObject(br?.ado_sync_summary)
  const syncSummary = {
    ...previousSummary,
    lastSyncedAt: nowIso(),
    piName: safeControls.piName,
    artName: safeControls.artName,
    teamName: resolved.teamName,
    sprintName: resolved.sprintName,
    storyPointsTotal: pointMetrics.totalPoints,
    weightedPointsTotal: pointMetrics.weightedPoints,
    wsjfSummary: safeBacklog.wsjfSummary,
    dependencyMetrics: safeBacklog.dependencyMetrics,
    capacityActual: safeBacklog.capacityActual,
    safeControls,
    adoSummary: summary,
    adoMetadata: metadata,
    createdIds: {
      epics: (results.epics || []).map((x) => x.id),
      features: (results.features || []).map((x) => x.id),
      userStories: (results.userStories || []).map((x) => x.id),
      tasks: (results.tasks || []).map((x) => x.id)
    },
    links: adoUrls
  }

  const primaryBacklogId =
    String(results?.epics?.[0]?.id || '') ||
    String(results?.features?.[0]?.id || '') ||
    String(results?.userStories?.[0]?.id || '') ||
    null

  await updateBr(id, {
    synced_to_ado: synced ? 1 : 0,
    ado_backlog_id: primaryBacklogId,
    team_name: resolved.teamName,
    sprint_name: resolved.sprintName,
    safe_pi_name: safeControls.piName,
    safe_art_name: safeControls.artName,
    safe_dor_checks: JSON.stringify(safeControls.dorChecks),
    safe_dod_checks: JSON.stringify(safeControls.dodChecks),
    safe_capacity_guardrails: JSON.stringify(safeControls.capacityGuardrails),
    safe_wsjf_summary: JSON.stringify(safeBacklog.wsjfSummary),
    safe_dependency_metrics: JSON.stringify(safeBacklog.dependencyMetrics),
    epic_status: formatCreationStatus(epicsCreated, errors),
    feature_status: formatCreationStatus(featuresCreated, errors),
    user_story_status: formatCreationStatus(storiesCreated, errors),
    task_status: formatCreationStatus(tasksCreated, errors),
    sprint_status: metadata?.iterationPath
      ? `Assigned to ${resolved.sprintName || 'selected sprint'}`
      : 'Iteration unresolved (created in backlog only)',
    story_points_total: pointMetrics.totalPoints,
    weighted_points_total: pointMetrics.weightedPoints,
    ado_iteration_path: metadata?.iterationPath || null,
    ado_assigned_to: metadata?.assignmentCoverage?.primaryAssignee || metadata?.assignedTo || null,
    ado_sync_summary: JSON.stringify(syncSummary),
    ado_board_url: adoUrls.boardUrl,
    ado_dashboard_url: adoUrls.dashboardsUrl,
    workflow_current_stage: synced ? 'Backlog Synced to ADO' : 'Ready for Epic Scoping'
  })

  await writeLog({
    id,
    stage: 'ADO Backlog Sync',
    actor: operator,
    eventType: errors > 0 ? 'warning' : 'success',
    message: errors > 0 ? 'Backlog hierarchy synced with warnings' : 'Backlog hierarchy synced to ADO',
    details: {
      teamName: resolved.teamName,
      sprintName: resolved.sprintName,
      epicsCreated,
      featuresCreated,
      storiesCreated,
      tasksCreated,
      errors,
      storyPointsTotal: pointMetrics.totalPoints,
      weightedPointsTotal: pointMetrics.weightedPoints,
      wsjfFeaturesRanked: Number(safeBacklog.wsjfSummary?.totalFeatures || 0),
      dependencyHeatScore: Number(safeBacklog.dependencyMetrics?.heatScore || 0),
      assignedTo: metadata?.assignmentCoverage?.primaryAssignee || metadata?.assignedTo || null,
      assignedCoverage: metadata?.assignmentCoverage || null
    }
  })

  return {
    summary,
    metadata,
    links: adoUrls,
    points: pointMetrics,
    wsjfSummary: safeBacklog.wsjfSummary,
    dependencyMetrics: safeBacklog.dependencyMetrics,
    capacityActual: safeBacklog.capacityActual,
    warnings: results?.warnings || [],
    errors: results?.errors || []
  }
}

async function runSprintPreparationForBr({ req, id, br, operator, teamName, sprintName, piName, artName, dorChecks, dodChecks, capacityGuardrails }) {
  const resolved = resolveTeamAndSprint(br, { teamName, sprintName })
  const safeControls = buildSafeControls(br, {
    piName,
    artName,
    dorChecks,
    dodChecks,
    capacityGuardrails
  })
  const previousSummary = parseJsonObject(br?.ado_sync_summary)
  const wsjfSummary = parseJsonObject(br?.safe_wsjf_summary)
  const dependencyMetrics = parseJsonObject(br?.safe_dependency_metrics)
  const capacityActual = parseJsonObject(previousSummary?.capacityActual)

  const dorGate = validateDorGate({
    controls: safeControls,
    wsjfSummary,
    dependencyMetrics,
    capacityActual
  })
  if (!dorGate.passed) {
    throw new Error(`DoR gate failed: ${dorGate.missing.join(', ')}`)
  }

  const capacityValidation = validateCapacityGuardrails({
    guardrails: safeControls.capacityGuardrails,
    capacityActual
  })
  if (!capacityValidation.passed) {
    throw new Error(`Capacity guardrail validation failed: ${capacityValidation.reason}`)
  }

  await writeLog({
    id,
    stage: 'Sprint Preparation',
    actor: operator,
    eventType: 'info',
    message: 'Sprint provisioning started',
    details: {
      teamName: resolved.teamName,
      sprintName: resolved.sprintName,
      piName: safeControls.piName,
      artName: safeControls.artName,
      dorGate,
      capacityValidation
    }
  })

  const provision = await postLocalJson({
    req,
    apiPath: '/api/ado-provision',
    payload: { userEmails: [] },
    timeoutMs: 240000
  })

  const report = provision?.report || {}
  const assignmentRows = Array.isArray(report?.sprintAssignments) ? report.sprintAssignments : []
  const assignmentNeedle = resolved.sprintName && resolved.teamName
    ? `${resolved.sprintName} -> ${resolved.teamName}`.toLowerCase()
    : ''

  const sprintBound = assignmentNeedle
    ? assignmentRows.some((row) => String(row || '').toLowerCase().startsWith(assignmentNeedle))
    : assignmentRows.length > 0

  const config = loadAdoConfig()
  const adoUrls = buildAdoUrls(config, resolved.teamName)

  const provisionSummary = {
    teamsCreated: Number((report?.teamsCreated || []).length),
    teamsExisting: Number((report?.teamsExisting || []).length),
    sprintsCreated: Number((report?.sprintsCreated || []).length),
    sprintsExisting: Number((report?.sprintsExisting || []).length),
    warnings: Array.isArray(report?.warnings) ? report.warnings.slice(0, 20) : []
  }

  const assignmentReadiness = evaluateAssignmentReadiness(previousSummary)
  const singleAssigneeFallback = evaluateSingleAssigneeFallback(assignmentReadiness)
  const assignmentReadyForExecution = assignmentReadiness.passed || singleAssigneeFallback.allowed

  const mergedSummary = {
    ...previousSummary,
    links: {
      ...(previousSummary?.links || {}),
      ...adoUrls
    },
    sprintProvisioning: {
      preparedAt: nowIso(),
      teamName: resolved.teamName,
      sprintName: resolved.sprintName,
      sprintBound,
      assignmentReadiness,
      singleAssigneeFallback,
      dorGate,
      capacityValidation,
      summary: provisionSummary
    }
  }

  const sprintStatus = sprintBound && assignmentReadyForExecution
    ? `Sprint ${resolved.sprintName || ''} prepared`
    : 'Provisioned with warnings'

  await updateBr(id, {
    team_name: resolved.teamName,
    sprint_name: resolved.sprintName,
    safe_pi_name: safeControls.piName,
    safe_art_name: safeControls.artName,
    safe_dor_checks: JSON.stringify(safeControls.dorChecks),
    safe_dod_checks: JSON.stringify(safeControls.dodChecks),
    safe_capacity_guardrails: JSON.stringify(safeControls.capacityGuardrails),
    sprint_status: sprintStatus,
    ado_sync_summary: JSON.stringify(mergedSummary),
    ado_board_url: adoUrls.boardUrl,
    ado_dashboard_url: adoUrls.dashboardsUrl,
    workflow_current_stage: sprintBound && assignmentReadyForExecution
      ? 'Sprint Ready for Execution'
      : (br.workflow_current_stage || 'Backlog Synced to ADO')
  })

  await writeLog({
    id,
    stage: 'Sprint Preparation',
    actor: operator,
    eventType: sprintBound && assignmentReadyForExecution ? 'success' : 'warning',
    message: sprintBound && assignmentReadyForExecution
      ? 'Sprint provisioning completed and linked to team'
      : 'Sprint provisioning completed with warnings',
    details: {
      teamName: resolved.teamName,
      sprintName: resolved.sprintName,
      sprintBound,
      assignmentReadiness,
      singleAssigneeFallback,
      dorGate,
      capacityValidation,
      warningCount: provisionSummary.warnings.length
    }
  })

  return {
    sprintBound,
    assignmentReadiness,
    singleAssigneeFallback,
    report,
    links: adoUrls
  }
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

  const {
    action,
    id,
    decision,
    reason,
    brdUrl,
    brdSummary,
    brdDetails,
    triggeredBy,
    teamName,
    sprintName,
    piName,
    artName,
    dorChecks,
    dodChecks,
    capacityGuardrails
  } = req.body || {}
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

      let backlogSync = null
      let sprintPreparation = null
      let automationWarning = null

      if (approved) {
        try {
          const refreshed = await reloadBusinessRequest(id)
          backlogSync = await runBacklogSyncForBr({
            req,
            id,
            br: refreshed,
            operator: persona.name,
            teamName,
            sprintName,
            piName,
            artName,
            dorChecks,
            dodChecks,
            capacityGuardrails
          })

          const afterBacklog = await reloadBusinessRequest(id)
          sprintPreparation = await runSprintPreparationForBr({
            req,
            id,
            br: afterBacklog,
            operator: persona.name,
            teamName,
            sprintName,
            piName,
            artName,
            dorChecks,
            dodChecks,
            capacityGuardrails
          })
        } catch (automationErr) {
          automationWarning = formatError(automationErr)
          await writeLog({
            id,
            stage: 'Post-BRD Automation',
            actor: persona.name,
            eventType: 'warning',
            message: 'Post-BRD ADO automation partially failed',
            details: {
              error: automationWarning,
              triggeredBy: operator
            }
          })
        }
      }

      return res.status(200).json({
        success: true,
        approved,
        ado,
        backlogSync,
        sprintPreparation,
        warning: automationWarning
      })
    }

    if (action === 'sync-backlog') {
      const refreshed = await reloadBusinessRequest(id)
      const syncResult = await runBacklogSyncForBr({
        req,
        id,
        br: refreshed,
        operator,
        teamName,
        sprintName,
        piName,
        artName,
        dorChecks,
        dodChecks,
        capacityGuardrails
      })

      return res.status(200).json({
        success: true,
        synced: true,
        result: syncResult
      })
    }

    if (action === 'prepare-sprint') {
      const refreshed = await reloadBusinessRequest(id)
      const prepResult = await runSprintPreparationForBr({
        req,
        id,
        br: refreshed,
        operator,
        teamName,
        sprintName,
        piName,
        artName,
        dorChecks,
        dodChecks,
        capacityGuardrails
      })

      return res.status(200).json({
        success: true,
        prepared: true,
        result: prepResult
      })
    }

    if (action === 'start-sprint') {
      const refreshed = await reloadBusinessRequest(id)
      const resolved = resolveTeamAndSprint(refreshed, { teamName, sprintName })
      const previousSummary = parseJsonObject(refreshed?.ado_sync_summary)
      const sprintProvisioning = parseJsonObject(previousSummary?.sprintProvisioning)
      const assignmentReadinessFromProvisioning = parseJsonObject(sprintProvisioning?.assignmentReadiness)
      const assignmentReadiness = assignmentReadinessFromProvisioning?.issues
        ? assignmentReadinessFromProvisioning
        : evaluateAssignmentReadiness(previousSummary)
      const singleAssigneeFallbackFromProvisioning = parseJsonObject(sprintProvisioning?.singleAssigneeFallback)
      const singleAssigneeFallback = singleAssigneeFallbackFromProvisioning?.reason
        ? singleAssigneeFallbackFromProvisioning
        : evaluateSingleAssigneeFallback(assignmentReadiness)
      const iterationPath = String(previousSummary?.adoMetadata?.iterationPath || '').trim()

      if (!Boolean(sprintProvisioning?.sprintBound)) {
        throw new Error('Sprint is not bound to the selected ADO team. Run Prepare Sprint in ADO first.')
      }
      if (!iterationPath) {
        throw new Error('ADO iteration path is unresolved. Re-run backlog sync with a valid team and sprint.')
      }
      if (!assignmentReadiness.passed && !singleAssigneeFallback.allowed) {
        throw new Error(`ADO assignment readiness failed: ${assignmentReadiness.issues.join('; ')}`)
      }

      const safeControls = buildSafeControls(refreshed, {
        piName,
        artName,
        dorChecks,
        dodChecks,
        capacityGuardrails
      })
      const dodGate = validateDodGate(safeControls)
      if (!dodGate.passed) {
        throw new Error(`DoD gate failed: ${dodGate.missing.join(', ')}`)
      }

      await updateBr(id, {
        team_name: resolved.teamName,
        sprint_name: resolved.sprintName,
        safe_pi_name: safeControls.piName,
        safe_art_name: safeControls.artName,
        safe_dor_checks: JSON.stringify(safeControls.dorChecks),
        safe_dod_checks: JSON.stringify(safeControls.dodChecks),
        safe_capacity_guardrails: JSON.stringify(safeControls.capacityGuardrails),
        sprint_status: `In Progress - ${resolved.sprintName || 'Current Sprint'}`,
        workflow_current_stage: 'Sprint Running',
        ado_sync_summary: JSON.stringify({
          ...previousSummary,
          sprintExecution: {
            startedAt: nowIso(),
            startedBy: operator,
            teamName: resolved.teamName,
            sprintName: resolved.sprintName,
            assignmentReadiness,
            singleAssigneeFallback
          }
        })
      })

      await writeLog({
        id,
        stage: 'Sprint Execution',
        actor: operator,
        eventType: 'success',
        message: 'Sprint started',
        details: {
          teamName: resolved.teamName,
          sprintName: resolved.sprintName,
          dodGate,
          assignmentReadiness,
          singleAssigneeFallback
        }
      })

      return res.status(200).json({
        success: true,
        started: true,
        teamName: resolved.teamName,
        sprintName: resolved.sprintName,
        assignmentReadiness,
        singleAssigneeFallback
      })
    }

    if (action === 'complete-sprint') {
      const refreshed = await reloadBusinessRequest(id)
      const sprintStatus = String(refreshed?.sprint_status || '').toLowerCase()
      if (!sprintStatus.includes('in progress') && !String(refreshed?.workflow_current_stage || '').toLowerCase().includes('sprint running')) {
        throw new Error('Sprint must be running before completion')
      }

      const resolved = resolveTeamAndSprint(refreshed, { teamName, sprintName })
      const safeControls = buildSafeControls(refreshed, {
        piName,
        artName,
        dorChecks,
        dodChecks,
        capacityGuardrails
      })
      const previousSummary = parseJsonObject(refreshed?.ado_sync_summary)

      await updateBr(id, {
        team_name: resolved.teamName,
        sprint_name: resolved.sprintName,
        safe_pi_name: safeControls.piName,
        safe_art_name: safeControls.artName,
        safe_dor_checks: JSON.stringify(safeControls.dorChecks),
        safe_dod_checks: JSON.stringify(safeControls.dodChecks),
        safe_capacity_guardrails: JSON.stringify(safeControls.capacityGuardrails),
        sprint_status: `Completed - ${resolved.sprintName || 'Current Sprint'}`,
        workflow_current_stage: 'Release Governance',
        ado_sync_summary: JSON.stringify({
          ...previousSummary,
          sprintClosure: {
            closedAt: nowIso(),
            teamName: resolved.teamName,
            sprintName: resolved.sprintName,
            closedBy: operator
          }
        })
      })

      await writeLog({
        id,
        stage: 'Sprint Closure',
        actor: operator,
        eventType: 'success',
        message: 'Sprint marked as completed',
        details: {
          teamName: resolved.teamName,
          sprintName: resolved.sprintName
        }
      })

      return res.status(200).json({
        success: true,
        completed: true,
        teamName: resolved.teamName,
        sprintName: resolved.sprintName
      })
    }

    if (action === 'close-delivery') {
      const refreshed = await reloadBusinessRequest(id)
      const sprintStatus = String(refreshed?.sprint_status || '').toLowerCase()
      const currentStage = String(refreshed?.workflow_current_stage || '').toLowerCase()
      if (!sprintStatus.includes('completed') && !currentStage.includes('release governance')) {
        throw new Error('Complete sprint before closing delivery')
      }

      const safeControls = buildSafeControls(refreshed, {
        piName,
        artName,
        dorChecks,
        dodChecks,
        capacityGuardrails
      })
      const dodGate = validateDodGate(safeControls)
      if (!dodGate.passed) {
        throw new Error(`Release sign-off blocked by DoD gate: ${dodGate.missing.join(', ')}`)
      }

      const previousSummary = parseJsonObject(refreshed?.ado_sync_summary)
      await updateBr(id, {
        safe_pi_name: safeControls.piName,
        safe_art_name: safeControls.artName,
        safe_dor_checks: JSON.stringify(safeControls.dorChecks),
        safe_dod_checks: JSON.stringify(safeControls.dodChecks),
        safe_capacity_guardrails: JSON.stringify(safeControls.capacityGuardrails),
        sprint_status: 'Closed - Value Delivered',
        workflow_current_stage: 'Closed - Value Delivered',
        ado_sync_summary: JSON.stringify({
          ...previousSummary,
          releaseGovernance: {
            signedOffAt: nowIso(),
            signedOffBy: operator,
            dodGate
          }
        })
      })

      await writeLog({
        id,
        stage: 'Release Governance',
        actor: operator,
        eventType: 'success',
        message: 'Delivery lifecycle closed with governance sign-off',
        details: {
          dodGate,
          closedAt: nowIso()
        }
      })

      return res.status(200).json({
        success: true,
        closed: true,
        workflowStage: 'Closed - Value Delivered'
      })
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
