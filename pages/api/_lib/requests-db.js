import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'

const dbPath = path.join(process.cwd(), 'data', 'requests.db')

export function openDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  return new sqlite3.Database(dbPath)
}

export function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err)
        return
      }
      resolve(this)
    })
  })
}

export function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err)
        return
      }
      resolve(row || null)
    })
  })
}

export function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows || [])
    })
  })
}

export function closeDb(db) {
  return new Promise((resolve) => {
    db.close(() => resolve())
  })
}

async function safeAlter(db, sql) {
  try {
    await dbRun(db, sql)
  } catch (err) {
    if (!String(err.message || err).includes('duplicate column')) {
      throw err
    }
  }
}

export async function ensureSchema(db) {
  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS business_requests (
      id TEXT PRIMARY KEY,
      description TEXT,
      unit TEXT,
      urgency TEXT,
      date TEXT,
      justif TEXT,
      status TEXT DEFAULT 'Pending',
      decision_reason TEXT,
      requirement_created INTEGER DEFAULT 0,
      requirement_doc TEXT,
      requirement_details TEXT,
      synced_to_ado INTEGER DEFAULT 0,
      ado_backlog_id TEXT,
      team_name TEXT,
      sprint_name TEXT,
      epic_status TEXT,
      user_story_status TEXT,
      stage1_status TEXT DEFAULT 'Not Started',
      stage1_output TEXT,
      stage1_error TEXT,
      stage1_completed_at TEXT,
      stage1_ado_work_item_id TEXT,
      stage1_model TEXT,
      demand_status TEXT DEFAULT 'Not Started',
      demand_output TEXT,
      demand_model TEXT,
      demand_review_status TEXT DEFAULT 'Not Reviewed',
      demand_review_reason TEXT,
      demand_reviewed_at TEXT,
      demand_ado_work_item_id TEXT,
      requirement_status TEXT DEFAULT 'Not Started',
      requirement_brd_version INTEGER DEFAULT 0,
      requirement_review_status TEXT DEFAULT 'Not Reviewed',
      requirement_review_reason TEXT,
      requirement_reviewed_at TEXT,
      requirement_ado_work_item_id TEXT,
      workflow_current_stage TEXT DEFAULT 'Business Request',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN status TEXT DEFAULT 'Pending'")
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN decision_reason TEXT')
  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN requirement_created INTEGER DEFAULT 0")
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN requirement_doc TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN requirement_details TEXT')
  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN synced_to_ado INTEGER DEFAULT 0")
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN ado_backlog_id TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN team_name TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN sprint_name TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN epic_status TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN user_story_status TEXT')
  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN stage1_status TEXT DEFAULT 'Not Started'")
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN stage1_output TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN stage1_error TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN stage1_completed_at TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN stage1_ado_work_item_id TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN stage1_model TEXT')
  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN demand_status TEXT DEFAULT 'Not Started'")
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN demand_output TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN demand_model TEXT')
  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN demand_review_status TEXT DEFAULT 'Not Reviewed'")
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN demand_review_reason TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN demand_reviewed_at TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN demand_ado_work_item_id TEXT')
  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN requirement_status TEXT DEFAULT 'Not Started'")
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN requirement_brd_version INTEGER DEFAULT 0')
  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN requirement_review_status TEXT DEFAULT 'Not Reviewed'")
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN requirement_review_reason TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN requirement_reviewed_at TEXT')
  await safeAlter(db, 'ALTER TABLE business_requests ADD COLUMN requirement_ado_work_item_id TEXT')
  await safeAlter(db, "ALTER TABLE business_requests ADD COLUMN workflow_current_stage TEXT DEFAULT 'Business Request'")

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS orchestrator_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      br_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      br_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )
}

export async function withDb(work) {
  const db = openDb()
  try {
    await ensureSchema(db)
    return await work(db)
  } finally {
    await closeDb(db)
  }
}

export async function addOrchestratorEvent({ brId, stage, eventType, message, payload = null }) {
  return withDb(async (db) => {
    await dbRun(
      db,
      `INSERT INTO orchestrator_events (br_id, stage, event_type, message, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [brId, stage, eventType, message, payload ? JSON.stringify(payload) : null]
    )
  })
}

export async function getOrchestratorEvents(brId, afterId = 0, limit = 100) {
  return withDb(async (db) => {
    const rows = await dbAll(
      db,
      `SELECT id, br_id, stage, event_type, message, payload, created_at
       FROM orchestrator_events
       WHERE br_id = ? AND id > ?
       ORDER BY id ASC
       LIMIT ?`,
      [brId, afterId, limit]
    )

    return rows.map((row) => {
      let parsedPayload = null
      if (row.payload) {
        try {
          parsedPayload = JSON.parse(row.payload)
        } catch {
          parsedPayload = row.payload
        }
      }
      return {
        ...row,
        payload: parsedPayload
      }
    })
  })
}

export async function updateBusinessRequestFields(db, id, fields) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return

  const updates = entries.map(([key]) => `${key} = ?`).join(', ')
  const values = entries.map(([, value]) => value)
  values.push(id)

  await dbRun(db, `UPDATE business_requests SET ${updates} WHERE id = ?`, values)
}

export async function addAuditLog({ brId, stage, actor, action, details = null }) {
  return withDb(async (db) => {
    await dbRun(
      db,
      `INSERT INTO audit_logs (br_id, stage, actor, action, details)
       VALUES (?, ?, ?, ?, ?)`,
      [brId, stage, actor, action, details ? JSON.stringify(details) : null]
    )
  })
}

export async function getAuditLogs({
  brId = null,
  actor = null,
  stage = null,
  from = null,
  to = null,
  query = null,
  limit = 300
}) {
  return withDb(async (db) => {
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(Number(limit), 1000)) : 300
    const clauses = []
    const params = []

    if (brId) {
      clauses.push('br_id = ?')
      params.push(brId)
    }

    if (actor) {
      clauses.push('LOWER(actor) LIKE ?')
      params.push(`%${String(actor).toLowerCase()}%`)
    }

    if (stage) {
      clauses.push('LOWER(stage) LIKE ?')
      params.push(`%${String(stage).toLowerCase()}%`)
    }

    if (from) {
      clauses.push('datetime(created_at) >= datetime(?)')
      params.push(from)
    }

    if (to) {
      clauses.push('datetime(created_at) <= datetime(?)')
      params.push(to)
    }

    if (query) {
      const q = `%${String(query).toLowerCase()}%`
      clauses.push('(LOWER(action) LIKE ? OR LOWER(actor) LIKE ? OR LOWER(stage) LIKE ? OR LOWER(br_id) LIKE ? OR LOWER(COALESCE(details, "")) LIKE ?)')
      params.push(q, q, q, q, q)
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = await dbAll(
      db,
      `SELECT id, br_id, stage, actor, action, details, created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY id DESC
       LIMIT ?`,
      [...params, safeLimit]
    )

    return rows.map((row) => {
      let parsedDetails = null
      if (row.details) {
        try {
          parsedDetails = JSON.parse(row.details)
        } catch {
          parsedDetails = row.details
        }
      }

      return {
        ...row,
        details: parsedDetails
      }
    })
  })
}

export async function clearAuditLogs({ brId = null } = {}) {
  return withDb(async (db) => {
    if (brId) {
      await dbRun(db, 'DELETE FROM audit_logs WHERE br_id = ?', [brId])
      return
    }
    await dbRun(db, 'DELETE FROM audit_logs')
  })
}
