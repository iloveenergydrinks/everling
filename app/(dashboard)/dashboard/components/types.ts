export interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  reminderDate: string | null
  createdAt: string
  createdVia: string
  emailMetadata: any
  createdBy: {
    name: string | null
    email: string
  } | null
  assignedTo: {
    name: string | null
    email: string
  } | null
  // Relationship fields
  assignedToEmail?: string | null
  assignedByEmail?: string | null
  taskType?: string | null
  userRole?: string | null
  stakeholders?: any
  relevanceScore?: number
  relevanceReason?: string
}

export type TimeFilter = 'today' | 'tomorrow' | 'week' | 'no-date' | 'expired' | 'completed'
export type OwnershipFilter = 'my-tasks' | 'waiting-on' | 'observing'

export interface FilterState {
  time: TimeFilter[]
  ownership: OwnershipFilter[]
}
