const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3')

const dbPath = path.join(process.cwd(), 'data', 'requests.db')
const uploadsDir = path.join(process.cwd(), 'public', 'uploads')

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err)
      resolve(this)
    })
  })
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows || [])
    })
  })
}

function close(db) {
  return new Promise((resolve) => db.close(() => resolve()))
}

async function clearBusinessRequestsOnly() {
  const db = new sqlite3.Database(dbPath)
  try {
    await run(db, 'DELETE FROM business_requests')
    const counts = await all(
      db,
      `SELECT
        (SELECT COUNT(*) FROM business_requests) AS br,
        (SELECT COUNT(*) FROM orchestrator_events) AS ev,
        (SELECT COUNT(*) FROM audit_logs) AS al`
    )
    return counts[0]
  } finally {
    await close(db)
  }
}

function clearUploadsOnly() {
  if (!fs.existsSync(uploadsDir)) return 0
  const files = fs.readdirSync(uploadsDir)
  for (const file of files) {
    const fullPath = path.join(uploadsDir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isFile()) fs.unlinkSync(fullPath)
  }
  return files.length
}

async function main() {
  try {
    const removedUploads = clearUploadsOnly()
    const counts = await clearBusinessRequestsOnly()
    console.log(
      JSON.stringify(
        {
          success: true,
          cleared: {
            businessRequests: true,
            uploadsRemoved: removedUploads
          },
          preserved: {
            orchestratorEventsCount: counts.ev,
            auditLogsCount: counts.al
          },
          remaining: {
            businessRequestsCount: counts.br
          }
        },
        null,
        2
      )
    )
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          success: false,
          error: String(err && err.message ? err.message : err)
        },
        null,
        2
      )
    )
    process.exit(1)
  }
}

main()
