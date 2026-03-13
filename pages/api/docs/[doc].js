const DOC_MAP = {
  readme: '/docs/README.md',
  deployment: '/docs/DEPLOYMENT.md',
  status: '/docs/STATUS.md',
  quick: '/docs/QUICK_REFERENCE.md'
}

export default function handler(req, res) {
  const rawDoc = Array.isArray(req.query.doc) ? req.query.doc[0] : req.query.doc
  const docKey = String(rawDoc || '').toLowerCase()
  const targetPath = DOC_MAP[docKey]

  if (!targetPath) {
    return res.status(404).json({ message: 'Document not found' })
  }

  return res.redirect(307, targetPath)
}
