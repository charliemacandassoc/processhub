import { Router, Response } from 'express'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { AuthRequest, requireAuth } from '../auth'

const router = Router()
const DATA_DIR = path.resolve(__dirname, '../../../data')

function processDir(id: string) {
  return path.join(DATA_DIR, 'processes', id)
}

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0] : p
}

// GET /api/processes — returns index.json, filtered by role
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const indexPath = path.join(DATA_DIR, 'index.json')
  if (!fs.existsSync(indexPath)) return res.json([])
  const { processes } = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as { processes: unknown[] }
  const isAdmin = req.user?.roles.includes('ProcessAdmin')
  const filtered = isAdmin
    ? processes
    : (processes as Array<{ status: string }>).filter((p) => p.status === 'approved')
  res.json(filtered)
})

// GET /api/processes/:id/overview
router.get('/:id/overview', requireAuth, (req: AuthRequest, res: Response) => {
  const dir = processDir(param(req.params.id))
  const filePath = path.join(dir, 'overview.md')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })

  const { data, content } = matter(fs.readFileSync(filePath, 'utf8'))
  const isAdmin = req.user?.roles.includes('ProcessAdmin')
  if (data.status === 'draft' && !isAdmin) return res.status(403).json({ error: 'Draft process' })

  const category = String(data.category ?? '').split(' / ').map((s: string) => s.trim()).filter(Boolean)
  res.json({ frontmatter: { ...data, category }, content })
})

// GET /api/processes/:id/bpmn
router.get('/:id/bpmn', requireAuth, (req: AuthRequest, res: Response) => {
  const filePath = path.join(processDir(param(req.params.id)), 'process.bpmn')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
  res.type('application/xml').send(fs.readFileSync(filePath, 'utf8'))
})

// GET /api/processes/:id/steps/:stepId
router.get('/:id/steps/:stepId', requireAuth, (req: AuthRequest, res: Response) => {
  const filePath = path.join(processDir(param(req.params.id)), 'steps', `${param(req.params.stepId)}.md`)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
  const { data, content } = matter(fs.readFileSync(filePath, 'utf8'))
  res.json({ frontmatter: data, content })
})

// GET /api/processes/:id/checklists/:file — download
router.get('/:id/checklists/:file', requireAuth, (req: AuthRequest, res: Response) => {
  const filePath = path.join(processDir(param(req.params.id)), 'checklists', param(req.params.file))
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
  res.setHeader('Content-Disposition', `attachment; filename="${param(req.params.file)}"`)
  res.type('text/markdown').send(fs.readFileSync(filePath, 'utf8'))
})

export default router
