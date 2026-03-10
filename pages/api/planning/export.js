import { getPlanningSessionWithChildren, getScenarioRuns } from '../../../lib/planning/planning-db'

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  return `"${String(value).replace(/"/g, '""')}"`
}

function toCsv(headers, rows) {
  return [headers.join(','), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))].join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const type = String(req.query.type || 'summary').toLowerCase()
    const format = String(req.query.format || 'json').toLowerCase()
    const sessionId = String(req.query.sessionId || '').trim()

    if (type === 'evaluation-metrics') {
      const runs = await getScenarioRuns(Number(req.query.limit || 500))
      if (format === 'csv') {
        const headers = [
          'id', 'scenario_key', 'scenario_name', 'participant_id', 'participant_role',
          'started_at', 'ended_at', 'duration_seconds', 'recommendations_shown',
          'accepted_count', 'modified_count', 'rejected_count', 'clarification_requests',
          'perceived_usefulness', 'ease_of_use', 'trust', 'intention_to_use', 'notes'
        ]
        const csv = toCsv(headers, runs)
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="evaluation-metrics.csv"')
        return res.status(200).send(csv)
      }

      return res.status(200).json({ runs })
    }

    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId is required for planning exports' })
    }

    const session = await getPlanningSessionWithChildren(sessionId)
    if (!session) return res.status(404).json({ message: 'Planning session not found' })

    const payloadByType = {
      summary: session.final_summary || {
        session_id: session.id,
        title: session.title,
        team: session.team_name,
        sprint: session.sprint_name,
        outputs_count: session.outputs.length,
        decisions_count: session.decisions.length
      },
      dependencies: session.dependencies,
      risks: session.risks,
      architecture: session.architectureNotes,
      estimation: session.estimates,
      'human-decisions': session.decisions,
      'sprint-summary': session.final_summary || null,
      'override-logs': session.decisions.filter((d) => String(d.decision).toLowerCase() === 'modify')
    }

    const selected = payloadByType[type]
    if (selected === undefined) {
      return res.status(400).json({ message: `Unsupported export type: ${type}` })
    }

    if (format === 'csv') {
      if (!Array.isArray(selected)) {
        const csv = toCsv(Object.keys(selected || {}), [selected || {}])
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${type}-${sessionId}.csv"`)
        return res.status(200).send(csv)
      }

      const headers = selected.length ? Object.keys(selected[0]) : ['empty']
      const csv = toCsv(headers, selected.length ? selected : [{ empty: '' }])
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${type}-${sessionId}.csv"`)
      return res.status(200).send(csv)
    }

    return res.status(200).json({ type, sessionId, data: selected })
  } catch (err) {
    return res.status(500).json({ message: 'Export failed', error: String(err?.message || err) })
  }
}
