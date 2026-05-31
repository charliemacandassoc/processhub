import { useEffect, useMemo, useRef } from 'react'
import FlexSearch from 'flexsearch'
import { ProcessSummary } from '../types'

type SearchIndex = FlexSearch.Index

export function useSearch(processes: ProcessSummary[], query: string): ProcessSummary[] {
  const indexRef = useRef<SearchIndex | null>(null)

  useEffect(() => {
    const index = new FlexSearch.Index({ tokenize: 'forward' })
    processes.forEach((p, i) => {
      const text = [p.title, p.department, p.owner, p.category.join(' '), p.objective].join(' ')
      index.add(i, text)
    })
    indexRef.current = index
  }, [processes])

  return useMemo(() => {
    if (!query.trim() || !indexRef.current) return processes
    const results = indexRef.current.search(query) as number[]
    return results.map((i) => processes[i]).filter(Boolean)
  }, [query, processes])
}
