import { useState } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { stripSections } from '../lib/markdown'

interface Props {
  content: string
}

export function OverviewCard({ content }: Props) {
  const [open, setOpen] = useState(true)

  // Triggers and Outcomes are surfaced in the Start/End step detail panels
  const displayContent = stripSections(content, ['Triggers', 'Outcomes'])

  return (
    <div className="overview-card">
      <button className="overview-toggle" onClick={() => setOpen((o) => !o)}>
        <span>Overview</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="overview-body">
          <MarkdownRenderer content={displayContent} processId="" />
        </div>
      )}
    </div>
  )
}
