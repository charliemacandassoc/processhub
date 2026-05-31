import { create } from 'zustand'
import { BreadcrumbEntry, ProcessSummary, User } from '../types'

interface ProcessStore {
  // Auth
  user: User | null
  token: string | null
  setUser: (user: User | null, token: string | null) => void

  // Inventory
  processes: ProcessSummary[]
  setProcesses: (processes: ProcessSummary[]) => void
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Process viewer
  activeProcessId: string | null
  activeStepId: string | null
  breadcrumbStack: BreadcrumbEntry[]
  setActiveProcess: (id: string) => void
  setActiveStep: (id: string | null) => void
  pushSubprocess: (entry: BreadcrumbEntry) => void
  popToLevel: (index: number) => void
  clearProcess: () => void
}

export const useProcessStore = create<ProcessStore>((set) => ({
  user: null,
  token: null,
  setUser: (user, token) => set({ user, token }),

  processes: [],
  setProcesses: (processes) => set({ processes }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  activeProcessId: null,
  activeStepId: null,
  breadcrumbStack: [],
  setActiveProcess: (id) =>
    set({ activeProcessId: id, activeStepId: null, breadcrumbStack: [] }),
  setActiveStep: (id) => set({ activeStepId: id }),
  pushSubprocess: (entry) =>
    set((s) => ({ breadcrumbStack: [...s.breadcrumbStack, entry] })),
  popToLevel: (index) =>
    set((s) => ({ breadcrumbStack: s.breadcrumbStack.slice(0, index) })),
  clearProcess: () =>
    set({ activeProcessId: null, activeStepId: null, breadcrumbStack: [] }),
}))
