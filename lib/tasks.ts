/**
 * Ultra-minimal task relevance scoring system
 * The goal: Show the right tasks at the right time with zero configuration
 */

interface TaskWithScore extends Task {
  relevanceScore: number
  relevanceReason?: string
}

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
}

// Pure LLM mode: no hardcoded domains/keywords

/**
 * Calculate relevance score for a task based on current context
 * Higher score = more relevant right now
 */
export function calculateRelevanceScore(task: Task): number {
  const aiScore = Number(task.emailMetadata?.smartAnalysis?.priorityScore)
  if (!Number.isFinite(aiScore)) {
    return 50
  }
  return Math.max(0, Math.min(100, Math.round(aiScore)))
}

/**
 * Get smart explanation for why a task is prioritized
 */
export function getRelevanceReason(task: Task): string {
  const reason = task.emailMetadata?.smartAnalysis?.priorityReasoning
  if (typeof reason === 'string' && reason.trim().length > 0) {
    return reason.trim().slice(0, 140)
  }
  const score = task.emailMetadata?.smartAnalysis?.priorityScore
  return Number.isFinite(score) ? `AI priority ${Math.round(score)} / 100` : ''
}

/**
 * Get tasks sorted by relevance
 */
export function getSmartTaskList(
  tasks: Task[], 
  limit: number = 5,
  _now: Date = new Date()
): TaskWithScore[] {
  return tasks
    .filter(task => task.status !== 'done') // Hide completed tasks
    .map(task => ({
      ...task,
      relevanceScore: calculateRelevanceScore(task),
      relevanceReason: getRelevanceReason(task)
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
}

/**
 * Get smart icon for task based on its characteristics
 */
export function getTaskIcon(task: Task): string {
  // Overdue
  if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done') {
    return '🔴'
  }
  
  // Reminder
  if (task.reminderDate && new Date(task.reminderDate) <= new Date()) {
    return '⏰'
  }
  
  // Due today
  if (task.dueDate && isToday(new Date(task.dueDate), new Date())) {
    return '⚡'
  }
  
  // Email thread
  if (task.emailMetadata?.threadLength > 1) {
    return '💬'
  }
  
  // Calendar/meeting related
  if (task.title.toLowerCase().includes('meeting') || 
      task.title.toLowerCase().includes('standup') ||
      task.title.toLowerCase().includes('call')) {
    return '📅'
  }
  
  // Question
  if (task.title.includes('?')) {
    return '❓'
  }
  
  // From email
  if (task.createdVia === 'email') {
    return '📧'
  }
  
  // Default
  return '○'
}

/**
 * Learn from user interaction (would update weights in production)
 */
export function recordInteraction(taskId: string, action: 'click' | 'complete' | 'snooze' | 'ignore') {
  // In production, this would:
  // 1. Track which tasks get clicked quickly (increase sender importance)
  // 2. Track which tasks get snoozed (decrease time-of-day relevance)
  // 3. Track which tasks get ignored (decrease overall weight)
  // 4. Update VIP lists based on response patterns
  
  // For now, just log it
  console.log(`User ${action} on task ${taskId}`)
}

// Helper functions
function isToday(date: Date, now: Date): boolean {
  return date.getDate() === now.getDate() &&
         date.getMonth() === now.getMonth() &&
         date.getFullYear() === now.getFullYear()
}

function isTomorrow(date: Date, now: Date): boolean {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return date.getDate() === tomorrow.getDate() &&
         date.getMonth() === tomorrow.getMonth() &&
         date.getFullYear() === tomorrow.getFullYear()
}

/**
 * Language-agnostic search interpreter
 * Works with:
 * 1. AI-extracted tags in any language (what, who, where, when)
 * 2. Structured data filters (priority:high, status:done)
 * 3. Free text search in any language
 * 
 * Does NOT use hardcoded keywords in any specific language.
 */
export function interpretCommand(query: string, tasks: Task[], filters: string[] = []): Task[] {
  const q = (query || '').toLowerCase().trim()

  // Parse key:value tokens from query and filters
  const tokenRegex = /(\w+):([^\s]+)/g
  const kv: Record<string, Set<string>> = {}
  const addKv = (k: string, v: string) => {
    const key = k.toLowerCase()
    if (!kv[key]) kv[key] = new Set<string>()
    kv[key].add(v.toLowerCase())
  }
  
  let m: RegExpExecArray | null
  while ((m = tokenRegex.exec(q)) !== null) {
    addKv(m[1], m[2])
  }
  for (const f of filters) {
    const fm = f.match(/^(\w+):(.+)$/)
    if (fm) addKv(fm[1], fm[2])
  }

  const freeText = q.replace(tokenRegex, '').trim()

  const matchesKv = (task: Task): boolean => {
    const tags = task.emailMetadata?.smartAnalysis?.tags || {}
    const projectTag = task.emailMetadata?.smartAnalysis?.projectTag
    const when: string | null = tags.when || null
    const where: string | null = tags.where || null
    const who: string | null = tags.who || null
    const what: string | null = tags.what || null
    const extras: string[] = Array.isArray(tags.extras) ? tags.extras : []
    const itemType = task.emailMetadata?.itemType || 'task'

    for (const [key, values] of Object.entries(kv)) {
      // Each key: any of its values may match
      const needleList = Array.from(values)
      const includesAny = (s?: string | null) => s ? needleList.some(v => s.toLowerCase().includes(v)) : false
      
      switch (key) {
        // Original tag-based filters
        case 'what':
          if (!includesAny(what)) return false
          break
        case 'who':
          if (!includesAny(who)) return false
          break
        case 'where':
          if (!includesAny(where)) return false
          break
        case 'when':
          if (!includesAny(when)) return false
          break
        case 'tag':
          if (!(includesAny(what) || includesAny(who) || includesAny(where) || includesAny(when) || extras.some(e => includesAny(e)))) return false
          break
        case 'project':
          if (!includesAny(projectTag)) return false
          break
        case 'from':
          if (!includesAny(task.createdBy?.email)) return false
          break
        
        // The 'when' tag is extracted by AI in the user's language
        // We search within it rather than using hardcoded keywords
        case 'when': {
          // This matches against the AI-extracted temporal tag
          // The AI would have written "tomorrow at 3pm", "domani alle 15", etc.
          for (const value of needleList) {
            if (when && when.toLowerCase().includes(value)) return true
          }
          return false
        }
        
        // Status filters - using actual database values (language-agnostic)
        case 'status': {
          for (const value of needleList) {
            // Match actual status values from the database
            if (task.status?.toLowerCase() === value) return true
            
            // Special case: overdue is calculated, not stored
            if (value === 'overdue' && task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done') {
              return true
            }
          }
          return false
        }
        
        // Priority filters - using actual database values (language-agnostic)
        case 'priority': {
          for (const value of needleList) {
            // Match actual priority values from the database (high, medium, low)
            if (task.priority?.toLowerCase() === value) return true
          }
          return false
        }
        
        // Source filters - using actual database values (language-agnostic)
        case 'source': {
          for (const value of needleList) {
            // Match actual createdVia values from the database
            if (task.createdVia === value) return true
          }
          return false
        }
        
        // Item type filters - using actual metadata values (language-agnostic)
        case 'type': {
          for (const value of needleList) {
            // Match actual itemType values from email metadata
            if (itemType === value) return true
          }
          return false
        }
        
        default:
          // Unknown key → require presence in haystack
          const hay = buildHaystack(task)
          if (!needleList.some(v => hay.includes(v))) return false
      }
    }
    return true
  }

  const matchesFree = (task: Task): boolean => {
    if (!freeText) return true
    const hay = buildHaystack(task)
    return hay.includes(freeText)
  }

  return tasks.filter(t => matchesKv(t) && matchesFree(t))
}

function buildHaystack(task: Task): string {
  const tags = task.emailMetadata?.smartAnalysis?.tags || {}
  const extras = Array.isArray(tags.extras) ? tags.extras.join(' ') : ''
  return [
    task.title || '',
    task.description || '',
    task.createdBy?.email || '',
    task.createdBy?.name || '',
    String(task.emailMetadata?.smartAnalysis?.projectTag || ''),
    String(tags.when || ''),
    String(tags.where || ''),
    String(tags.who || ''),
    String(tags.what || ''),
    extras
  ].join(' ').toLowerCase()
}
