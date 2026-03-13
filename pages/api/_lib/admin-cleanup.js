import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'

const dbPath = path.join(process.cwd(), 'data', 'requests.db')
const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
const adoConfigPath = path.join(process.cwd(), 'public', '.ado-config.json')

function getAuthHeader(pat) {
  const token = Buffer.from(`:${pat}`).toString('base64')
  return `Basic ${token}`
}

async function adoRequest({ org, project, pat, method = 'GET', apiPath, body }) {
  const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}${apiPath}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: getAuthHeader(pat),
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    throw new Error(json?.message || json?.raw || `ADO request failed: ${res.status}`)
  }

  return json
}

function openDb() {
  return new sqlite3.Database(dbPath)
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err)
      resolve(this)
    })
  })
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row || null)
    })
  })
}

function close(db) {
  return new Promise((resolve) => db.close(() => resolve()))
}

function clearUploads() {
  if (!fs.existsSync(uploadsDir)) return 0
  const files = fs.readdirSync(uploadsDir)
  let deleted = 0
  for (const file of files) {
    const fullPath = path.join(uploadsDir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isFile()) {
      fs.unlinkSync(fullPath)
      deleted += 1
    }
  }
  return deleted
}

export async function clearSiteData() {
  if (!fs.existsSync(dbPath)) {
    return {
      businessRequestsDeleted: 0,
      eventsDeleted: 0,
      auditLogsDeleted: 0,
      uploadsDeleted: clearUploads()
    }
  }

  const db = openDb()
  try {
    const before = await get(
      db,
      `SELECT
        (SELECT COUNT(*) FROM business_requests) AS br,
        (SELECT COUNT(*) FROM orchestrator_events) AS ev,
        (SELECT COUNT(*) FROM audit_logs) AS al`
    )

    await run(db, 'DELETE FROM business_requests')
    await run(db, 'DELETE FROM orchestrator_events')
    await run(db, 'DELETE FROM audit_logs')

    return {
      businessRequestsDeleted: Number(before?.br || 0),
      eventsDeleted: Number(before?.ev || 0),
      auditLogsDeleted: Number(before?.al || 0),
      uploadsDeleted: clearUploads()
    }
  } finally {
    await close(db)
  }
}

function loadAdoConfig() {
  if (!fs.existsSync(adoConfigPath)) return null
  try {
    return JSON.parse(fs.readFileSync(adoConfigPath, 'utf-8'))
  } catch {
    return null
  }
}

async function fetchProjectWorkItemIds({ org, project, pat }) {
  const wiql = {
    query: `SELECT [System.Id]
            FROM WorkItems
            WHERE [System.TeamProject] = @project
            ORDER BY [System.ChangedDate] DESC`
  }

  const response = await adoRequest({
    org,
    project,
    pat,
    method: 'POST',
    apiPath: '/_apis/wit/wiql?api-version=7.1',
    body: wiql
  })

  return (response?.workItems || []).map((x) => x.id).filter(Boolean)
}

export async function clearAdoProjectData({ projectOverride } = {}) {
  const cfg = loadAdoConfig()
  if (!cfg?.organization || !cfg?.project || !cfg?.pat) {
    return {
      skipped: true,
      reason: 'ADO config missing (organization/project/pat).'
    }
  }

  const project = String(projectOverride || cfg.project)
  const ids = await fetchProjectWorkItemIds({
    org: cfg.organization,
    project,
    pat: cfg.pat
  })

  const failed = []
  let deletedCount = 0
  for (const id of ids) {
    try {
      await adoRequest({
        org: cfg.organization,
        project,
        pat: cfg.pat,
        method: 'DELETE',
        apiPath: `/_apis/wit/workitems/${id}?api-version=7.1`
      })
      deletedCount += 1
    } catch (err) {
      failed.push({ id, error: String(err?.message || err) })
    }
  }

  return {
    skipped: false,
    organization: cfg.organization,
    project,
    totalFound: ids.length,
    deletedCount,
    failedCount: failed.length,
    failed
  }
}
