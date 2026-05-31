import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProcessSummary } from '../types'
import { useProcessStore } from '../store/useProcessStore'

type SortKey = keyof Pick<ProcessSummary, 'title' | 'department' | 'owner' | 'status' | 'version' | 'last_updated'>
type SortDir = 'asc' | 'desc'

interface Props {
  processes: ProcessSummary[]
}

export function ProcessInventoryTable({ processes }: Props) {
  const isAdmin = useProcessStore((s) => s.user?.isAdmin)
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function toggleGroup(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  // Group by top-level category
  const grouped = new Map<string, ProcessSummary[]>()
  for (const p of processes) {
    const cat = p.category[0] ?? 'Uncategorised'
    const group = grouped.get(cat) ?? []
    group.push(p)
    grouped.set(cat, group)
  }

  // Sort within each group
  for (const [cat, rows] of grouped) {
    grouped.set(
      cat,
      [...rows].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      })
    )
  }

  function th(label: string, key: SortKey) {
    const active = sortKey === key
    return (
      <th className={`sortable ${active ? 'sorted' : ''}`} onClick={() => toggleSort(key)}>
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  return (
    <div className="inventory-table-wrapper">
      <h2>Process Inventory</h2>
      <table className="inventory-table">
        <thead>
          <tr>
            {th('Process name', 'title')}
            {th('Department', 'department')}
            {th('Owner', 'owner')}
            {th('Status', 'status')}
            {th('Version', 'version')}
            {th('Last updated', 'last_updated')}
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {[...grouped.entries()].map(([cat, rows]) => (
            <Fragment key={cat}>
              <tr className="group-header" onClick={() => toggleGroup(cat)}>
                <td colSpan={7}>
                  <span className="group-toggle">{collapsed.has(cat) ? '▶' : '▼'}</span>
                  {cat}
                </td>
              </tr>
              {!collapsed.has(cat) &&
                rows.map((p) => {
                  const canOpen = isAdmin || p.status === 'approved'
                  return (
                    <tr key={p.id} className={p.status === 'draft' ? 'row-draft' : ''}>
                      <td>{p.title}</td>
                      <td>{p.department}</td>
                      <td>
                        <a href={`mailto:${p.owner_email}`}>{p.owner}</a>
                      </td>
                      <td>
                        <span className={`badge badge-${p.status}`}>{p.status}</span>
                      </td>
                      <td>{p.version}</td>
                      <td>{p.last_updated}</td>
                      <td>
                        {canOpen ? (
                          <Link to={`/process/${p.id}`} className="btn btn-sm btn-outline">
                            Open
                          </Link>
                        ) : (
                          <span className="btn btn-sm btn-outline disabled">Open</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
