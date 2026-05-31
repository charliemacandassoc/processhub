import { Router, Response } from 'express'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import multer from 'multer'
import { AuthRequest, requireAdmin } from '../auth'
import { rebuild } from '../lib/indexBuilder'

const router = Router()
const DATA_DIR = path.resolve(__dirname, '../../../data')
const upload = multer({ storage: multer.memoryStorage() })

function processDir(id: string) {
  return path.join(DATA_DIR, 'processes', id)
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0] : p
}

// POST /api/admin/processes — create new process
router.post('/processes', requireAdmin, (req: AuthRequest, res: Response) => {
  const { title, category, department, owner, owner_email } = req.body as Record<string, string>
  if (!title) return res.status(400).json({ error: 'title required' })

  const id = slugify(title)
  const dir = processDir(id)
  if (fs.existsSync(dir)) return res.status(409).json({ error: 'Process already exists' })

  fs.mkdirSync(path.join(dir, 'steps'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'checklists'), { recursive: true })

  const today = new Date().toISOString().split('T')[0]
  const frontmatter = `---\ntitle: ${title}\ncategory: ${category ?? ''}\ndepartment: ${department ?? ''}\nowner: ${owner ?? ''}\nowner_email: ${owner_email ?? ''}\nstatus: draft\nversion: 1.0\nlast_updated: ${today}\n---\n\n## Objective\n\n## Performance measures\n\n## Triggers\n`

  fs.writeFileSync(path.join(dir, 'overview.md'), frontmatter)
  rebuild()
  res.status(201).json({ id })
})

// PUT /api/admin/processes/:id/overview
router.put('/processes/:id/overview', requireAdmin, (req: AuthRequest, res: Response) => {
  const dir = processDir(param(req.params.id))
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Not found' })

  const { frontmatter: fm, content } = req.body as { frontmatter: Record<string, string>; content: string }
  const categoryStr = Array.isArray(fm.category) ? fm.category.join(' / ') : (fm.category ?? '')
  const raw = matter.stringify(content, { ...fm, category: categoryStr })
  fs.writeFileSync(path.join(dir, 'overview.md'), raw)
  rebuild()
  res.json({ ok: true })
})

// Shared BPMN parser — reused by GET and POST
function parseBpmnSteps(xml: string) {
  const taskTypes = ['bpmn:task', 'bpmn:userTask', 'bpmn:serviceTask', 'bpmn:manualTask', 'bpmn:subProcess', 'bpmn:callActivity']
  const steps: Array<{ id: string; label: string; isSubprocess: boolean }> = []
  const tagRe = /<([a-zA-Z:]+)\s+([^>]*?)(?:\/>|>)/g
  let match: RegExpExecArray | null
  while ((match = tagRe.exec(xml)) !== null) {
    const tag = match[1].toLowerCase()
    if (!taskTypes.some((t) => tag === t.toLowerCase())) continue
    const attrs = match[2]
    const idM = /\bid="([^"]+)"/.exec(attrs)
    const nameM = /\bname="([^"]+)"/.exec(attrs)
    if (!idM) continue
    steps.push({ id: idM[1], label: nameM?.[1] ?? idM[1], isSubprocess: tag.includes('subprocess') || tag.includes('callactivity') })
  }
  return steps
}

// GET /api/admin/processes/:id/bpmn-steps — parse stored BPMN without re-uploading
router.get('/processes/:id/bpmn-steps', requireAdmin, (req: AuthRequest, res: Response) => {
  const bpmnPath = path.join(processDir(param(req.params.id)), 'process.bpmn')
  if (!fs.existsSync(bpmnPath)) return res.json({ steps: [] })
  const xml = fs.readFileSync(bpmnPath, 'utf8')
  res.json({ steps: parseBpmnSteps(xml) })
})

// POST /api/admin/processes/:id/bpmn — file upload
router.post('/processes/:id/bpmn', requireAdmin, upload.single('bpmn'), (req: AuthRequest, res: Response) => {
  const dir = processDir(param(req.params.id))
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Not found' })
  if (!req.file) return res.status(400).json({ error: 'No file' })

  const xml = req.file.buffer.toString('utf8')
  fs.writeFileSync(path.join(dir, 'process.bpmn'), xml)

  const steps = parseBpmnSteps(xml)
  const stepsDir = path.join(dir, 'steps')
  const today = new Date().toISOString().split('T')[0]

  // Auto-create stub markdown for any step that doesn't have one yet
  steps.forEach((step) => {
    const stepFile = path.join(stepsDir, `${step.id}.md`)
    if (!fs.existsSync(stepFile)) {
      const stub = matter.stringify('Step detail content goes here.', {
        sme: '', sme_role: '', sme_email: '',
        status: 'draft', version: '1.0', last_updated: today,
      })
      fs.writeFileSync(stepFile, stub)
    }
  })

  res.json({ steps })
})

// PUT /api/admin/processes/:id/steps/:stepId
router.put('/processes/:id/steps/:stepId', requireAdmin, (req: AuthRequest, res: Response) => {
  const stepsDir = path.join(processDir(param(req.params.id)), 'steps')
  if (!fs.existsSync(stepsDir)) return res.status(404).json({ error: 'Not found' })

  const { frontmatter: fm, content } = req.body as { frontmatter: Record<string, string>; content: string }
  const raw = matter.stringify(content, fm)
  fs.writeFileSync(path.join(stepsDir, `${param(req.params.stepId)}.md`), raw)
  res.json({ ok: true })
})

// POST /api/admin/processes/:id/checklists — file upload
router.post('/processes/:id/checklists', requireAdmin, upload.single('checklist'), (req: AuthRequest, res: Response) => {
  const checklistDir = path.join(processDir(param(req.params.id)), 'checklists')
  if (!fs.existsSync(checklistDir)) return res.status(404).json({ error: 'Not found' })
  if (!req.file) return res.status(400).json({ error: 'No file' })

  const filename = req.file.originalname
  fs.writeFileSync(path.join(checklistDir, filename), req.file.buffer)
  res.json({ ok: true, filename })
})

// DELETE /api/admin/processes/:id
router.delete('/processes/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const dir = processDir(param(req.params.id))
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Not found' })
  fs.rmSync(dir, { recursive: true, force: true })
  rebuild()
  res.json({ ok: true })
})

export default router
