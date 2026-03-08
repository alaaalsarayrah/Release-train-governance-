import fs from 'fs'
import path from 'path'
import pdf from 'pdf-parse'

function firstNSentences(text, n = 3) {
  if (!text) return ''
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)
  return parts.slice(0, n).join(' ')
}

function extractAbstract(text) {
  const idx = text.search(/\babstract\b/i)
  if (idx === -1) return null
  const after = text.slice(idx)
  const endMatch = after.match(/\n\s*\n|\n\s*Introduction\b|\n\s*1\s+Introduction\b/i)
  const abstract = endMatch ? after.slice(0, endMatch.index) : after.slice(0, 1500)
  return abstract.replace(/\n+/g, '\n').trim()
}

function extractTOC(text) {
  const idx = text.search(/table of contents|contents/i)
  if (idx === -1) return null
  const after = text.slice(idx)
  // take up to 1000 chars after TOC header
  const snippet = after.slice(0, 1000)
  const lines = snippet.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  // remove the header line
  if (lines.length && /table of contents|contents/i.test(lines[0])) lines.shift()
  return lines.slice(0, 50)
}

function extractChapters(text) {
  const lines = text.split(/\r?\n/)
  const chapters = []
  const chapterRe = /^(?:Chapter\s+\d+[:.]?\s*|\b\d+\.\s+)(.+)$/i
  for (const line of lines) {
    const m = line.match(chapterRe)
    if (m) chapters.push(m[1].trim())
  }
  return chapters
}

export default async function handler(req, res) {
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    
    // Find the most recently uploaded PDF
    let filePath = null
    
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir)
        .filter(f => /\.pdf$/i.test(f))
        .map(f => ({ name: f, time: fs.statSync(path.join(uploadDir, f)).mtime }))
        .sort((a, b) => b.time - a.time)
      
      if (files.length === 0) {
        return res.status(404).json({ message: 'Thesis file not found. Upload a PDF file first.' })
      }
      
      filePath = path.join(uploadDir, files[0].name)
    } else {
      return res.status(404).json({ message: 'Thesis file not found. Upload first.' })
    }

    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdf(dataBuffer)
    const text = data.text || ''

    const abstract = extractAbstract(text)
    const toc = extractTOC(text)
    const chapters = extractChapters(text)
    const summary = abstract ? firstNSentences(abstract, 4) : firstNSentences(text, 6)

    res.status(200).json({ abstract, toc, chapters, summary })
  } catch (err) {
    console.error('parse error', err)
    res.status(500).json({ message: 'Parse failed', error: String(err) })
  }
}
