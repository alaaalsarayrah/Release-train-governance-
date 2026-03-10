export const PLANNING_AGENT_KEYS = [
  'product_owner_assistant',
  'estimation_advisor',
  'dependency_analyst',
  'architect_advisor',
  'risk_analyst'
]

export const PLANNING_OUTPUT_TEMPLATE = {
  agent_key: '',
  summary: '',
  recommendations: [],
  rationale: '',
  confidence: 0,
  risks: [],
  follow_up_questions: [],
  artifacts: {}
}

export const ARCHITECTURE_NOTE_TEMPLATE = {
  impacted_components: [],
  assumptions: [],
  constraints: [],
  technical_enablers: [],
  architecture_risks: [],
  recommended_actions: [],
  rationale: ''
}

export const DEFAULT_SCENARIOS = [
  {
    key: 'backlog-refinement',
    name: 'Backlog refinement scenario',
    instructions:
      'Review a mixed-quality backlog, identify readiness gaps, and prioritize items for sprint planning.',
    syntheticData: {
      team: 'Dubai Team',
      sprint: 'Sprint 1',
      capacityPoints: 34,
      backlogItems: [
        { id: 'US-101', title: 'As a customer, I can view invoices', businessValue: 9, acceptanceCriteriaCount: 2 },
        { id: 'US-102', title: 'As an admin, I can export invoices', businessValue: 7, acceptanceCriteriaCount: 1 },
        { id: 'US-103', title: 'Refactor invoice data service', businessValue: 6, acceptanceCriteriaCount: 0 }
      ]
    }
  },
  {
    key: 'sprint-preparation',
    name: 'Sprint planning preparation scenario',
    instructions:
      'Estimate selected stories, check sprint capacity fit, and identify low-confidence assumptions before commitment.',
    syntheticData: {
      team: 'RAK Team',
      sprint: 'Sprint 1',
      capacityPoints: 28,
      backlogItems: [
        { id: 'US-201', title: 'Story A', complexity: 'high', dependencies: 1 },
        { id: 'US-202', title: 'Story B', complexity: 'medium', dependencies: 0 },
        { id: 'US-203', title: 'Story C', complexity: 'low', dependencies: 2 }
      ]
    }
  },
  {
    key: 'dependency-risk-review',
    name: 'Dependency and risk review scenario',
    instructions:
      'Analyze dependency chains, architecture concerns, and produce a sprint risk register with mitigations.',
    syntheticData: {
      team: 'AUH Team',
      sprint: 'Sprint 2',
      capacityPoints: 30,
      backlogItems: [
        { id: 'US-301', title: 'Integrate payment gateway', integration: 'external-api' },
        { id: 'US-302', title: 'Implement fraud scoring', integration: 'ml-service' },
        { id: 'US-303', title: 'Update transaction UI', integration: 'frontend' }
      ]
    }
  }
]
