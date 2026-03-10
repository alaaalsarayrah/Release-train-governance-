import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { createClient } from '@libsql/client'

const bundledDbPath = path.join(process.cwd(), 'data', 'requests.db')
const remoteDbUrl = String(
  process.env.REQUESTS_DB_URL || process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || ''
).trim()
const remoteDbAuthToken = String(
  process.env.REQUESTS_DB_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || ''
).trim()

let sharedLibsqlClient = null
let libsqlSchemaPromise = null

function useRemoteDb() {
  return Boolean(remoteDbUrl)
}

function getLibsqlClient() {
  if (!sharedLibsqlClient) {
    sharedLibsqlClient = createClient({
      url: remoteDbUrl,
      authToken: remoteDbAuthToken || undefined
    })
  }
  return sharedLibsqlClient
}

function resolveDbPath() {
  const configured = String(process.env.REQUESTS_DB_PATH || '').trim()
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured)
  }

  // Vercel deployments are read-only except for /tmp.
  if (process.env.VERCEL) {
    return path.join('/tmp', 'requests.db')
  }

  return bundledDbPath
}

const dbPath = resolveDbPath()

function ensureDbFile(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })

  if (targetPath !== bundledDbPath && !fs.existsSync(targetPath) && fs.existsSync(bundledDbPath)) {
    fs.copyFileSync(bundledDbPath, targetPath)
  }
}

export function openDb() {
  if (useRemoteDb()) {
    return {
      kind: 'libsql',
      client: getLibsqlClient()
    }
  }

  ensureDbFile(dbPath)
  return new sqlite3.Database(dbPath)
}

export function dbRun(db, sql, params = []) {
  if (db?.kind === 'libsql') {
    return db.client.execute({ sql, args: params }).then((result) => ({
      lastID: Number(result?.lastInsertRowid || 0),
      changes: Number(result?.rowsAffected || 0)
    }))
  }

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
  if (db?.kind === 'libsql') {
    return db.client.execute({ sql, args: params }).then((result) => {
      const rows = Array.isArray(result?.rows) ? result.rows : []
      return rows[0] || null
    })
  }

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
  if (db?.kind === 'libsql') {
    return db.client.execute({ sql, args: params }).then((result) => {
      const rows = Array.isArray(result?.rows) ? result.rows : []
      return rows
    })
  }

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
  if (db?.kind === 'libsql') {
    return Promise.resolve()
  }

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

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS thesis_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id TEXT NOT NULL,
      scenario_name TEXT,
      participant_id TEXT,
      participant_role TEXT,
      perceived_usefulness INTEGER,
      ease_of_use INTEGER,
      trust INTEGER,
      intention_to_use INTEGER,
      task_completion_minutes REAL,
      recommendations_generated INTEGER,
      recommendations_accepted INTEGER,
      clarification_requests INTEGER,
      system_response_ms INTEGER,
      error_count INTEGER,
      notes TEXT,
      interview_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      team_id TEXT,
      team_name TEXT,
      sprint_id TEXT,
      sprint_name TEXT,
      status TEXT DEFAULT 'draft',
      planning_context TEXT,
      selected_agents TEXT,
      final_summary TEXT,
      created_by TEXT,
      finalized_by TEXT,
      finalized_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_agent_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      agent_key TEXT NOT NULL,
      summary TEXT,
      confidence REAL,
      output_json TEXT NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_human_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      agent_output_id INTEGER,
      agent_key TEXT,
      decision TEXT NOT NULL,
      original_output_json TEXT,
      final_output_json TEXT,
      human_rationale TEXT,
      actor TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_dependency_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      source_item TEXT,
      target_item TEXT,
      dependency_type TEXT,
      severity TEXT,
      description TEXT,
      mitigation TEXT,
      threatens_sprint INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_estimation_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      backlog_item_id TEXT,
      backlog_item_title TEXT,
      ai_estimate REAL,
      final_estimate REAL,
      confidence REAL,
      assumptions TEXT,
      actor TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_architecture_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      agent_output_id INTEGER,
      impacted_components TEXT,
      assumptions TEXT,
      constraints TEXT,
      technical_enablers TEXT,
      architecture_risks TEXT,
      recommended_actions TEXT,
      rationale TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_risk_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      risk_id TEXT,
      title TEXT,
      description TEXT,
      category TEXT,
      probability TEXT,
      impact TEXT,
      severity TEXT,
      mitigation TEXT,
      owner TEXT,
      status TEXT,
      source_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_scenario_runs (
      id TEXT PRIMARY KEY,
      scenario_key TEXT NOT NULL,
      scenario_name TEXT NOT NULL,
      participant_id TEXT,
      participant_role TEXT,
      instructions TEXT,
      synthetic_data TEXT,
      started_at TEXT,
      ended_at TEXT,
      duration_seconds REAL,
      recommendations_shown INTEGER DEFAULT 0,
      accepted_count INTEGER DEFAULT 0,
      modified_count INTEGER DEFAULT 0,
      rejected_count INTEGER DEFAULT 0,
      clarification_requests INTEGER DEFAULT 0,
      perceived_usefulness INTEGER,
      ease_of_use INTEGER,
      trust INTEGER,
      intention_to_use INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS planning_scenario_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      recommendation_id TEXT,
      action TEXT,
      actor TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  )
}

export async function withDb(work) {
  const db = openDb()
  try {
    if (db?.kind === 'libsql') {
      if (!libsqlSchemaPromise) {
        libsqlSchemaPromise = ensureSchema(db).catch((err) => {
          libsqlSchemaPromise = null
          throw err
        })
      }
      await libsqlSchemaPromise
    } else {
      await ensureSchema(db)
    }

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
