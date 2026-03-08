import {
  dbAll,
  ensureSchema,
  openDb,
  closeDb
} from '../_lib/requests-db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const brId = String(req.query.brId || '').trim()
  if (!brId) {
    return res.status(400).json({ message: 'Missing brId' })
  }

  const initialSinceId = Number(req.query.sinceId || 0)
  let lastId = Number.isFinite(initialSinceId) ? initialSinceId : 0

  const db = openDb()
  await ensureSchema(db)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  res.write('retry: 2000\n\n')

  let closed = false

  const sendEvents = async () => {
    if (closed) return
    try {
      const rows = await dbAll(
        db,
        `SELECT id, br_id, stage, event_type, message, payload, created_at
         FROM orchestrator_events
         WHERE br_id = ? AND id > ?
         ORDER BY id ASC
         LIMIT 100`,
        [brId, lastId]
      )

      for (const row of rows) {
        lastId = row.id

        let payload = null
        if (row.payload) {
          try {
            payload = JSON.parse(row.payload)
          } catch {
            payload = row.payload
          }
        }

        const event = {
          id: row.id,
          br_id: row.br_id,
          stage: row.stage,
          event_type: row.event_type,
          message: row.message,
          payload,
          created_at: row.created_at
        }

        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: String(err.message || err) })}\n\n`)
    }
  }

  const pollHandle = setInterval(() => {
    void sendEvents()
  }, 1500)

  const heartbeatHandle = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 15000)

  await sendEvents()

  const cleanup = async () => {
    if (closed) return
    closed = true
    clearInterval(pollHandle)
    clearInterval(heartbeatHandle)
    await closeDb(db)
    try {
      res.end()
    } catch {
      // ignore errors while closing stream
    }
  }

  req.on('close', () => {
    void cleanup()
  })

  req.on('aborted', () => {
    void cleanup()
  })
}
