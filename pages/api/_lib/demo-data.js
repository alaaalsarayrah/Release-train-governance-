import fs from 'fs'
import path from 'path'
import { dbAll, dbGet, dbRun, withDb } from './requests-db'
import { PLANNING_AGENT_KEYS } from '../../../lib/planning/constants'

const SEED_ROOT = path.join(process.cwd(), 'data', 'seed')
const ACTIVE_PROFILE_PATH = path.join(SEED_ROOT, '.active-profile.json')
const TEAM_SETUP_PATH = path.join(process.cwd(), 'data', 'team-setup.json')
const BACKLOG_PATH = path.join(process.cwd(), 'data', 'agentic', 'planning-backlog.json')

const DEFAULT_PROFILE = 'default'
const THESIS_PROFILE = 'thesis-demo'
const DEMO_SESSION_ID = 'PLAN-THESIS-DEMO-001'

const DEMO_TS = {
  base: '2026-03-10T08:00:00.000Z',
  outputs: '2026-03-10T08:12:00.000Z',
  decisions: '2026-03-10T08:19:00.000Z',
  finalize: '2026-03-10T08:27:00.000Z',
  runs: '2026-03-11T09:00:00.000Z',
  evaluations: '2026-03-11T11:30:00.000Z',
  requests: '2026-03-09T14:00:00.000Z'
}

const TRACKED_TABLES = [
  'planning_human_decisions',
  'planning_dependency_records',
  'planning_estimation_decisions',
  'planning_architecture_notes',
  'planning_risk_records',
  'planning_agent_outputs',
  'planning_sessions',
  'planning_scenario_interactions',
  'planning_scenario_runs',
  'thesis_evaluations',
  'business_requests',
  'orchestrator_events',
  'audit_logs'
]

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(filePath, value) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

function parseProfileName(profile) {
  const normalized = String(profile || THESIS_PROFILE).trim().toLowerCase()
  if (normalized === THESIS_PROFILE || normalized === DEFAULT_PROFILE) {
    return normalized
  }
  throw new Error(`Unsupported demo profile: ${profile}`)
}

function readSeedProfile(profile) {
  const profileName = parseProfileName(profile)
  const root = path.join(SEED_ROOT, profileName)
  const teamSetup = readJson(path.join(root, 'team-setup.json'), null)
  const planningBacklog = readJson(path.join(root, 'planning-backlog.json'), null)

  if (!teamSetup || !Array.isArray(teamSetup.teams) || !Array.isArray(teamSetup.sprints)) {
    throw new Error(`Invalid team setup seed for profile: ${profileName}`)
  }

  if (!planningBacklog || !Array.isArray(planningBacklog.items)) {
    throw new Error(`Invalid planning backlog seed for profile: ${profileName}`)
  }

  return { profileName, teamSetup, planningBacklog }
}

function writeTargetFiles({ teamSetup, planningBacklog }) {
  writeJson(TEAM_SETUP_PATH, teamSetup)
  writeJson(BACKLOG_PATH, planningBacklog)
}

function setActiveProfile(profileName, lastAction) {
  writeJson(ACTIVE_PROFILE_PATH, {
    profile: profileName,
    lastAction,
    updatedAt: new Date().toISOString()
  })
}

async function countTableRows(db, tableName) {
  const row = await dbGet(db, `SELECT COUNT(*) AS total FROM ${tableName}`)
  return safeNumber(row?.total, 0)
}

async function clearTrackedTables(db) {
  const counts = {}

  for (const tableName of TRACKED_TABLES) {
    counts[tableName] = await countTableRows(db, tableName)
  }

  await dbRun(db, 'DELETE FROM planning_human_decisions')
  await dbRun(db, 'DELETE FROM planning_dependency_records')
  await dbRun(db, 'DELETE FROM planning_estimation_decisions')
  await dbRun(db, 'DELETE FROM planning_architecture_notes')
  await dbRun(db, 'DELETE FROM planning_risk_records')
  await dbRun(db, 'DELETE FROM planning_agent_outputs')
  await dbRun(db, 'DELETE FROM planning_sessions')
  await dbRun(db, 'DELETE FROM planning_scenario_interactions')
  await dbRun(db, 'DELETE FROM planning_scenario_runs')
  await dbRun(db, 'DELETE FROM thesis_evaluations')
  await dbRun(db, 'DELETE FROM business_requests')
  await dbRun(db, 'DELETE FROM orchestrator_events')
  await dbRun(db, 'DELETE FROM audit_logs')

  return counts
}

function selectThesisBacklog(backlogItems, sprintName) {
  const bySprint = backlogItems.filter((item) => item.targetSprint === sprintName)
  if (bySprint.length >= 10) return bySprint.slice(0, 12)
  return backlogItems.slice(0, 12)
}

function buildPlanningContext({ teamSetup, planningBacklog }) {
  const team = teamSetup.teams[0] || { name: 'Dubai Digital Services Team' }
  const sprint = teamSetup.sprints.find((row) => row.status === 'Active') || teamSetup.sprints[0] || { name: 'Sprint 5 - Digital Services Wave 2' }
  const scopedBacklog = selectThesisBacklog(planningBacklog.items, sprint.name)

  return {
    team,
    sprint,
    capacityPoints: 52,
    programContext: {
      releaseTrain: 'Government Digital Services ART',
      programIncrement: 'PI-2026-Q2',
      releaseObjective: 'Permit Modernization Wave 2'
    },
    backlogItems: scopedBacklog,
    portfolioBacklogSize: planningBacklog.items.length
  }
}

function buildAgentOutputs(planningContext) {
  const items = planningContext.backlogItems

  return [
    {
      agentKey: 'product_owner_assistant',
      summary: 'Prioritized a Sprint 5 scope focused on permit journey reliability and compliance traceability.',
      confidence: 0.91,
      output: {
        summary: 'Sprint scope balances citizen value and integration risk with explicit sequencing for gateway and document APIs.',
        rationale: 'Highest business value stories are selected while preserving a buffer for security and migration enablers.',
        confidence: 0.91,
        recommendations: [
          'Commit US-601, US-604, US-609, US-612 as core user-facing value stories.',
          'Run US-602 and US-617 early to unblock dependent payment and compliance work.',
          'Defer lower-value telemetry enhancements if capacity falls below 50 points.'
        ],
        follow_up_questions: [
          'Can security sign-off for malware scanning be completed before sprint day 6?',
          'Should PI objective telemetry be mandatory for this sprint increment?'
        ],
        artifacts: {
          prioritized_items: items.slice(0, 8).map((row) => ({
            id: row.id,
            title: row.title,
            businessValue: row.businessValue,
            storyPoints: row.storyPoints
          }))
        }
      }
    },
    {
      agentKey: 'estimation_advisor',
      summary: 'Estimated selected backlog at 56 points AI baseline with 53 points final human commitment.',
      confidence: 0.87,
      output: {
        summary: 'Capacity risk is manageable after reducing two integration-heavy stories by scope split.',
        rationale: 'Historical throughput for this team averages 50-55 points when dependencies are tracked daily.',
        confidence: 0.87,
        recommendations: [
          'Apply a scope split to US-602 and US-611 to reduce sprint overcommit risk.',
          'Track integration blockers every stand-up for US-603 and US-617.'
        ],
        artifacts: {
          estimation_table: items.map((row) => ({
            id: row.id,
            title: row.title,
            aiEstimate: row.storyPoints,
            confidence: row.storyPoints >= 13 ? 0.72 : 0.89
          }))
        }
      }
    },
    {
      agentKey: 'dependency_analyst',
      summary: 'Identified six critical dependencies including document API, payment callback, and fraud adapter sequencing.',
      confidence: 0.9,
      output: {
        summary: 'Dependency chain indicates integration team readiness drives sprint completion confidence.',
        rationale: 'US-603, US-607, and US-622 are blocked by stable outputs from US-602 and US-617.',
        confidence: 0.9,
        recommendations: [
          'Run an integration readiness checkpoint by sprint day 3.',
          'Escalate unresolved external API contracts to ART sync immediately.'
        ],
        risks: [
          'Delays in document vault checksum endpoint can cascade to dispute evidence generation.',
          'Fraud adapter false positives may impact payment retry conversion.'
        ],
        artifacts: {
          dependency_graph: {
            nodes: [
              { id: 'US-602', label: 'Document vault API' },
              { id: 'US-603', label: 'Payment webhook' },
              { id: 'US-607', label: 'Fraud adapter' },
              { id: 'US-617', label: 'Malware scan pipeline' },
              { id: 'US-622', label: 'Dispute evidence package' },
              { id: 'US-609', label: 'SLA warning dashboard' }
            ],
            edges: [
              { source: 'US-602', target: 'US-603', severity: 'High' },
              { source: 'US-602', target: 'US-622', severity: 'High' },
              { source: 'US-617', target: 'US-622', severity: 'Medium' },
              { source: 'US-607', target: 'US-603', severity: 'High' },
              { source: 'US-603', target: 'US-609', severity: 'Medium' }
            ]
          }
        }
      }
    },
    {
      agentKey: 'architect_advisor',
      summary: 'Recommended event-driven integration safeguards for payment, document, and security workflows.',
      confidence: 0.86,
      output: {
        summary: 'Architecture guidance prioritizes resilient messaging and traceable compliance controls.',
        rationale: 'Two critical cross-team integration points require fault-isolated workflows and auditable decision logs.',
        confidence: 0.86,
        recommendations: [
          'Adopt outbox pattern for payment callbacks and dispute event publishing.',
          'Introduce a dedicated policy service boundary for retention and consent rules.',
          'Publish architecture decision records alongside sprint evidence exports.'
        ],
        artifacts: {
          impacted_components: [
            'Permit API Gateway',
            'Document Vault Service',
            'Payment Integration Adapter',
            'Compliance Audit Store'
          ]
        }
      }
    },
    {
      agentKey: 'risk_analyst',
      summary: 'Flagged one high, two medium, and one low risk with owners and mitigations aligned to sprint goals.',
      confidence: 0.89,
      output: {
        summary: 'Risk profile is acceptable with a focused mitigation cadence and daily dependency review.',
        rationale: 'Most risks are integration and compliance timing related, not scope ambiguity.',
        confidence: 0.89,
        recommendations: [
          'Create an early compliance checkpoint for consent and retention stories.',
          'Track external API SLA incidents in the sprint risk ceremony.'
        ],
        risks: [
          'Vendor callback format drift could break payment reconciliation.',
          'Migration exceptions may delay taxonomy-governed permit categories.'
        ]
      }
    }
  ]
}

function buildDependencyRecords() {
  return [
    {
      source_item: 'US-602',
      target_item: 'US-603',
      dependency_type: 'API Contract',
      severity: 'High',
      description: 'Payment callback flow depends on document vault payload schema standardization.',
      mitigation: 'Finalize schema contract and run consumer-driven tests by sprint day 2.',
      threatens_sprint: 1
    },
    {
      source_item: 'US-602',
      target_item: 'US-622',
      dependency_type: 'Data Dependency',
      severity: 'High',
      description: 'Dispute package generator requires signed attachment metadata from document vault.',
      mitigation: 'Publish signed metadata endpoint and validate with dispute service in staging.',
      threatens_sprint: 1
    },
    {
      source_item: 'US-617',
      target_item: 'US-622',
      dependency_type: 'Security Gate',
      severity: 'Medium',
      description: 'Dispute bundle release requires malware scan verdict integration.',
      mitigation: 'Implement asynchronous scan completion callback and retry policy.',
      threatens_sprint: 0
    },
    {
      source_item: 'US-607',
      target_item: 'US-603',
      dependency_type: 'Service Coupling',
      severity: 'High',
      description: 'Fraud signal adapter must evaluate retry requests before payment webhook acceptance.',
      mitigation: 'Deploy adapter behind feature flag and monitor false positives.',
      threatens_sprint: 1
    },
    {
      source_item: 'US-603',
      target_item: 'US-609',
      dependency_type: 'Operational Metrics',
      severity: 'Medium',
      description: 'SLA warning dashboard depends on reliable status events from payment processing.',
      mitigation: 'Add fallback event replay job for missed webhook events.',
      threatens_sprint: 0
    }
  ]
}

function buildRiskRecords() {
  return [
    {
      risk_id: 'RISK-PI2-001',
      title: 'External payment callback format drift',
      description: 'Partner gateway may change callback payload format without early notice.',
      category: 'Integration',
      probability: 'Medium',
      impact: 'High',
      severity: 'High',
      mitigation: 'Contract tests and schema version negotiation with vendor sandbox monitors.',
      owner: 'Yasir Al Mazrouei',
      status: 'Open',
      source_agent: 'risk_analyst'
    },
    {
      risk_id: 'RISK-PI2-002',
      title: 'Consent revocation legal interpretation update',
      description: 'Policy wording updates may require workflow adjustment mid-sprint.',
      category: 'Compliance',
      probability: 'Low',
      impact: 'High',
      severity: 'Medium',
      mitigation: 'Weekly legal checkpoint and configurable policy rule toggle.',
      owner: 'Rania Sabet',
      status: 'Monitoring',
      source_agent: 'risk_analyst'
    },
    {
      risk_id: 'RISK-PI2-003',
      title: 'Migration data quality exceptions',
      description: 'Legacy permit category mappings can include unmapped values in production cutover.',
      category: 'Data',
      probability: 'Medium',
      impact: 'Medium',
      severity: 'Medium',
      mitigation: 'Run dry-run migration with exception report and rollback scripts.',
      owner: 'Layla Nasser',
      status: 'Open',
      source_agent: 'risk_analyst'
    },
    {
      risk_id: 'RISK-PI2-004',
      title: 'Accessibility remediation regression',
      description: 'Late UI fixes may unintentionally impact form completion behavior.',
      category: 'Delivery',
      probability: 'Low',
      impact: 'Medium',
      severity: 'Low',
      mitigation: 'Run focused accessibility regression suite before release candidate sign-off.',
      owner: 'Huda Karim',
      status: 'Open',
      source_agent: 'risk_analyst'
    }
  ]
}

function buildArchitectureNote() {
  return {
    impacted_components: [
      'Permit API Gateway',
      'Identity Federation Adapter',
      'Document Vault Service',
      'Payment Integration Adapter',
      'Audit and Evidence Store'
    ],
    assumptions: [
      'Identity federation remains available at or above 99.9% during sprint execution.',
      'Payment gateway sandbox mirrors production callback semantics.'
    ],
    constraints: [
      'Citizen data cannot be replicated outside approved regional zones.',
      'Public API p95 latency target remains under 1.5 seconds.'
    ],
    technical_enablers: [
      'Outbox pattern for event reliability and replay.',
      'Schema registry checks in CI for callback compatibility.',
      'Automated security scan gate before evidence package publication.'
    ],
    architecture_risks: [
      'Callback drift can cascade into SLA monitoring blind spots.',
      'Overloaded policy service can delay consent enforcement updates.'
    ],
    recommended_actions: [
      'Introduce contract monitoring alarms for external callback payload variance.',
      'Add policy service canary deployment for retention and consent changes.',
      'Document architecture decisions in export artifacts for governance traceability.'
    ],
    rationale: 'This architecture shape keeps integration points observable, resilient, and auditable for thesis evidence and production governance.'
  }
}

function buildScenarioRuns() {
  return [
    {
      id: 'RUN-THESIS-001',
      scenario_key: 'backlog-refinement',
      scenario_name: 'Backlog refinement scenario',
      participant_id: 'P-001',
      participant_role: 'Product Owner',
      instructions: 'Validate story readiness and prioritize Sprint 5 commitments.',
      synthetic_data: { team: 'Dubai Digital Services Team', sprint: 'Sprint 5 - Digital Services Wave 2' },
      started_at: '2026-03-11T09:00:00.000Z',
      ended_at: '2026-03-11T09:24:00.000Z',
      duration_seconds: 1440,
      recommendations_shown: 14,
      accepted_count: 10,
      modified_count: 3,
      rejected_count: 1,
      clarification_requests: 2,
      perceived_usefulness: 5,
      ease_of_use: 4,
      trust: 4,
      intention_to_use: 5,
      notes: 'Strong fit for backlog triage; requested richer rationale text for two split-story recommendations.',
      created_at: '2026-03-11T09:00:00.000Z'
    },
    {
      id: 'RUN-THESIS-002',
      scenario_key: 'sprint-preparation',
      scenario_name: 'Sprint planning preparation scenario',
      participant_id: 'P-002',
      participant_role: 'Scrum Master',
      instructions: 'Compare AI and final estimates against team capacity and confidence.',
      synthetic_data: { team: 'Dubai Digital Services Team', sprint: 'Sprint 5 - Digital Services Wave 2' },
      started_at: '2026-03-11T10:10:00.000Z',
      ended_at: '2026-03-11T10:39:30.000Z',
      duration_seconds: 1770,
      recommendations_shown: 11,
      accepted_count: 8,
      modified_count: 2,
      rejected_count: 1,
      clarification_requests: 1,
      perceived_usefulness: 4,
      ease_of_use: 4,
      trust: 4,
      intention_to_use: 4,
      notes: 'Capacity delta panel reduced estimation workshop time by roughly 20%.',
      created_at: '2026-03-11T10:10:00.000Z'
    },
    {
      id: 'RUN-THESIS-003',
      scenario_key: 'dependency-risk-review',
      scenario_name: 'Dependency and risk review scenario',
      participant_id: 'P-003',
      participant_role: 'Delivery Lead',
      instructions: 'Review dependency graph and risk controls before sprint commitment.',
      synthetic_data: { team: 'Abu Dhabi Integration Team', sprint: 'Sprint 5 - Digital Services Wave 2' },
      started_at: '2026-03-11T11:05:00.000Z',
      ended_at: '2026-03-11T11:33:00.000Z',
      duration_seconds: 1680,
      recommendations_shown: 9,
      accepted_count: 6,
      modified_count: 2,
      rejected_count: 1,
      clarification_requests: 1,
      perceived_usefulness: 4,
      ease_of_use: 4,
      trust: 5,
      intention_to_use: 4,
      notes: 'Dependency visual made escalation paths clearer for ART sync.',
      created_at: '2026-03-11T11:05:00.000Z'
    }
  ]
}

function buildScenarioInteractions() {
  return [
    {
      run_id: 'RUN-THESIS-001',
      recommendation_id: 'rec-priority-split-us602',
      action: 'accepted',
      actor: 'Product Owner',
      notes: 'Accepted split to preserve sprint feasibility.',
      created_at: '2026-03-11T09:11:00.000Z'
    },
    {
      run_id: 'RUN-THESIS-001',
      recommendation_id: 'rec-backlog-order-us609',
      action: 'modified',
      actor: 'Product Owner',
      notes: 'Moved SLA dashboard after payment callback stabilization.',
      created_at: '2026-03-11T09:16:00.000Z'
    },
    {
      run_id: 'RUN-THESIS-002',
      recommendation_id: 'rec-estimate-us611',
      action: 'modified',
      actor: 'Scrum Master',
      notes: 'Raised final estimate by 2 points after migration complexity review.',
      created_at: '2026-03-11T10:20:00.000Z'
    },
    {
      run_id: 'RUN-THESIS-003',
      recommendation_id: 'rec-risk-escalation-r001',
      action: 'accepted',
      actor: 'Delivery Lead',
      notes: 'Escalated vendor callback risk to weekly ART forum.',
      created_at: '2026-03-11T11:18:00.000Z'
    }
  ]
}

function buildEvaluationRows(planningContext) {
  const teamId = planningContext?.team?.id || null
  const teamName = planningContext?.team?.name || 'Dubai Digital Services Team'
  const sprintId = planningContext?.sprint?.id || null
  const sprintName = planningContext?.sprint?.name || 'Sprint 5 - Digital Services Wave 2'

  return [
    {
      scenario_id: 'SCN-BACKLOG-01',
      scenario_name: 'Backlog refinement with dependency resolution',
      planning_session_id: DEMO_SESSION_ID,
      team_id: teamId,
      team_name: teamName,
      sprint_id: sprintId,
      sprint_name: sprintName,
      participant_id: 'P-001',
      participant_role: 'Product Owner',
      evaluator_id: 'EVAL-001',
      evaluator_role: 'Product Owner',
      evaluated_at: '2026-03-11T11:30:00.000Z',
      perceived_usefulness: 5,
      ease_of_use: 4,
      trust: 4,
      intention_to_use: 5,
      task_completion_minutes: 24,
      baseline_manual_planning_minutes: 41,
      ai_assisted_planning_minutes: 24,
      time_reduction_minutes: 17,
      time_reduction_percent: 41.46,
      recommendations_generated: 14,
      recommendations_accepted: 10,
      recommendation_acceptance_ratio: 71.43,
      dependency_issues_identified: 6,
      dependency_issues_validated: 5,
      dependency_validation_ratio: 83.33,
      risk_items_identified: 4,
      risk_recommendations_accepted: 3,
      risk_acceptance_ratio: 75,
      estimation_baseline: 38,
      ai_supported_estimate: 34,
      estimation_variance: -4,
      estimation_variance_percent: -10.53,
      clarification_requests: 2,
      task_completion_success: 1,
      system_response_ms: 1320,
      error_count: 0,
      evaluator_comments: 'Recommendations were actionable and aligned to sprint objectives.',
      observations: 'Team reached agreement faster when rationale was visible.',
      limitations: 'Need finer detail for PI objective traceability.',
      notes: 'Prioritization rationale helped in resolving backlog ordering conflict.',
      interview_notes: 'Requested deeper PI objective linkage in recommendation text.',
      created_at: '2026-03-11T11:30:00.000Z'
    },
    {
      scenario_id: 'SCN-SPRINT-02',
      scenario_name: 'Sprint preparation and capacity balancing',
      planning_session_id: DEMO_SESSION_ID,
      team_id: teamId,
      team_name: teamName,
      sprint_id: sprintId,
      sprint_name: sprintName,
      participant_id: 'P-002',
      participant_role: 'Scrum Master',
      evaluator_id: 'EVAL-002',
      evaluator_role: 'Scrum Master',
      evaluated_at: '2026-03-11T11:35:00.000Z',
      perceived_usefulness: 4,
      ease_of_use: 4,
      trust: 4,
      intention_to_use: 4,
      task_completion_minutes: 29,
      baseline_manual_planning_minutes: 46,
      ai_assisted_planning_minutes: 29,
      time_reduction_minutes: 17,
      time_reduction_percent: 36.96,
      recommendations_generated: 11,
      recommendations_accepted: 8,
      recommendation_acceptance_ratio: 72.73,
      dependency_issues_identified: 5,
      dependency_issues_validated: 4,
      dependency_validation_ratio: 80,
      risk_items_identified: 3,
      risk_recommendations_accepted: 2,
      risk_acceptance_ratio: 66.67,
      estimation_baseline: 41,
      ai_supported_estimate: 36,
      estimation_variance: -5,
      estimation_variance_percent: -12.2,
      clarification_requests: 1,
      task_completion_success: 1,
      system_response_ms: 1410,
      error_count: 0,
      evaluator_comments: 'Capacity balancing was noticeably faster than prior manual sessions.',
      observations: 'Confidence increased when estimate comparisons were surfaced early.',
      limitations: 'Bulk edit for estimates would reduce additional clicks.',
      notes: 'Estimate comparison view reduced workshop noise and shortened negotiation loops.',
      interview_notes: 'Wanted bulk edit support for final estimates.',
      created_at: '2026-03-11T11:35:00.000Z'
    },
    {
      scenario_id: 'SCN-RISK-03',
      scenario_name: 'Dependency and risk governance review',
      planning_session_id: DEMO_SESSION_ID,
      team_id: teamId,
      team_name: teamName,
      sprint_id: sprintId,
      sprint_name: sprintName,
      participant_id: 'P-003',
      participant_role: 'Delivery Lead',
      evaluator_id: 'EVAL-003',
      evaluator_role: 'Delivery Lead',
      evaluated_at: '2026-03-11T11:40:00.000Z',
      perceived_usefulness: 4,
      ease_of_use: 4,
      trust: 5,
      intention_to_use: 4,
      task_completion_minutes: 28,
      baseline_manual_planning_minutes: 44,
      ai_assisted_planning_minutes: 28,
      time_reduction_minutes: 16,
      time_reduction_percent: 36.36,
      recommendations_generated: 9,
      recommendations_accepted: 6,
      recommendation_acceptance_ratio: 66.67,
      dependency_issues_identified: 7,
      dependency_issues_validated: 5,
      dependency_validation_ratio: 71.43,
      risk_items_identified: 6,
      risk_recommendations_accepted: 4,
      risk_acceptance_ratio: 66.67,
      estimation_baseline: 27,
      ai_supported_estimate: 24,
      estimation_variance: -3,
      estimation_variance_percent: -11.11,
      clarification_requests: 1,
      task_completion_success: 1,
      system_response_ms: 1370,
      error_count: 0,
      evaluator_comments: 'Dependency relationships were easier to explain using graph outputs.',
      observations: 'Validation discussions were shorter because evidence was centralized.',
      limitations: 'Heatmap legend requires clearer executive labeling.',
      notes: 'Dependency graph was useful for communicating cross-team blockers.',
      interview_notes: 'Risk heatmap severity coloration should be stronger for executive decks.',
      created_at: '2026-03-11T11:40:00.000Z'
    },
    {
      scenario_id: 'SCN-ARCH-04',
      scenario_name: 'Architecture recommendation review',
      planning_session_id: DEMO_SESSION_ID,
      team_id: teamId,
      team_name: teamName,
      sprint_id: sprintId,
      sprint_name: sprintName,
      participant_id: 'P-004',
      participant_role: 'Solution Architect',
      evaluator_id: 'EVAL-004',
      evaluator_role: 'Solution Architect',
      evaluated_at: '2026-03-11T11:45:00.000Z',
      perceived_usefulness: 5,
      ease_of_use: 4,
      trust: 4,
      intention_to_use: 5,
      task_completion_minutes: 26,
      baseline_manual_planning_minutes: 42,
      ai_assisted_planning_minutes: 26,
      time_reduction_minutes: 16,
      time_reduction_percent: 38.1,
      recommendations_generated: 8,
      recommendations_accepted: 6,
      recommendation_acceptance_ratio: 75,
      dependency_issues_identified: 4,
      dependency_issues_validated: 3,
      dependency_validation_ratio: 75,
      risk_items_identified: 3,
      risk_recommendations_accepted: 2,
      risk_acceptance_ratio: 66.67,
      estimation_baseline: 22,
      ai_supported_estimate: 20,
      estimation_variance: -2,
      estimation_variance_percent: -9.09,
      clarification_requests: 2,
      task_completion_success: 1,
      system_response_ms: 1280,
      error_count: 0,
      evaluator_comments: 'Architecture action list was implementation-ready.',
      observations: 'Decision confidence improved when technical enablers were explicit.',
      limitations: 'ADR template integration still needed.',
      notes: 'Recommended actions were practical and aligned to existing architecture principles.',
      interview_notes: 'Needs direct ADR template integration for faster governance sign-off.',
      created_at: '2026-03-11T11:45:00.000Z'
    }
  ]
}

async function insertBusinessRequests(db, planningContext) {
  const rows = [
    {
      id: 'BR-THESIS-001',
      description: 'Modernize digital permit initiation and attachment governance for Wave 2 release.',
      unit: 'Digital Government Services',
      urgency: 'High',
      date: '2026-03-08',
      justif: 'Supports PI-2026-Q2 objective for permit cycle-time reduction and compliance improvements.',
      status: 'Approved',
      team_name: planningContext.team.name,
      sprint_name: planningContext.sprint.name,
      safe_pi_name: planningContext.programContext.programIncrement,
      safe_art_name: planningContext.programContext.releaseTrain,
      workflow_current_stage: 'Sprint Planning',
      created_at: DEMO_TS.requests
    },
    {
      id: 'BR-THESIS-002',
      description: 'Increase resilience of payment and fraud controls for permit transaction reliability.',
      unit: 'Digital Government Services',
      urgency: 'High',
      date: '2026-03-08',
      justif: 'Reduces settlement failures and strengthens compliance posture for cross-team integration.',
      status: 'Approved',
      team_name: 'Abu Dhabi Integration Team',
      sprint_name: planningContext.sprint.name,
      safe_pi_name: planningContext.programContext.programIncrement,
      safe_art_name: planningContext.programContext.releaseTrain,
      workflow_current_stage: 'Sprint Planning',
      created_at: DEMO_TS.requests
    }
  ]

  for (const row of rows) {
    await dbRun(
      db,
      `INSERT INTO business_requests (
        id,
        description,
        unit,
        urgency,
        date,
        justif,
        status,
        team_name,
        sprint_name,
        safe_pi_name,
        safe_art_name,
        workflow_current_stage,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.description,
        row.unit,
        row.urgency,
        row.date,
        row.justif,
        row.status,
        row.team_name,
        row.sprint_name,
        row.safe_pi_name,
        row.safe_art_name,
        row.workflow_current_stage,
        row.created_at
      ]
    )
  }

  return rows.length
}

async function insertPlanningSessionArtifacts(db, planningContext, actor) {
  const selectedAgents = PLANNING_AGENT_KEYS
  const outputs = buildAgentOutputs(planningContext)
  const dependencies = buildDependencyRecords()
  const risks = buildRiskRecords()
  const architectureNote = buildArchitectureNote()

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
      final_summary,
      created_by,
      finalized_by,
      finalized_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEMO_SESSION_ID,
      'PI-2026-Q2 Sprint 5 Planning - Thesis Demonstration',
      planningContext.team.id || 'team-digital-dubai',
      planningContext.team.name,
      planningContext.sprint.id || 'sprint-5-2026',
      planningContext.sprint.name,
      'finalized',
      JSON.stringify(planningContext),
      JSON.stringify(selectedAgents),
      null,
      actor,
      actor,
      DEMO_TS.finalize,
      DEMO_TS.base
    ]
  )

  const outputIds = {}
  let outputCount = 0
  for (const row of outputs) {
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
        DEMO_SESSION_ID,
        row.agentKey,
        row.summary,
        row.confidence,
        JSON.stringify(row.output),
        actor,
        DEMO_TS.outputs
      ]
    )
    outputIds[row.agentKey] = Number(result?.lastID || 0)
    outputCount += 1
  }

  const decisions = [
    {
      agent_key: 'product_owner_assistant',
      decision: 'accept',
      human_rationale: 'Prioritization aligns with PI objective and stakeholder expectations.'
    },
    {
      agent_key: 'estimation_advisor',
      decision: 'modify',
      human_rationale: 'Adjusted two enabler estimates after team calibration workshop.'
    },
    {
      agent_key: 'dependency_analyst',
      decision: 'accept',
      human_rationale: 'Dependencies and mitigations are actionable for sprint ceremonies.'
    },
    {
      agent_key: 'architect_advisor',
      decision: 'accept',
      human_rationale: 'Recommendations match current architecture runway strategy.'
    },
    {
      agent_key: 'risk_analyst',
      decision: 'accept',
      human_rationale: 'Risk ownership and mitigation cadence approved by delivery leads.'
    }
  ]

  for (const row of decisions) {
    const output = outputs.find((item) => item.agentKey === row.agent_key)
    const finalOutput = row.decision === 'modify'
      ? {
          ...output.output,
          recommendations: [
            ...output.output.recommendations,
            'Split US-611 migration scope into schema validation and data remediation subtasks.'
          ]
        }
      : output.output

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
        DEMO_SESSION_ID,
        outputIds[row.agent_key] || null,
        row.agent_key,
        row.decision,
        JSON.stringify(output.output),
        JSON.stringify(finalOutput),
        row.human_rationale,
        actor,
        DEMO_TS.decisions
      ]
    )
  }

  for (const row of dependencies) {
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
        DEMO_SESSION_ID,
        row.source_item,
        row.target_item,
        row.dependency_type,
        row.severity,
        row.description,
        row.mitigation,
        row.threatens_sprint,
        DEMO_TS.decisions
      ]
    )
  }

  const estimateRows = planningContext.backlogItems.map((item) => {
    const aiEstimate = safeNumber(item.storyPoints, 0)
    const finalEstimate = Math.max(1, aiEstimate + (item.id === 'US-611' ? 2 : item.id === 'US-603' ? -1 : 0))
    return {
      backlog_item_id: item.id,
      backlog_item_title: item.title,
      ai_estimate: aiEstimate,
      final_estimate: finalEstimate,
      confidence: aiEstimate >= 13 ? 0.72 : 0.88,
      assumptions: [
        'Assumes no production environment freeze during sprint window.',
        'Assumes QA automation suite remains stable for regression scope.'
      ]
    }
  })

  for (const row of estimateRows) {
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
        DEMO_SESSION_ID,
        row.backlog_item_id,
        row.backlog_item_title,
        row.ai_estimate,
        row.final_estimate,
        row.confidence,
        JSON.stringify(row.assumptions),
        actor,
        DEMO_TS.decisions
      ]
    )
  }

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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEMO_SESSION_ID,
      outputIds.architect_advisor || null,
      JSON.stringify(architectureNote.impacted_components),
      JSON.stringify(architectureNote.assumptions),
      JSON.stringify(architectureNote.constraints),
      JSON.stringify(architectureNote.technical_enablers),
      JSON.stringify(architectureNote.architecture_risks),
      JSON.stringify(architectureNote.recommended_actions),
      architectureNote.rationale,
      DEMO_TS.decisions
    ]
  )

  for (const row of risks) {
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DEMO_SESSION_ID,
        row.risk_id,
        row.title,
        row.description,
        row.category,
        row.probability,
        row.impact,
        row.severity,
        row.mitigation,
        row.owner,
        row.status,
        row.source_agent,
        DEMO_TS.decisions
      ]
    )
  }

  const finalSummary = {
    sessionId: DEMO_SESSION_ID,
    title: 'PI-2026-Q2 Sprint 5 Planning - Thesis Demonstration',
    sprintGoal: 'Deliver secure and resilient permit journey improvements while preserving compliance traceability.',
    team: planningContext.team.name,
    sprint: planningContext.sprint.name,
    releaseTrain: planningContext.programContext.releaseTrain,
    programIncrement: planningContext.programContext.programIncrement,
    capacityPoints: planningContext.capacityPoints,
    commitmentPoints: estimateRows.reduce((acc, row) => acc + safeNumber(row.final_estimate, 0), 0),
    keyDependencies: dependencies.map((row) => ({
      source: row.source_item,
      target: row.target_item,
      severity: row.severity,
      mitigation: row.mitigation
    })),
    topRisks: risks.slice(0, 3).map((row) => ({
      riskId: row.risk_id,
      title: row.title,
      severity: row.severity,
      owner: row.owner
    })),
    architectureRecommendations: architectureNote.recommended_actions,
    governanceDecisions: decisions.map((row) => ({
      agent: row.agent_key,
      decision: row.decision,
      rationale: row.human_rationale
    }))
  }

  await dbRun(
    db,
    `UPDATE planning_sessions
     SET status = ?,
         final_summary = ?,
         finalized_by = ?,
         finalized_at = ?
     WHERE id = ?`,
    ['finalized', JSON.stringify(finalSummary), actor, DEMO_TS.finalize, DEMO_SESSION_ID]
  )

  return {
    sessionId: DEMO_SESSION_ID,
    outputs: outputCount,
    decisions: decisions.length,
    dependencies: dependencies.length,
    risks: risks.length,
    estimates: estimateRows.length
  }
}

async function insertScenarioRunsAndEvidence(db, planningContext) {
  const runs = buildScenarioRuns()
  const interactions = buildScenarioInteractions()
  const evaluations = buildEvaluationRows(planningContext)

  for (const row of runs) {
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
        ended_at,
        duration_seconds,
        recommendations_shown,
        accepted_count,
        modified_count,
        rejected_count,
        clarification_requests,
        perceived_usefulness,
        ease_of_use,
        trust,
        intention_to_use,
        notes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.scenario_key,
        row.scenario_name,
        row.participant_id,
        row.participant_role,
        row.instructions,
        JSON.stringify(row.synthetic_data),
        row.started_at,
        row.ended_at,
        row.duration_seconds,
        row.recommendations_shown,
        row.accepted_count,
        row.modified_count,
        row.rejected_count,
        row.clarification_requests,
        row.perceived_usefulness,
        row.ease_of_use,
        row.trust,
        row.intention_to_use,
        row.notes,
        row.created_at
      ]
    )
  }

  for (const row of interactions) {
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
      [
        row.run_id,
        row.recommendation_id,
        row.action,
        row.actor,
        row.notes,
        row.created_at
      ]
    )
  }

  for (const row of evaluations) {
    const insertValues = [
      row.scenario_id,
      row.scenario_name,
      row.planning_session_id,
      row.team_id,
      row.team_name,
      row.sprint_id,
      row.sprint_name,
      row.participant_id,
      row.participant_role,
      row.evaluator_id,
      row.evaluator_role,
      row.evaluated_at,
      row.perceived_usefulness,
      row.ease_of_use,
      row.trust,
      row.intention_to_use,
      row.task_completion_minutes,
      row.baseline_manual_planning_minutes,
      row.ai_assisted_planning_minutes,
      row.time_reduction_minutes,
      row.time_reduction_percent,
      row.recommendations_generated,
      row.recommendations_accepted,
      row.recommendation_acceptance_ratio,
      row.dependency_issues_identified,
      row.dependency_issues_validated,
      row.dependency_validation_ratio,
      row.risk_items_identified,
      row.risk_recommendations_accepted,
      row.risk_acceptance_ratio,
      row.estimation_baseline,
      row.ai_supported_estimate,
      row.estimation_variance,
      row.estimation_variance_percent,
      row.clarification_requests,
      row.task_completion_success,
      row.system_response_ms,
      row.error_count,
      row.evaluator_comments,
      row.observations,
      row.limitations,
      row.notes,
      row.interview_notes,
      row.created_at
    ]

    await dbRun(
      db,
      `INSERT INTO thesis_evaluations (
        scenario_id,
        scenario_name,
        planning_session_id,
        team_id,
        team_name,
        sprint_id,
        sprint_name,
        participant_id,
        participant_role,
        evaluator_id,
        evaluator_role,
        evaluated_at,
        perceived_usefulness,
        ease_of_use,
        trust,
        intention_to_use,
        task_completion_minutes,
        baseline_manual_planning_minutes,
        ai_assisted_planning_minutes,
        time_reduction_minutes,
        time_reduction_percent,
        recommendations_generated,
        recommendations_accepted,
        recommendation_acceptance_ratio,
        dependency_issues_identified,
        dependency_issues_validated,
        dependency_validation_ratio,
        risk_items_identified,
        risk_recommendations_accepted,
        risk_acceptance_ratio,
        estimation_baseline,
        ai_supported_estimate,
        estimation_variance,
        estimation_variance_percent,
        clarification_requests,
        task_completion_success,
        system_response_ms,
        error_count,
        evaluator_comments,
        observations,
        limitations,
        notes,
        interview_notes,
        created_at
      ) VALUES (${insertValues.map(() => '?').join(', ')})`,
      insertValues
    )
  }

  return {
    scenarioRuns: runs.length,
    scenarioInteractions: interactions.length,
    thesisEvaluations: evaluations.length
  }
}

async function summarizeDatabaseState(db) {
  const [latestSession] = await dbAll(
    db,
    `SELECT id, title, team_name, sprint_name, status, created_at
     FROM planning_sessions
     ORDER BY created_at DESC
     LIMIT 1`
  )

  const counts = {}
  for (const tableName of TRACKED_TABLES) {
    counts[tableName] = await countTableRows(db, tableName)
  }

  return {
    counts,
    latestSession: latestSession || null
  }
}

function readActiveProfile() {
  const active = readJson(ACTIVE_PROFILE_PATH, null)
  if (!active || !active.profile) {
    return {
      profile: DEFAULT_PROFILE,
      lastAction: 'unknown',
      updatedAt: null
    }
  }
  return active
}

function summarizeFileState() {
  const teamSetup = readJson(TEAM_SETUP_PATH, { teams: [], sprints: [] })
  const backlog = readJson(BACKLOG_PATH, { items: [] })

  return {
    teams: Array.isArray(teamSetup.teams) ? teamSetup.teams.length : 0,
    sprints: Array.isArray(teamSetup.sprints) ? teamSetup.sprints.length : 0,
    backlogItems: Array.isArray(backlog.items) ? backlog.items.length : 0,
    activeSprint: (teamSetup.sprints || []).find((row) => row.status === 'Active')?.name || null
  }
}

export async function getDemoDataStatus() {
  const fileData = summarizeFileState()
  const activeProfile = readActiveProfile()

  const dbData = await withDb(async (db) => summarizeDatabaseState(db))

  return {
    activeProfile,
    fileData,
    dbData
  }
}

export async function loadThesisDemoData({ profile = THESIS_PROFILE, actor = 'Demo Operator' } = {}) {
  const { profileName, teamSetup, planningBacklog } = readSeedProfile(profile)
  writeTargetFiles({ teamSetup, planningBacklog })

  const planningContext = buildPlanningContext({ teamSetup, planningBacklog })

  const report = await withDb(async (db) => {
    const cleared = await clearTrackedTables(db)
    const businessRequests = await insertBusinessRequests(db, planningContext)
    const planning = await insertPlanningSessionArtifacts(db, planningContext, actor)
    const evaluation = await insertScenarioRunsAndEvidence(db, planningContext)

    return {
      cleared,
      inserted: {
        businessRequests,
        ...planning,
        ...evaluation
      }
    }
  })

  setActiveProfile(profileName, 'load')

  return {
    action: 'load',
    profile: profileName,
    fileData: {
      teams: teamSetup.teams.length,
      sprints: teamSetup.sprints.length,
      backlogItems: planningBacklog.items.length,
      activeSprint: (teamSetup.sprints || []).find((row) => row.status === 'Active')?.name || null
    },
    report
  }
}

export async function resetDemoData({ actor = 'Demo Operator' } = {}) {
  const { profileName, teamSetup, planningBacklog } = readSeedProfile(DEFAULT_PROFILE)
  writeTargetFiles({ teamSetup, planningBacklog })

  const report = await withDb(async (db) => {
    const cleared = await clearTrackedTables(db)
    await dbRun(
      db,
      `INSERT INTO audit_logs (br_id, stage, actor, action, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [
        'SYSTEM-DEMO-RESET',
        'Administration',
        actor,
        'Reset demo data to default profile',
        JSON.stringify({ profile: profileName }),
        DEMO_TS.evaluations
      ]
    )

    return {
      cleared,
      inserted: {
        auditLogs: 1
      }
    }
  })

  setActiveProfile(profileName, 'reset')

  return {
    action: 'reset',
    profile: profileName,
    fileData: {
      teams: teamSetup.teams.length,
      sprints: teamSetup.sprints.length,
      backlogItems: planningBacklog.items.length,
      activeSprint: (teamSetup.sprints || []).find((row) => row.status === 'Active')?.name || null
    },
    report
  }
}