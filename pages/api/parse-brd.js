import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'

function extractRequirements(text) {
  // Simple heuristic: look for patterns like "User Story:", "Requirement:", "As a...", "Must", etc.
  const lines = text.split(/\r?\n/)
  const requirements = []
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Detect requirement headers
    if (/^(user story|requirement|epic|feature|as a|given|when):/i.test(line)) {
      if (current) requirements.push(current)
      current = { title: line, description: '', acceptanceCriteria: [] }
    } else if (current && /^(acceptance criteria|given|when|then):/i.test(line)) {
      current.acceptanceCriteria.push(line)
    } else if (current) {
      current.description += ' ' + line
    }
  }
  if (current) requirements.push(current)

  // Clean up
  return requirements.map(r => ({
    title: r.title.replace(/^(user story|requirement|epic|feature|as a|given|when):\s*/i, ''),
    description: r.description.trim().slice(0, 500),
    acceptanceCriteria: r.acceptanceCriteria.slice(0, 5)
  }))
}

export default async function handler(req, res) {
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    
    // Find the most recently uploaded document (DOCX or PDF)
    let filePath = null
    let text = ''
    
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir)
        .filter(f => /\.(docx|doc|pdf)$/i.test(f))
        .map(f => ({ name: f, time: fs.statSync(path.join(uploadDir, f)).mtime }))
        .sort((a, b) => b.time - a.time)
      
      if (files.length === 0) {
        return res.status(404).json({ message: 'No BRD document found. Upload a .docx or .pdf file first.' })
      }
      
      filePath = path.join(uploadDir, files[0].name)
      const ext = path.extname(files[0].name).toLowerCase()
      
      try {
        if (ext === '.pdf') {
          return res.status(400).json({ message: 'DOCX format preferred. PDF support coming soon.' })
        } else {
          const docBuffer = fs.readFileSync(filePath)
          const result = await mammoth.extractRawText({ buffer: docBuffer })
          text = result.value
        }
      } catch (bufErr) {
        return res.status(400).json({ message: 'Could not read document. Ensure it is a valid DOCX file.', error: String(bufErr) })
      }
    } else {
      return res.status(404).json({ message: 'No BRD document found. Upload a .docx file first.' })
    }

    const requirements = extractRequirements(text)
    res.status(200).json({ requirements, totalCount: requirements.length })
  } catch (err) {
    console.error('BRD parse error', err)
    res.status(500).json({ message: 'Parse failed', error: String(err) })
  }
}
