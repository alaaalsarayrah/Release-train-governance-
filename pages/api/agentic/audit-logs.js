import { clearAuditLogs, getAuditLogs } from '../_lib/requests-db'
import { requireAdmin } from '../_lib/auth'

function parseFilters(query) {
  const brId = query.brId ? String(query.brId) : null
  const actor = query.actor ? String(query.actor) : null
  const stage = query.stage ? String(query.stage) : null
  const textQuery = query.query ? String(query.query) : null
  const from = query.from ? String(query.from) : null
  const toDate = query.to ? String(query.to) : null
  const to = toDate && toDate.length <= 10 ? `${toDate} 23:59:59` : toDate
  const limit = query.limit ? Number(query.limit) : 300
  return { brId, actor, stage, query: textQuery, from, to, limit }
}

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  const escaped = text.replace(/"/g, '""')
  return `"${escaped}"`
}

function toCsv(logs) {
  const headers = ['id', 'created_at', 'br_id', 'stage', 'actor', 'action', 'details']
  const rows = logs.map((log) => {
    const details = log.details && typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || '')
    return [
      csvEscape(log.id),
      csvEscape(log.created_at),
      csvEscape(log.br_id),
      csvEscape(log.stage),
      csvEscape(log.actor),
      csvEscape(log.action),
      csvEscape(details)
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

export default async function handler(req, res) {
  if (!['GET', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    if (req.method === 'DELETE') {
      const adminSession = requireAdmin(req, res)
      if (!adminSession) return

      const brId = req.query.brId ? String(req.query.brId) : null
      await clearAuditLogs({ brId })
      return res.status(200).json({
        success: true,
        cleared: brId ? `audit logs for ${brId}` : 'all audit logs'
      })
    }

    const filters = parseFilters(req.query)
    const logs = await getAuditLogs(filters)

    if (String(req.query.format || '').toLowerCase() === 'csv') {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
      const csv = toCsv(logs)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${stamp}.csv"`)
      return res.status(200).send(csv)
    }

    return res.status(200).json({ logs })
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load audit logs', error: String(err.message || err) })
  }
}
