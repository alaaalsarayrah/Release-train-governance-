import fs from 'fs'
import path from 'path'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'

function firstNSentences(text, n = 3) {
  if (!text) return ''
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)
  return parts.slice(0, n).join(' ')
}

function unique(items, limit = 60) {
  return Array.from(new Set((items || []).filter(Boolean))).slice(0, limit)
}

function extractLines(text, regex, limit = 40) {
  return unique(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && regex.test(line)),
    limit
  )
}

function extractSection(text, startRegex, endRegexes = [], maxChars = 3000) {
  const startMatch = text.match(startRegex)
  if (!startMatch || startMatch.index === undefined) return null

  const afterStart = text.slice(startMatch.index)
  const candidates = endRegexes
    .map((re) => afterStart.search(re))
    .filter((idx) => idx > 0)

  const endIndex = candidates.length ? Math.min(...candidates) : maxChars
  return afterStart.slice(0, Math.min(endIndex, maxChars)).trim()
}

function extractAbstract(text) {
  const headerRegex = /(?:^|\n)\s*abstract\b/gi
  const endRegexes = [/(?:^|\n)\s*chapter\s*1\b/i, /(?:^|\n)\s*1\.?\s*introduction\b/i]
  const candidates = []

  let match = null
  while ((match = headerRegex.exec(text)) !== null) {
    const after = text.slice(match.index)
    const endIndexes = endRegexes
      .map((re) => after.search(re))
      .filter((idx) => idx > 0)

    const endIndex = endIndexes.length ? Math.min(...endIndexes) : 4000
    const candidate = after.slice(0, Math.min(endIndex, 4000)).replace(/\n+/g, '\n').trim()
    if (candidate.length >= 60) {
      const dotLeaderCount = (candidate.match(/\.{4,}/g) || []).length
      const alphaCharCount = (candidate.match(/[a-z]/gi) || []).length
      const score = alphaCharCount - dotLeaderCount * 200
      candidates.push({ candidate, score })
    }
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].candidate
}

function extractTOC(text) {
  const tocSection = extractSection(
    text,
    /(?:^|\n)\s*table of contents\b|(?:^|\n)\s*contents\b/i,
    [/(?:^|\n)\s*chapter\s*1\b/i, /(?:^|\n)\s*1\.?\s*introduction\b/i],
    12000
  )

  if (!tocSection) return null

  const lines = tocSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^table of contents$/i.test(line))

  return unique(lines, 80)
}

function extractChapters(text) {
  return extractLines(text, /^(?:chapter\s+\d+[:.]?\s*.*|\d+\.\d+\s+.*)$/i, 80)
}

function getFileType(fileName) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'docx'
  if (ext === '.doc') return 'doc'
  return 'unknown'
}

async function parseDocumentToText(filePath, fileType) {
  if (fileType === 'pdf') {
    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdf(dataBuffer)
    return { text: data.text || '', warnings: [] }
  }

  if (fileType === 'docx') {
    const dataBuffer = fs.readFileSync(filePath)
    const result = await mammoth.extractRawText({ buffer: dataBuffer })
    const warnings = (result.messages || []).map((msg) => String(msg.message || msg))
    return { text: result.value || '', warnings }
  }

  throw new Error('Unsupported thesis format. Please upload PDF or DOCX.')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')

    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir)
        .filter(f => /\.(pdf|docx|doc)$/i.test(f))
        .map(f => ({ name: f, time: fs.statSync(path.join(uploadDir, f)).mtime }))
        .sort((a, b) => b.time - a.time)

      if (files.length === 0) {
        return res.status(404).json({ message: 'Thesis file not found. Upload a PDF or DOCX file first.' })
      }

      const latest = files[0]
      const filePath = path.join(uploadDir, latest.name)
      const fileType = getFileType(latest.name)

      if (fileType === 'doc') {
        return res.status(400).json({
          message: 'Legacy .doc format is not supported. Please upload DOCX or PDF.'
        })
      }

      const parsed = await parseDocumentToText(filePath, fileType)
      const text = parsed.text || ''

      const abstract = extractAbstract(text)
      const toc = extractTOC(text)
      const chapters = extractChapters(text)
      const roLines = extractLines(text, /\bRO\d\b|research objective/i, 40)
      const rqLines = extractLines(text, /\bRQ\d\b|main research question|supporting research question/i, 40)
      const evaluationSignals = extractLines(
        text,
        /evaluation|TAM|perceived usefulness|ease of use|trust|scenario|survey|interview|metric/i,
        80
      )
      const guidelineSignals = extractLines(
        text,
        /guideline|adoption|governance|human-ai|ethical|bias|oversight/i,
        80
      )

      const summarySource = abstract || text
      const summary = firstNSentences(summarySource, 8)

      return res.status(200).json({
        fileName: latest.name,
        fileType,
        textLength: text.length,
        summary,
        abstract,
        toc,
        chapters,
        roLines,
        rqLines,
        evaluationSignals,
        guidelineSignals,
        parserWarnings: parsed.warnings
      })
    } else {
      return res.status(404).json({ message: 'Thesis file not found. Upload first.' })
    }
  } catch (err) {
    console.error('parse error', err)
    res.status(500).json({ message: 'Parse failed', error: String(err) })
  }
}
