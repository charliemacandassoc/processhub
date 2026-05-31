export interface ProcessSummary {
  id: string
  title: string
  category: string[]
  department: string
  owner: string
  owner_email: string
  status: 'approved' | 'draft'
  version: string
  last_updated: string
  objective: string
}

export interface ProcessOverview {
  frontmatter: Omit<ProcessSummary, 'id' | 'objective'>
  content: string
}

export interface StepFrontmatter {
  sme: string
  sme_role: string
  sme_email: string
  status: 'approved' | 'draft'
  version: string
  last_updated: string
}

export interface StepDetail {
  frontmatter: StepFrontmatter
  content: string
}

export interface BreadcrumbEntry {
  label: string
  processId: string
  type: 'process' | 'subprocess'
}

export interface User {
  name: string
  email: string
  isAdmin: boolean
}

export type BpmnElementType = 'startEvent' | 'endEvent' | 'task' | 'subprocess'

export interface BpmnStepInfo {
  id: string
  label: string
  elementType: BpmnElementType
  isSubprocess: boolean
  subprocessId?: string
}
