import fs from 'fs'
import path from 'path'

const configPath = path.join(process.cwd(), 'data', 'team-setup.json')

const defaultSetup = {
  teams: [
    {
      id: 'team-dubai',
      name: 'Dubai Team',
      region: 'Dubai',
      members: [
        { name: 'Alaa Alsarayrah', role: 'Product Owner', type: 'Human', email: '' },
        { name: 'Noura Khan', role: 'Developer', type: 'Human', email: '' },
        { name: 'Yousef Rahman', role: 'Tester', type: 'Human', email: '' },
        { name: 'Lina Haddad', role: 'Business Analyst', type: 'Human', email: '' },
        { name: 'AI Dev Agent - Dubai', role: 'Developer', type: 'AI Agent' },
        { name: 'AI QA Agent - Dubai', role: 'Tester', type: 'AI Agent' },
        { name: 'AI BA Agent - Dubai', role: 'Business Analyst', type: 'AI Agent' }
      ]
    },
    {
      id: 'team-rak',
      name: 'RAK Team',
      region: 'Ras Al Khaimah',
      members: [
        { name: 'Mariam Saeed', role: 'Scrum Master', type: 'Human', email: '' },
        { name: 'Khaled Omar', role: 'Developer', type: 'Human', email: '' },
        { name: 'Rashid Noor', role: 'Tester', type: 'Human', email: '' },
        { name: 'Dana Karim', role: 'Business Analyst', type: 'Human', email: '' },
        { name: 'AI Dev Agent - RAK', role: 'Developer', type: 'AI Agent' },
        { name: 'AI QA Agent - RAK', role: 'Tester', type: 'AI Agent' },
        { name: 'AI BA Agent - RAK', role: 'Business Analyst', type: 'AI Agent' }
      ]
    },
    {
      id: 'team-auh',
      name: 'AUH Team',
      region: 'Abu Dhabi',
      members: [
        { name: 'Fatima Ali', role: 'Delivery Lead', type: 'Human', email: '' },
        { name: 'Hassan Salem', role: 'Developer', type: 'Human', email: '' },
        { name: 'Iman Khalifa', role: 'Tester', type: 'Human', email: '' },
        { name: 'Omar Nasser', role: 'Business Analyst', type: 'Human', email: '' },
        { name: 'AI Dev Agent - AUH', role: 'Developer', type: 'AI Agent' },
        { name: 'AI QA Agent - AUH', role: 'Tester', type: 'AI Agent' },
        { name: 'AI BA Agent - AUH', role: 'Business Analyst', type: 'AI Agent' }
      ]
    }
  ],
  sprints: [
    {
      id: 'sprint-1',
      name: 'Sprint 1',
      startDate: '2026-03-10',
      endDate: '2026-03-23',
      status: 'Planned'
    },
    {
      id: 'sprint-2',
      name: 'Sprint 2',
      startDate: '2026-03-24',
      endDate: '2026-04-06',
      status: 'Planned'
    }
  ]
}

function ensureSetup() {
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultSetup, null, 2), 'utf-8')
  }
}

function readSetup() {
  ensureSetup()
  const raw = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(raw)
}

function writeSetup(data) {
  ensureSetup()
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8')
}

function normalizeSetup(setup) {
  setup.teams = (setup.teams || []).map((team) => ({
    ...team,
    members: (team.members || []).map((m) => {
      if (m.type === 'Human') {
        return { ...m, email: m.email || '' }
      }
      return m
    })
  }))
  return setup
}

export default function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const setup = normalizeSetup(readSetup())
      return res.status(200).json(setup)
    }

    if (req.method === 'POST') {
      const setup = readSetup()
      const teamNames = new Set((setup.teams || []).map((t) => t.name))
      for (const t of defaultSetup.teams) {
        if (!teamNames.has(t.name)) {
          setup.teams.push(t)
        }
      }

      const sprintNames = new Set((setup.sprints || []).map((s) => s.name))
      for (const s of defaultSetup.sprints) {
        if (!sprintNames.has(s.name)) {
          setup.sprints.push(s)
        }
      }

      const normalized = normalizeSetup(setup)
      writeSetup(normalized)
      return res.status(200).json({ success: true, setup: normalized })
    }

    if (req.method === 'PATCH') {
      const setup = normalizeSetup(readSetup())
      const emailUpdates = req.body?.emailUpdates || []

      if (!Array.isArray(emailUpdates)) {
        return res.status(400).json({ message: 'emailUpdates must be an array' })
      }

      const map = new Map()
      for (const u of emailUpdates) {
        if (!u || !u.teamName || !u.memberName) continue
        map.set(`${u.teamName}::${u.memberName}`, (u.email || '').trim())
      }

      for (const team of setup.teams || []) {
        for (const member of team.members || []) {
          const key = `${team.name}::${member.name}`
          if (map.has(key) && member.type === 'Human') {
            member.email = map.get(key)
          }
        }
      }

      writeSetup(setup)
      return res.status(200).json({ success: true, setup })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ message: 'Team setup error', error: String(err) })
  }
}