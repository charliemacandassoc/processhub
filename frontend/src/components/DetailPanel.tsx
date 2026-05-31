import { StepDetail } from '../types'
import { MarkdownRenderer } from './MarkdownRenderer'

interface Props {
  stepId: string
  totalSteps: number
  stepIndex: number
  stepLabel: string
  detail: StepDetail
  processId: string
}

export function DetailPanel({ stepIndex, totalSteps, stepLabel, detail, processId }: Props) {
  const { frontmatter: fm, content } = detail
  const initials = fm.sme
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <span className="detail-step-label">{stepLabel}</span>
        <span className="detail-step-count">
          Step {stepIndex + 1} of {totalSteps}
        </span>
      </div>

      <div className="detail-panel-content">
        <MarkdownRenderer content={content} processId={processId} />
      </div>

      <div className="detail-panel-footer">
        <div className="detail-sme">
          <div className="avatar avatar-sm">{initials}</div>
          <div className="detail-sme-info">
            <a href={`mailto:${fm.sme_email}`} className="detail-sme-name">
              {fm.sme}
            </a>
            <span className="detail-sme-role">{fm.sme_role}</span>
          </div>
        </div>
        <div className="detail-meta">
          <span className={`badge badge-${fm.status}`}>{fm.status}</span>
          <span className="detail-version">v{fm.version}</span>
          <span className="detail-date">{fm.last_updated}</span>
        </div>
      </div>
    </div>
  )
}
