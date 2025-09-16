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
 * Smart search/command interpreter with natural language understanding
 */
export function interpretCommand(query: string, tasks: Task[], filters: string[] = []): Task[] {
  const q = (query || '').toLowerCase().trim()
  
  // Natural language understanding - convert common phrases to filters
  let enhancedQuery = q
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  // Natural language patterns to key:value tokens
  const nlPatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    // Temporal queries
    [/\b(today|oggi)\b/gi, () => 'temporal:today'],
    [/\b(tomorrow|domani)\b/gi, () => 'temporal:tomorrow'],
    [/\b(yesterday|ieri)\b/gi, () => 'temporal:yesterday'],
    [/\bthis week\b/gi, () => 'temporal:this-week'],
    [/\bnext week\b/gi, () => 'temporal:next-week'],
    [/\b(overdue|scadut[oi])\b/gi, () => 'status:overdue'],
    [/\bdue soon\b/gi, () => 'temporal:due-soon'],
    [/\bcoming up\b/gi, () => 'temporal:coming-up'],
    
    // Priority queries
    [/\b(urgent|urgente|high priority|alta priorità)\b/gi, () => 'priority:high'],
    [/\b(important|importante)\b/gi, () => 'priority:high'],
    [/\blow priority\b/gi, () => 'priority:low'],
    
    // Status queries
    [/\b(done|completed|completat[oi]|fatt[oi])\b/gi, () => 'status:done'],
    [/\b(pending|in sospeso|da fare)\b/gi, () => 'status:pending'],
    [/\b(in progress|in corso)\b/gi, () => 'status:in-progress'],
    
    // Source queries
    [/\b(email|emails|mail|from email)\b/gi, () => 'source:email'],
    [/\b(manual|created by me)\b/gi, () => 'source:manual'],
    
    // Context queries
    [/\b(recent|recente|latest|ultim[oi])\b/gi, () => 'temporal:recent'],
    [/\b(old|vecchi[oi])\b/gi, () => 'temporal:old'],
  ]
  
  // Apply natural language patterns
  const nlTokens: string[] = []
  for (const [pattern, converter] of nlPatterns) {
    const matches = q.match(pattern)
    if (matches) {
      const token = converter(matches)
      nlTokens.push(token)
      // Remove the matched pattern from free text search
      enhancedQuery = enhancedQuery.replace(pattern, '')
    }
  }

  // Parse key:value tokens from query and filters
  const tokenRegex = /(\w+):([^\s]+)/g
  const kv: Record<string, Set<string>> = {}
  const addKv = (k: string, v: string) => {
    const key = k.toLowerCase()
    if (!kv[key]) kv[key] = new Set<string>()
    kv[key].add(v.toLowerCase())
  }
  
  // Add natural language tokens
  for (const token of nlTokens) {
    const [key, value] = token.split(':')
    addKv(key, value)
  }
  
  // Parse explicit key:value tokens
  let m: RegExpExecArray | null
  while ((m = tokenRegex.exec(q)) !== null) {
    addKv(m[1], m[2])
  }
  for (const f of filters) {
    const fm = f.match(/^(\w+):(.+)$/)
    if (fm) addKv(fm[1], fm[2])
  }

  const freeText = enhancedQuery.replace(tokenRegex, '').trim()

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
        
        // Temporal filters (natural language)
        case 'temporal': {
          const taskDate = task.dueDate ? new Date(task.dueDate) : null
          const createdDate = new Date(task.createdAt)
          const now = new Date()
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
          const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
          const thisWeekEnd = new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000)
          const nextWeekStart = new Date(thisWeekEnd.getTime() + 24 * 60 * 60 * 1000)
          const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
          
          for (const value of needleList) {
            switch (value) {
              case 'today':
                // Task due today OR has "today" in when tag
                if (taskDate && taskDate.toDateString() === today.toDateString()) return true
                if (when && (when.toLowerCase().includes('today') || when.toLowerCase().includes('oggi'))) return true
                continue
              case 'tomorrow':
                // Task due tomorrow OR has "tomorrow" in when tag
                if (taskDate && taskDate.toDateString() === tomorrow.toDateString()) return true
                if (when && (when.toLowerCase().includes('tomorrow') || when.toLowerCase().includes('domani'))) return true
                continue
              case 'yesterday':
                if (taskDate && taskDate.toDateString() === yesterday.toDateString()) return true
                continue
              case 'this-week':
                if (taskDate && taskDate >= today && taskDate <= thisWeekEnd) return true
                if (when && when.toLowerCase().includes('this week')) return true
                continue
              case 'next-week':
                if (taskDate && taskDate >= nextWeekStart && taskDate <= nextWeekEnd) return true
                if (when && when.toLowerCase().includes('next week')) return true
                continue
              case 'due-soon':
                // Due within 3 days
                if (taskDate && taskDate >= today && taskDate <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)) return true
                continue
              case 'coming-up':
                // Due within 7 days
                if (taskDate && taskDate >= today && taskDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) return true
                continue
              case 'recent':
                // Created in last 3 days
                if (createdDate >= new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)) return true
                continue
              case 'old':
                // Created more than 7 days ago
                if (createdDate < new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) return true
                continue
            }
          }
          return false
        }
        
        // Status filters
        case 'status': {
          for (const value of needleList) {
            switch (value) {
              case 'overdue':
                // Task is overdue
                if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done') return true
                continue
              case 'done':
                if (task.status === 'done' || task.status === 'completed') return true
                continue
              case 'pending':
                if (task.status === 'pending' || task.status === 'todo') return true
                continue
              case 'in-progress':
                if (task.status === 'in-progress' || task.status === 'in_progress') return true
                continue
            }
          }
          return false
        }
        
        // Priority filters
        case 'priority': {
          for (const value of needleList) {
            if (task.priority?.toLowerCase() === value) return true
          }
          return false
        }
        
        // Source filters
        case 'source': {
          for (const value of needleList) {
            switch (value) {
              case 'email':
                if (task.createdVia === 'email') return true
                continue
              case 'manual':
                if (task.createdVia !== 'email') return true
                continue
            }
          }
          return false
        }
        
        // Item type filters (task, reminder, read-later, etc.)
        case 'type': {
          for (const value of needleList) {
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
