import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useProcessStore } from '../store/useProcessStore'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const isAdmin = useProcessStore((s) => s.user?.isAdmin)
  if (!isAdmin) return <Navigate to="/inventory" replace />
  return <>{children}</>
}
