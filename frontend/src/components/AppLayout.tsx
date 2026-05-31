import { ReactNode, useEffect, useState } from 'react'
import { useProcessStore } from '../store/useProcessStore'
import { api } from '../lib/api'
import { ProcessSummary } from '../types'
import { ProcessTreeNav } from './ProcessTreeNav'
import { AppFooter } from './AppFooter'

interface Props {
  children: ReactNode
}

export function AppLayout({ children }: Props) {
  const { processes, setProcesses } = useProcessStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Load process index once globally so the sidebar is always populated
  useEffect(() => {
    if (processes.length > 0) return
    api.get<ProcessSummary[]>('/processes').then(setProcesses).catch(() => {})
  }, [processes.length, setProcesses])

  return (
    <div className="app-layout">
      {/* Hamburger — mobile only */}
      <button
        className="hamburger btn btn-ghost"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <ProcessTreeNav onClose={() => setSidebarOpen(false)} />
      </aside>

      <div className="app-main">
        {children}
        <AppFooter />
      </div>
    </div>
  )
}
