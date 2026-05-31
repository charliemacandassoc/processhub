import { useEffect, useState } from 'react'
import { useProcessStore } from '../store/useProcessStore'
import { api } from '../lib/api'
import { ProcessSummary } from '../types'
import { ProcessInventoryTable } from '../components/ProcessInventoryTable'

export function Inventory() {
  const { processes, setProcesses } = useProcessStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<ProcessSummary[]>('/processes')
      .then(setProcesses)
      .catch((e: Error) => setError(e.message))
  }, [setProcesses])

  return (
    <div className="page-content">
      {error ? (
        <div className="error-banner">{error}</div>
      ) : (
        <ProcessInventoryTable processes={processes} />
      )}
    </div>
  )
}
