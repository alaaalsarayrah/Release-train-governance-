import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import util from 'util'

export const config = {
  api: {
    bodyParser: false,
  },
}

const uploadDir = path.join(process.cwd(), 'public', 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

function parseForm(req) {
  const form = formidable({ multiples: false, uploadDir, keepExtensions: true })
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err)
      resolve({ fields, files })
    })
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  console.log('Upload request received:', req.method, {
    contentType: req.headers && req.headers['content-type'],
    contentLength: req.headers && req.headers['content-length'],
    remoteAddr: req.headers && (req.headers['x-forwarded-for'] || req.socket.remoteAddress)
  })

  try {
    const { files } = await parseForm(req)

    // formidable may provide different shapes; attempt to find the uploaded file
    let file = files?.file || (files && Object.values(files)[0])
    if (Array.isArray(file)) file = file[0]
    if (!file) {
      console.error('No file in upload request', { files })
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const tmpPath = file.filepath || file.file || file.path
    const originalName = file.originalFilename || file.name || file.filename || 'upload'

    console.log('Parsed file object:', util.inspect(file, { depth: 2 }))

    // Basic validation: allow pdf and docx by extension OR by detected mimetype
    const ext = path.extname(originalName).toLowerCase()
    const mimetype = file.mimetype || file.type || file.mime || ''

    const extAllowed = ['.pdf', '.docx', '.doc'].includes(ext)
    const mimeAllowed = /pdf|word|officedocument|msword/.test(mimetype)

    if (!extAllowed && !mimeAllowed) {
      // cleanup uploaded temp file
      try { fs.unlinkSync(tmpPath) } catch (e) {}
      console.warn('Rejected upload', { originalName, ext, mimetype })
      return res.status(400).json({ message: 'Only PDF or DOC/DOCX allowed', details: { originalName, ext, mimetype } })
    }

    // Prevent directory traversal and normalize filename
    const safeName = path.basename(originalName)
    let destPath = path.join(uploadDir, safeName)
    
    // If file exists, generate a unique name to avoid overwriting
    if (fs.existsSync(destPath)) {
      const ext = path.extname(safeName)
      const base = path.basename(safeName, ext)
      const timestamp = Date.now()
      const uniqueName = `${base}_${timestamp}${ext}`
      destPath = path.join(uploadDir, uniqueName)
    }

    // Move temp file to final destination
    fs.renameSync(tmpPath, destPath)

    const storedName = path.basename(destPath)
    const publicUrl = '/uploads/' + encodeURIComponent(storedName)
    console.log('Upload saved:', destPath)
    res.status(200).json({ url: publicUrl })
  } catch (err) {
    console.error('Upload handler error:', err)
    res.status(500).json({ message: 'Upload failed', error: String(err) })
  }
}
