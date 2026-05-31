import { Link, useNavigate } from 'react-router-dom'
import { useProcessStore } from '../store/useProcessStore'

interface Props {
  processTitle: string
  processId: string
  category: string[]
  status?: string
  version?: string
}

export function Breadcrumb({ processTitle, category, status, version }: Props) {
  const { breadcrumbStack, popToLevel } = useProcessStore()
  const navigate = useNavigate()

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <div className="breadcrumb-path">
        <Link to="/inventory" className="breadcrumb-home" title="Inventory">⊞</Link>
        <span className="breadcrumb-sep">›</span>

        {/* Category segments — each navigates to inventory */}
        {category.map((seg, i) => (
          <span key={i} className="breadcrumb-seg">
            <Link to="/inventory" className="breadcrumb-link">{seg}</Link>
            <span className="breadcrumb-sep">›</span>
          </span>
        ))}

        {/* Subprocess ancestor chain — clickable to pop back */}
        {breadcrumbStack.map((entry, i) => (
          <span key={i} className="breadcrumb-seg">
            <span
              className="breadcrumb-link"
              role="button"
              tabIndex={0}
              onClick={() => {
                popToLevel(i)
                navigate(`/process/${entry.processId}`)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  popToLevel(i)
                  navigate(`/process/${entry.processId}`)
                }
              }}
            >
              {entry.label}
            </span>
            <span className="breadcrumb-sep">›</span>
          </span>
        ))}

        <span className="breadcrumb-current">{processTitle}</span>
      </div>

      <div className="breadcrumb-meta">
        {status && <span className={`badge badge-${status}`}>{status}</span>}
        {version && <span className="breadcrumb-version">v{version}</span>}
      </div>
    </nav>
  )
}
