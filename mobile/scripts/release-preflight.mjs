import fs from 'fs'
import path from 'path'

const cwd = process.cwd()
const envPath = path.join(cwd, '.env')
const easPath = path.join(cwd, 'eas.json')
const platformArgIndex = process.argv.indexOf('--platform')
const platform = platformArgIndex >= 0 ? String(process.argv[platformArgIndex + 1] || 'both').toLowerCase() : 'both'
const checkIOS = platform === 'ios' || platform === 'both'
const checkAndroid = platform === 'android' || platform === 'both'

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const raw = fs.readFileSync(filePath, 'utf-8')
  const out = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    out[key] = value
  }
  return out
}

function isPlaceholder(value) {
  const v = String(value || '').trim().toLowerCase()
  if (!v) return true
  return v.includes('your_') || v.includes('your-') || v.includes('example') || v.includes('com.yourcompany')
}

function fail(msg) {
  console.error(`ERROR: ${msg}`)
}

function ok(msg) {
  console.log(`OK: ${msg}`)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function isNumeric(value) {
  return /^\d+$/.test(String(value || '').trim())
}

function isTeamId(value) {
  return /^[A-Z0-9]{10}$/i.test(String(value || '').trim())
}

let hasError = false

if (!fs.existsSync(envPath)) {
  fail('Missing .env file in mobile/. Copy .env.example to .env and set real values.')
  hasError = true
}

const env = readEnv(envPath)
const requiredEnv = ['EXPO_PUBLIC_WEB_URL']
if (checkIOS) requiredEnv.push('EXPO_PUBLIC_IOS_BUNDLE_ID')
if (checkAndroid) requiredEnv.push('EXPO_PUBLIC_ANDROID_PACKAGE')

for (const key of requiredEnv) {
  const value = env[key]
  if (!value || isPlaceholder(value)) {
    fail(`Set a real value for ${key} in mobile/.env`)
    hasError = true
  } else {
    ok(`${key} is set`)
  }
}

if (!String(env.EXPO_PUBLIC_WEB_URL || '').startsWith('https://')) {
  fail('EXPO_PUBLIC_WEB_URL should use https:// for store production builds.')
  hasError = true
}

let easJson = null
try {
  easJson = JSON.parse(fs.readFileSync(easPath, 'utf-8'))
  ok('eas.json is valid JSON')
} catch {
  fail('eas.json is missing or invalid JSON')
  hasError = true
}

if (easJson) {
  const ios = easJson?.submit?.production?.ios || {}
  const android = easJson?.submit?.production?.android || {}

  if (checkIOS) {
    for (const key of ['appleId', 'ascAppId', 'appleTeamId']) {
      if (isPlaceholder(ios[key])) {
        fail(`Set eas.json submit.production.ios.${key}`)
        hasError = true
      } else {
        ok(`eas.json ios ${key} configured`)
      }
    }

    if (!isPlaceholder(ios.appleId) && !isValidEmail(ios.appleId)) {
      fail('eas.json ios appleId must be a valid email address')
      hasError = true
    }

    if (!isPlaceholder(ios.ascAppId) && !isNumeric(ios.ascAppId)) {
      fail('eas.json ios ascAppId must be numeric (App Store Connect app id)')
      hasError = true
    }

    if (!isPlaceholder(ios.appleTeamId) && !isTeamId(ios.appleTeamId)) {
      fail('eas.json ios appleTeamId must be a 10-character alphanumeric team id')
      hasError = true
    }
  }

  if (checkAndroid) {
    const serviceAccountPath = android.serviceAccountKeyPath
    if (isPlaceholder(serviceAccountPath)) {
      fail('Set eas.json submit.production.android.serviceAccountKeyPath')
      hasError = true
    } else {
      const abs = path.resolve(cwd, serviceAccountPath)
      if (!fs.existsSync(abs)) {
        fail(`Android service account key file not found at: ${serviceAccountPath}`)
        hasError = true
      } else {
        ok('Android service account key file found')
      }
    }
  }
}

if (hasError) {
  const suggested = checkIOS && !checkAndroid ? 'npm run check:release:ios' : (checkAndroid && !checkIOS ? 'npm run check:release:android' : 'npm run check:release')
  console.error(`\nRelease preflight failed. Fix the errors above, then re-run: ${suggested}`)
  process.exit(1)
}

console.log('\nRelease preflight passed. Ready for EAS build + submit.')
