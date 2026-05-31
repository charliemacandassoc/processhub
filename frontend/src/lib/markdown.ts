/** Extract the content of a specific ## heading section from markdown */
export function extractSection(content: string, heading: string): string {
  const lines = content.split('\n')
  const result: string[] = []
  let inSection = false

  for (const line of lines) {
    if (line.startsWith('## ')) {
      inSection = line.slice(3).trim().toLowerCase() === heading.toLowerCase()
      continue // don't include the heading itself
    }
    if (inSection) result.push(line)
  }

  return result.join('\n').trim()
}

/** Return content with specific ## sections removed */
export function stripSections(content: string, headings: string[]): string {
  const lower = headings.map((h) => h.toLowerCase())
  const lines = content.split('\n')
  const result: string[] = []
  let skip = false

  for (const line of lines) {
    if (line.startsWith('## ')) {
      skip = lower.includes(line.slice(3).trim().toLowerCase())
    }
    if (!skip) result.push(line)
  }

  return result.join('\n').trim()
}
