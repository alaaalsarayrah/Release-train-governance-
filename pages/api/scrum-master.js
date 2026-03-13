import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'

const dbPath = path.join(process.cwd(), 'data', 'requests.db')

function getDb() {
  return new sqlite3.Database(dbPath)
}

function safeParseRequirementDetails(value) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function inferWorkTypeFromText(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('compliance') || text.includes('audit') || text.includes('risk') || text.includes('defect') || text.includes('bug')) {
    return 'Defect-Risk'
  }
  if (text.includes('automation') || text.includes('platform') || text.includes('architecture') || text.includes('integration') || text.includes('workflow')) {
    return 'Enabler'
  }
  return 'Business'
}

function mapUrgencyToTimeCriticality(urgency) {
  const normalized = String(urgency || '').toLowerCase()
  if (normalized.includes('high')) return 20
  if (normalized.includes('low')) return 8
  return 13
}

function mapPriorityToBusinessValue(priority) {
  const normalized = String(priority || '').toLowerCase()
  if (normalized.includes('high')) return 20
  if (normalized.includes('low')) return 8
  return 13
}

function applySafeSignals(features, userStories, urgency) {
  const urgencyScore = mapUrgencyToTimeCriticality(urgency)
  const storiesByFeature = new Map()
  for (const story of userStories) {
    const key = String(story.feature || '').trim()
    if (!storiesByFeature.has(key)) storiesByFeature.set(key, [])
    storiesByFeature.get(key).push(story)
  }

  const enrichedFeatures = features.map((feature) => {
    const workType = inferWorkTypeFromText(`${feature.title || ''} ${feature.description || ''}`)
    const featureStories = storiesByFeature.get(String(feature.title || '').trim()) || []
    const storyPoints = featureStories.reduce((sum, story) => sum + (Number(story.points || 0) || 0), 0)
    const jobSize = Math.max(3, Math.round(storyPoints || featureStories.length || 3))
    const businessValue = mapPriorityToBusinessValue(feature.priority)
    const riskReductionOpportunity = workType === 'Defect-Risk' ? 13 : (workType === 'Enabler' ? 8 : 5)
    const wsjfScore = Number(((businessValue + urgencyScore + riskReductionOpportunity) / jobSize).toFixed(2))

    return {
      ...feature,
      workType,
      wsjf: {
        businessValue,
        timeCriticality: urgencyScore,
        riskReductionOpportunity,
        jobSize,
        score: wsjfScore
      },
      wsjfScore
    }
  })

  const featureWorkTypeMap = new Map(enrichedFeatures.map((feature) => [String(feature.title || '').trim(), feature.workType]))
  const perFeatureChains = new Map()
  const enrichedStories = userStories.map((story) => {
    const featureKey = String(story.feature || '').trim()
    const workType = featureWorkTypeMap.get(featureKey) || inferWorkTypeFromText(story.title)
    const next = {
      ...story,
      workType,
      dependencies: Array.isArray(story.dependencies) ? story.dependencies : []
    }

    if (!perFeatureChains.has(featureKey)) perFeatureChains.set(featureKey, [])
    perFeatureChains.get(featureKey).push(next)
    return next
  })

  for (const list of perFeatureChains.values()) {
    for (let i = 1; i < list.length; i++) {
      if ((list[i].dependencies || []).length > 0) continue
      list[i].dependencies = [
        {
          type: 'Blocks',
          story: list[i - 1].title,
          crossTeam: i % 3 === 0,
          ageDays: 2 + (i * 2)
        }
      ]
    }
  }

  return {
    features: enrichedFeatures,
    userStories: enrichedStories
  }
}

// AI Agent that analyzes requirements and generates backlog items
function generateBacklogFromRequirements(br) {
  const requirementDetails = safeParseRequirementDetails(br.requirement_details)
  const { demand, resourcePlanning, budget, deliveryMethod, details } = requirementDetails
  
  // Combine all requirement text
  const allText = [demand, resourcePlanning, details, br.description].filter(Boolean).join(' ').toLowerCase()
  
  // AI-driven categorization based on loan servicing domain
  const epics = []
  const features = []
  const userStories = []
  
  // Epic 1: Core Loan Servicing Platform
  epics.push({
    title: 'Loan Servicing Platform Modernization',
    description: 'Modernize the loan servicing platform to support improved customer experience, operational efficiency, and regulatory compliance',
    businessValue: 'High - Enables scalable growth and improved customer satisfaction',
    effort: budget || 'To be estimated'
  })
  
  // Detect features based on keywords
  const keywords = {
    payment: ['payment', 'pay', 'transaction', 'billing'],
    account: ['account', 'customer', 'profile', 'user'],
    notification: ['notification', 'alert', 'email', 'sms', 'communicate'],
    reporting: ['report', 'dashboard', 'analytics', 'data'],
    automation: ['automate', 'automatic', 'workflow', 'process'],
    compliance: ['compliance', 'regulatory', 'audit', 'rule']
  }
  
  // Generate features based on detected keywords
  if (keywords.payment.some(kw => allText.includes(kw))) {
    features.push({
      title: 'Payment Processing System',
      description: 'Enable customers to make loan payments through multiple channels with real-time processing',
      epic: 'Loan Servicing Platform Modernization',
      priority: 'High'
    })
    
    userStories.push({
      title: 'Customer can make a one-time payment',
      userStory: 'As a loan customer, I want to make a one-time payment on my loan, so that I can reduce my outstanding balance',
      acceptanceCriteria: [
        'Customer can select payment amount',
        'Multiple payment methods supported (credit card, debit card, ACH)',
        'Payment confirmation is displayed immediately',
        'Receipt is sent via email'
      ],
      feature: 'Payment Processing System',
      points: '5'
    })
    
    userStories.push({
      title: 'Customer can set up automatic payments',
      userStory: 'As a loan customer, I want to set up automatic monthly payments, so that I never miss a payment',
      acceptanceCriteria: [
        'Customer can schedule recurring payments',
        'Payment date and amount are configurable',
        'Customer receives reminder before each payment',
        'Customer can cancel or modify auto-pay settings'
      ],
      feature: 'Payment Processing System',
      points: '8'
    })
  }
  
  if (keywords.account.some(kw => allText.includes(kw))) {
    features.push({
      title: 'Customer Account Management',
      description: 'Provide customers with comprehensive account management capabilities and self-service options',
      epic: 'Loan Servicing Platform Modernization',
      priority: 'High'
    })
    
    userStories.push({
      title: 'Customer can view loan details',
      userStory: 'As a loan customer, I want to view my loan balance, payment history, and terms, so that I can track my loan status',
      acceptanceCriteria: [
        'Display current balance and payoff amount',
        'Show payment history for last 12 months',
        'Display loan terms (rate, duration, etc.)',
        'Show next payment due date and amount'
      ],
      feature: 'Customer Account Management',
      points: '3'
    })
    
    userStories.push({
      title: 'Customer can update contact information',
      userStory: 'As a loan customer, I want to update my contact information, so that I receive important communications',
      acceptanceCriteria: [
        'Customer can update email address',
        'Customer can update phone number',
        'Customer can update mailing address',
        'Changes are validated and saved immediately'
      ],
      feature: 'Customer Account Management',
      points: '3'
    })
  }
  
  if (keywords.notification.some(kw => allText.includes(kw))) {
    features.push({
      title: 'Customer Communication System',
      description: 'Automated notification system to keep customers informed about their loan status and important events',
      epic: 'Loan Servicing Platform Modernization',
      priority: 'Medium'
    })
    
    userStories.push({
      title: 'Customer receives payment due reminders',
      userStory: 'As a loan customer, I want to receive reminders before my payment is due, so that I can avoid late fees',
      acceptanceCriteria: [
        'Reminder sent 7 days before due date',
        'Reminder sent 1 day before due date',
        'Customer can choose email or SMS notification',
        'Reminder includes amount due and payment options'
      ],
      feature: 'Customer Communication System',
      points: '5'
    })
  }
  
  if (keywords.reporting.some(kw => allText.includes(kw))) {
    features.push({
      title: 'Servicing Analytics Dashboard',
      description: 'Real-time dashboard for loan servicing operations team to monitor portfolio performance',
      epic: 'Loan Servicing Platform Modernization',
      priority: 'Medium'
    })
    
    userStories.push({
      title: 'Operations team can view portfolio metrics',
      userStory: 'As an operations manager, I want to view key portfolio metrics, so that I can monitor business performance',
      acceptanceCriteria: [
        'Display total loans, active loans, and delinquent loans',
        'Show payment collection rates',
        'Display portfolio balance trends',
        'Refresh data in real-time'
      ],
      feature: 'Servicing Analytics Dashboard',
      points: '8'
    })
  }
  
  if (keywords.automation.some(kw => allText.includes(kw))) {
    features.push({
      title: 'Workflow Automation Engine',
      description: 'Automate routine loan servicing tasks to improve efficiency and reduce manual errors',
      epic: 'Loan Servicing Platform Modernization',
      priority: 'High'
    })
    
    userStories.push({
      title: 'System automatically processes payments',
      userStory: 'As a loan servicer, I want payments to be processed automatically, so that I can reduce manual work',
      acceptanceCriteria: [
        'Payments are applied to principal and interest automatically',
        'Payment confirmations are generated automatically',
        'Failed payments trigger automatic retry logic',
        'All actions are logged for audit'
      ],
      feature: 'Workflow Automation Engine',
      points: '13'
    })
  }
  
  if (keywords.compliance.some(kw => allText.includes(kw))) {
    features.push({
      title: 'Compliance and Audit System',
      description: 'Ensure all loan servicing activities comply with regulatory requirements and maintain audit trails',
      epic: 'Loan Servicing Platform Modernization',
      priority: 'High'
    })
    
    userStories.push({
      title: 'System maintains complete audit trail',
      userStory: 'As a compliance officer, I want all system actions to be logged, so that I can demonstrate regulatory compliance',
      acceptanceCriteria: [
        'All user actions are logged with timestamp',
        'All system changes are tracked',
        'Audit logs are immutable',
        'Logs are retained per regulatory requirements'
      ],
      feature: 'Compliance and Audit System',
      points: '8'
    })
  }
  
  // If no specific features detected, add generic ones
  if (features.length === 0) {
    features.push({
      title: 'Core Loan Management',
      description: 'Foundational loan management capabilities for the servicing platform',
      epic: 'Loan Servicing Platform Modernization',
      priority: 'High'
    })
    
    userStories.push({
      title: 'System can create new loan account',
      userStory: 'As a loan officer, I want to create new loan accounts, so that I can onboard new customers',
      acceptanceCriteria: [
        'Collect all required loan information',
        'Validate loan terms and conditions',
        'Generate unique loan account number',
        'Set up payment schedule'
      ],
      feature: 'Core Loan Management',
      points: '8'
    })
  }
  
  // Epic 2: Based on delivery method
  if (deliveryMethod === 'Agile' || deliveryMethod === 'Hybrid') {
    epics.push({
      title: 'Agile Transformation Initiative',
      description: `Transform development process to ${deliveryMethod} methodology for faster delivery and improved quality`,
      businessValue: 'Medium - Improves team velocity and product quality',
      effort: '6 months'
    })
  }
  
  const safeSignals = applySafeSignals(features, userStories, br.urgency)

  return {
    epics,
    features: safeSignals.features,
    userStories: safeSignals.userStories,
    metadata: {
      brId: br.id,
      generatedAt: new Date().toISOString(),
      squad: 'Loan Servicing Squad',
      deliveryMethod: deliveryMethod || 'To be determined'
    }
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  
  const { brId } = req.body || {}
  if (!brId) {
    return res.status(400).json({ message: 'Missing brId' })
  }
  
  const db = getDb()
  
  db.get('SELECT * FROM business_requests WHERE id = ?', [brId], (err, br) => {
    if (err) {
      console.error('DB error', err)
      db.close()
      return res.status(500).json({ message: 'Database error', error: err.message })
    }
    
    if (!br) {
      db.close()
      return res.status(404).json({ message: 'Business request not found' })
    }
    
    if (!br.requirement_created) {
      db.close()
      return res.status(400).json({ message: 'Requirements not yet created for this BR' })
    }
    
    // Generate backlog using AI agent
    const backlog = generateBacklogFromRequirements(br)
    
    db.close()
    res.status(200).json({ success: true, backlog })
  })
}
