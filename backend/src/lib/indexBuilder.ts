import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const DATA_DIR = path.resolve(__dirname, '../../../data')
const INDEX_PATH = path.join(DATA_DIR, 'index.json')

interface ProcessEntry {
  id: string
  title: string
  category: string[]
  department: string
  owner: string
  owner_email: string
  status: 'approved' | 'draft'
  version: string
  last_updated: string
  objective: string
}

export function rebuild(): void {
  const processesDir = path.join(DATA_DIR, 'processes')
  if (!fs.existsSync(processesDir)) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify({ processes: [] }, null, 2))
    return
  }

  const entries: ProcessEntry[] = []

  for (const id of fs.readdirSync(processesDir)) {
    const overviewPath = path.join(processesDir, id, 'overview.md')
    if (!fs.existsSync(overviewPath)) continue

    const { data, content } = matter(fs.readFileSync(overviewPath, 'utf8'))

    const categoryRaw: string = data.category ?? ''
    const category = categoryRaw.split(' / ').map((s: string) => s.trim()).filter(Boolean)

    // First paragraph of body as objective
    const objective = content.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? ''

    entries.push({
      id,
      title: data.title ?? id,
      category,
      department: data.department ?? '',
      owner: data.owner ?? '',
      owner_email: data.owner_email ?? '',
      status: data.status ?? 'draft',
      version: data.version ?? '1.0',
      last_updated: data.last_updated ?? '',
      objective: objective.slice(0, 200),
    })
  }

  fs.writeFileSync(INDEX_PATH, JSON.stringify({ processes: entries }, null, 2))
}
