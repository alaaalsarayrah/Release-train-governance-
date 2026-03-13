const fs = require('fs')
const path = require('path')
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require('docx')

const root = process.cwd()
const outputDir = path.join(root, 'public', 'downloads')
const outputFile = path.join(outputDir, 'project-full-documentation.docx')

const IGNORE_DIRS = new Set(['.git', '.next', '.vercel', 'node_modules'])
const SCAN_ROOTS = ['pages', 'components', 'data', 'scripts', 'styles', 'mobile']

function readText(relPath) {
  const fullPath = path.join(root, relPath)
  if (!fs.existsSync(fullPath)) return ''
  return fs.readFileSync(fullPath, 'utf8')
}

function safeListDir(relPath) {
  const fullPath = path.join(root, relPath)
  if (!fs.existsSync(fullPath)) return []
  return fs.readdirSync(fullPath, { withFileTypes: true })
}

function walkFiles(startRelPath) {
  const startPath = path.join(root, startRelPath)
  if (!fs.existsSync(startPath)) return []

  const results = []

  function walk(absPath, relBase) {
    const entries = fs.readdirSync(absPath, { withFileTypes: true })
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue
      if (entry.name === 'uploads' && relBase.startsWith('public')) continue

      const absChild = path.join(absPath, entry.name)
      const relChild = path.join(relBase, entry.name)
      if (entry.isDirectory()) {
        walk(absChild, relChild)
      } else {
        results.push(relChild.replace(/\\/g, '/'))
      }
    }
  }

  walk(startPath, startRelPath)
  return results.sort((a, b) => a.localeCompare(b))
}

function asBullets(items) {
  return items.map((item) => new Paragraph({ text: item, bullet: { level: 0 } }))
}

function asPlainLines(text) {
  const lines = text.split(/\r?\n/)
  return lines.map((line) => new Paragraph({ text: line }))
}

function getProjectFacts() {
  const pkg = JSON.parse(readText('package.json') || '{}')
  const dependencies = Object.entries(pkg.dependencies || {})
    .map(([name, version]) => `${name}: ${version}`)
    .sort((a, b) => a.localeCompare(b))

  const pagesFiles = walkFiles('pages').filter((f) => f.endsWith('.js') || f.endsWith('.jsx'))
  const apiFiles = pagesFiles.filter((f) => f.startsWith('pages/api/'))
  const uiPages = pagesFiles.filter((f) => !f.startsWith('pages/api/'))
  const componentFiles = walkFiles('components')
  const scriptFiles = walkFiles('scripts')

  return {
    generatedAt: new Date().toISOString(),
    dependencies,
    uiPages,
    apiFiles,
    componentFiles,
    scriptFiles,
    scannedFiles: SCAN_ROOTS.flatMap((p) => walkFiles(p))
  }
}

async function generate() {
  const facts = getProjectFacts()
  const fullDoc = readText('public/docs/PROJECT_FULL_DOCUMENTATION.md')
  const readme = readText('README.md')
  const deployment = readText('DEPLOYMENT.md')
  const quickReference = readText('QUICK_REFERENCE.md')
  const status = readText('STATUS.md')
  const sessionStatus = readText('SESSION_STATUS.md')

  const children = [
    new Paragraph({ text: 'Agentic SDLC Project Documentation (Complete)', heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated: ', bold: true }),
        new TextRun(new Date(facts.generatedAt).toLocaleString())
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Repository Root: ', bold: true }),
        new TextRun(root)
      ]
    }),

    new Paragraph({ text: '1. Executive Overview', heading: HeadingLevel.HEADING_1 }),
    ...asBullets([
      'Project theme: Agentic AI orchestration for SDLC and Scrum operations with governance controls.',
      'Core delivery: Next.js web platform with role-based access, workflow stages, and auditability.',
      'Research support: Thesis parsing, structured evaluation capture, and Chapter 4 evidence exports.',
      'Integrations: Azure DevOps work-item sync/provisioning and deployment-ready runtime architecture.'
    ]),

    new Paragraph({ text: '2. Technology Stack', heading: HeadingLevel.HEADING_1 }),
    ...asBullets(facts.dependencies),

    new Paragraph({ text: '3. User-Facing Pages', heading: HeadingLevel.HEADING_1 }),
    ...asBullets(facts.uiPages),

    new Paragraph({ text: '4. API Surface', heading: HeadingLevel.HEADING_1 }),
    ...asBullets(facts.apiFiles),

    new Paragraph({ text: '5. Components and Scripts', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: 'Components', heading: HeadingLevel.HEADING_2 }),
    ...asBullets(facts.componentFiles),
    new Paragraph({ text: 'Scripts', heading: HeadingLevel.HEADING_2 }),
    ...asBullets(facts.scriptFiles),

    new Paragraph({ text: '6. File Inventory Snapshot', heading: HeadingLevel.HEADING_1 }),
    ...asBullets(facts.scannedFiles),

    new Paragraph({ text: '7. Exhaustive Process Catalog (Generated)', heading: HeadingLevel.HEADING_1 }),
    ...asPlainLines(fullDoc || 'Run npm run generate:full-doc first to include the full process catalog.'),

    new Paragraph({ text: '8. README.md (Full Copy)', heading: HeadingLevel.HEADING_1 }),
    ...asPlainLines(readme),

    new Paragraph({ text: '9. DEPLOYMENT.md (Full Copy)', heading: HeadingLevel.HEADING_1 }),
    ...asPlainLines(deployment),

    new Paragraph({ text: '10. QUICK_REFERENCE.md (Full Copy)', heading: HeadingLevel.HEADING_1 }),
    ...asPlainLines(quickReference),

    new Paragraph({ text: '11. STATUS.md (Full Copy)', heading: HeadingLevel.HEADING_1 }),
    ...asPlainLines(status),

    new Paragraph({ text: '12. SESSION_STATUS.md (Full Copy)', heading: HeadingLevel.HEADING_1 }),
    ...asPlainLines(sessionStatus)
  ]

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  })

  fs.mkdirSync(outputDir, { recursive: true })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputFile, buffer)

  console.log(`DOCX_GENERATED=${outputFile}`)
  console.log(`PAGE_COUNT_ITEMS=${facts.uiPages.length}`)
  console.log(`API_COUNT_ITEMS=${facts.apiFiles.length}`)
}

generate().catch((error) => {
  console.error(error)
  process.exit(1)
})
