import { interpretSearchWithCache, type SearchInterpretation } from './smart-search'

interface Task {
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
}

/**
 * Intelligently interprets and executes search queries using AI
 * This is the async version that uses Claude 3 Haiku for understanding
 */
export async function interpretSearchIntelligently(
  query: string,
  tasks: Task[],
  userContext?: {
    timezone?: string
    language?: string
  }
): Promise<Task[]> {
  if (!query || query.trim().length === 0) {
    return tasks
  }

  // Get AI interpretation of the search query
  const interpretation = await interpretSearchWithCache(query, {
    ...userContext,
    currentDate: new Date().toISOString()
  })

  console.log('Search interpretation:', {
    query,
    filters: interpretation.filters,
    confidence: interpretation.confidence
  })

  // Apply filters based on AI interpretation
  let filteredTasks = [...tasks]
  
  // Ensure filters exist
  const filters = interpretation.filters || {}

  // Special handling for date searches: Check BOTH dueDate field AND when tags
  if (filters.dueOn || filters.whenContains) {
    const matchingTasks = tasks.filter(task => {
      let matches = false
      
      // Check dueDate field if we have a dueOn filter
      if (filters.dueOn && task.dueDate) {
        const targetDate = new Date(filters.dueOn)
        const taskDate = new Date(task.dueDate)
        if (taskDate.toDateString() === targetDate.toDateString()) {
          matches = true
        }
      }
      
      // Check when tag if we have whenContains filter
      if (filters.whenContains && filters.whenContains.length > 0) {
        const whenTag = task.emailMetadata?.smartAnalysis?.tags?.when
        if (whenTag) {
          const whenLower = String(whenTag).toLowerCase()
          const whenSearchTerms = filters.whenContains.map(term => term.toLowerCase())
          // Check if ANY of the AI-provided search terms appear in the when tag
          if (whenSearchTerms.some(term => whenLower.includes(term))) {
            matches = true
          }
        }
      }
      
      return matches
    })
    
    filteredTasks = matchingTasks
  }

  if (filters.dueBefore) {
    const beforeDate = new Date(filters.dueBefore)
    filteredTasks = filteredTasks.filter(task => {
      if (!task.dueDate) return false
      return new Date(task.dueDate) < beforeDate
    })
  }

  if (filters.dueAfter) {
    const afterDate = new Date(filters.dueAfter)
    filteredTasks = filteredTasks.filter(task => {
      if (!task.dueDate) return false
      return new Date(task.dueDate) > afterDate
    })
  }

  if (filters.createdBefore) {
    const beforeDate = new Date(filters.createdBefore)
    filteredTasks = filteredTasks.filter(task => {
      return new Date(task.createdAt) < beforeDate
    })
  }

  if (filters.createdAfter) {
    const afterDate = new Date(filters.createdAfter)
    filteredTasks = filteredTasks.filter(task => {
      return new Date(task.createdAt) > afterDate
    })
  }

  // Status filters
  if (filters.status && filters.status.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      return filters.status!.includes(task.status as any)
    })
  }

  if (filters.isOverdue) {
    const now = new Date()
    filteredTasks = filteredTasks.filter(task => {
      if (!task.dueDate) return false
      return new Date(task.dueDate) < now && task.status !== 'done'
    })
  }

  // Priority filters
  if (filters.priority && filters.priority.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      return filters.priority!.includes(task.priority as any)
    })
  }

  // Urgency mapping to priority
  if (filters.urgency) {
    const urgencyToPriority: Record<string, string[]> = {
      'immediate': ['high'],
      'soon': ['high', 'medium'],
      'normal': ['medium', 'low'],
      'low': ['low']
    }
    const acceptablePriorities = urgencyToPriority[filters.urgency] || []
    filteredTasks = filteredTasks.filter(task => {
      return acceptablePriorities.includes(task.priority)
    })
  }

  // Source filters
  if (filters.source && filters.source.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      if (filters.source!.includes('email')) {
        return task.createdVia === 'email'
      }
      if (filters.source!.includes('manual')) {
        return task.createdVia !== 'email'
      }
      return false
    })
  }

  // People filters (who is involved)
  if (filters.people && filters.people.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      const taskPeople = [
        task.title,  // IMPORTANT: Search in title too!
        task.description,  // And description!
        task.emailMetadata?.smartAnalysis?.tags?.who,
        task.createdBy?.name,
        task.createdBy?.email,
        task.assignedTo?.name,
        task.assignedTo?.email,
        task.emailMetadata?.from,
        // Include relationship fields
        task.assignedToEmail,
        task.assignedByEmail,
        // Include stakeholder names/emails
        ...(Array.isArray(task.stakeholders) ? 
          task.stakeholders.map((s: any) => [s.name, s.email]).flat() : 
          [])
      ].filter(Boolean).map(p => String(p).toLowerCase())

      return filters.people!.some(person => 
        taskPeople.some(tp => tp.includes(person.toLowerCase()))
      )
    })
  }

  // Email sender filters
  if (filters.fromEmail && filters.fromEmail.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      const from = task.emailMetadata?.from?.toLowerCase() || ''
      const createdBy = task.createdBy?.email?.toLowerCase() || ''
      
      return filters.fromEmail!.some(pattern => {
        const searchPattern = pattern.toLowerCase().replace(/\*/g, '')
        return from.includes(searchPattern) || createdBy.includes(searchPattern)
      })
    })
  }

  // Topic/content filters (what it's about)
  if (filters.topics && filters.topics.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      const taskContent = [
        task.title,
        task.description,
        task.emailMetadata?.smartAnalysis?.tags?.what,
        ...(task.emailMetadata?.smartAnalysis?.tags?.extras || [])
      ].filter(Boolean).map(c => String(c).toLowerCase()).join(' ')

      return filters.topics!.some(topic => 
        taskContent.includes(topic.toLowerCase())
      )
    })
  }

  // Location filters
  if (filters.locations && filters.locations.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      const where = task.emailMetadata?.smartAnalysis?.tags?.where?.toLowerCase() || ''
      return filters.locations!.some(location => 
        where.includes(location.toLowerCase())
      )
    })
  }

  // Task Relationship filters (NEW)
  if (filters.assignedBy && filters.assignedBy.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      const assignedBy = task.assignedByEmail?.toLowerCase() || ''
      return filters.assignedBy!.some(pattern => {
        const searchPattern = pattern.toLowerCase().replace(/\*/g, '')
        return assignedBy.includes(searchPattern)
      })
    })
  }

  if (filters.assignedTo && filters.assignedTo.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      const assignedTo = task.assignedToEmail?.toLowerCase() || ''
      return filters.assignedTo!.some(pattern => {
        const searchPattern = pattern.toLowerCase().replace(/\*/g, '')
        return assignedTo.includes(searchPattern)
      })
    })
  }

  if (filters.taskType && filters.taskType.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      return filters.taskType!.includes(task.taskType as any) 
    })
  }

  if (filters.userRole && filters.userRole.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      return filters.userRole!.includes(task.userRole as any)
    })
  }

  // If no filters matched well (low confidence), fall back to text search
  if (interpretation.confidence < 0.5 && interpretation.searchText) {
    const searchLower = interpretation.searchText.toLowerCase()
    filteredTasks = tasks.filter(task => {
      const haystack = [
        task.title,
        task.description,
        task.createdBy?.email,
        task.createdBy?.name,
        task.emailMetadata?.smartAnalysis?.tags?.when,
        task.emailMetadata?.smartAnalysis?.tags?.where,
        task.emailMetadata?.smartAnalysis?.tags?.who,
        task.emailMetadata?.smartAnalysis?.tags?.what,
        ...(task.emailMetadata?.smartAnalysis?.tags?.extras || []),
        // Include relationship fields in fallback search
        task.assignedToEmail,
        task.assignedByEmail,
        task.taskType,
        task.userRole,
        // Include stakeholder data
        ...(Array.isArray(task.stakeholders) ? 
          task.stakeholders.map((s: any) => [s.name, s.email]).flat() : 
          [])
      ].filter(Boolean).map(s => String(s).toLowerCase()).join(' ')
      
      return haystack.includes(searchLower)
    })
  }

  return filteredTasks
}
