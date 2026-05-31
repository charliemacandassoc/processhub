import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProcessStore } from '../store/useProcessStore'
import { useSearch } from '../hooks/useSearch'
import { ProcessSummary } from '../types'

interface Props {
  onClose: () => void
}

export function ProcessTreeNav({ onClose }: Props) {
  const processes = useProcessStore((s) => s.processes)
  const searchQuery = useProcessStore((s) => s.searchQuery)
  const setSearchQuery = useProcessStore((s) => s.setSearchQuery)
  const { id: activeId } = useParams()
  const navigate = useNavigate()

  const results = useSearch(processes, searchQuery)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleCat(cat: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function goTo(p: ProcessSummary) {
    navigate(`/process/${p.id}`)
    onClose()
  }

  if (searchQuery.trim()) {
    return (
      <div className="tree-nav">
        <SearchBox query={searchQuery} onChange={setSearchQuery} />
        <ul className="tree-results">
          {results.map((p) => (
            <li
              key={p.id}
              className={`tree-leaf ${p.id === activeId ? 'active' : ''}`}
              onClick={() => goTo(p)}
            >
              <span className="tree-leaf-title">{p.title}</span>
              <span className="tree-leaf-dept">{p.department}</span>
            </li>
          ))}
          {results.length === 0 && <li className="tree-empty">No matches</li>}
        </ul>
      </div>
    )
  }

  // Build category tree
  const tree = new Map<string, Map<string, ProcessSummary[]>>()
  for (const p of processes) {
    const top = p.category[0] ?? 'Uncategorised'
    const sub = p.category[1] ?? ''
    if (!tree.has(top)) tree.set(top, new Map())
    const subs = tree.get(top)!
    if (!subs.has(sub)) subs.set(sub, [])
    subs.get(sub)!.push(p)
  }

  return (
    <div className="tree-nav">
      <SearchBox query={searchQuery} onChange={setSearchQuery} />
      <ul className="tree-root">
        {[...tree.entries()].map(([cat, subs]) => {
          const isOpen = expanded.has(cat)
          return (
            <li key={cat} className="tree-category">
              <div className="tree-category-header" onClick={() => toggleCat(cat)}>
                <span className="tree-icon">{isOpen ? '▼' : '▶'}</span>
                {cat}
              </div>
              {isOpen && (
                <ul>
                  {[...subs.entries()].map(([sub, leaves]) =>
                    sub ? (
                      <li key={sub} className="tree-subcategory">
                        <div
                          className="tree-subcategory-header"
                          onClick={() => toggleCat(`${cat}/${sub}`)}
                        >
                          <span className="tree-icon">
                            {expanded.has(`${cat}/${sub}`) ? '▼' : '▶'}
                          </span>
                          {sub}
                        </div>
                        {expanded.has(`${cat}/${sub}`) && (
                          <ul>
                            {leaves.map((p) => (
                              <LeafNode key={p.id} p={p} activeId={activeId} onClick={() => goTo(p)} />
                            ))}
                          </ul>
                        )}
                      </li>
                    ) : (
                      leaves.map((p) => (
                        <LeafNode key={p.id} p={p} activeId={activeId} onClick={() => goTo(p)} />
                      ))
                    )
                  )}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function LeafNode({ p, activeId, onClick }: { p: ProcessSummary; activeId?: string; onClick: () => void }) {
  return (
    <li
      className={`tree-leaf ${p.id === activeId ? 'active' : ''}`}
      onClick={onClick}
    >
      {p.title}
      {p.status === 'draft' && <span className="badge badge-draft badge-xs">draft</span>}
    </li>
  )
}

function SearchBox({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  return (
    <div className="tree-search">
      <input
        type="search"
        placeholder="Search processes…"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        className="search-input"
      />
    </div>
  )
}
