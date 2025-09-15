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

// VIP detection - learns from user behavior
const VIP_DOMAINS = ['client.com', 'important.com'] // This would be dynamic in production
const VIP_KEYWORDS = ['ceo', 'cfo', 'urgent', 'asap', 'critical']

/**
 * Calculate relevance score for a task based on current context
 * Higher score = more relevant right now
 */
export function calculateRelevanceScore(task: Task, now: Date = new Date()): number {
  let score = 100 // Base score
  
  const taskAge = Math.floor((now.getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  
  // 1. OVERDUE - Absolute highest priority
  if (task.dueDate && new Date(task.dueDate) < now && task.status !== 'done') {
    const daysOverdue = Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    score += 1000 + (daysOverdue * 50) // More overdue = higher priority
  }
  
  // 2. REMINDERS - Very high priority when triggered
  if (task.reminderDate) {
    const reminderTime = new Date(task.reminderDate).getTime()
    const timeDiff = reminderTime - now.getTime()
    
    if (timeDiff <= 0 && task.status !== 'done') {
      score += 800 // Reminder is now or passed
    } else if (timeDiff <= 60 * 60 * 1000) {
      score += 400 // Reminder within next hour
    }
  }
  
  // 3. DUE TODAY - High priority
  if (task.dueDate && isToday(new Date(task.dueDate), now) && task.status !== 'done') {
    const hoursUntilDue = Math.floor((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60))
    if (hoursUntilDue <= 2) {
      score += 600 // Due very soon
    } else if (hoursUntilDue <= 8) {
      score += 400 // Due today
    } else {
      score += 200 // Due later today
    }
  }
  
  // 4. VIP SENDER - Important people get priority
  if (task.createdBy?.email) {
    const email = task.createdBy.email.toLowerCase()
    const domain = email.split('@')[1]
    
    // Check if from VIP domain
    if (VIP_DOMAINS.some(vip => domain?.includes(vip))) {
      score += 300
    }
    
    // Check for VIP keywords in email or title
    const titleLower = task.title.toLowerCase()
    if (VIP_KEYWORDS.some(keyword => 
      titleLower.includes(keyword) || 
      email.includes(keyword)
    )) {
      score += 250
    }
  }
  
  // 5. PRIORITY FIELD - Respect manual priority
  if (task.priority === 'high') {
    score += 200
  } else if (task.priority === 'low') {
    score -= 100
  }
  
  // 6. IN PROGRESS - Boost tasks already started
  if (task.status === 'in_progress') {
    score += 150
  }
  
  // 7. TIME OF DAY PATTERNS
  const hour = now.getHours()
  const dayOfWeek = now.getDay()
  
  // Morning boost for daily/standup tasks
  if (hour >= 8 && hour <= 10) {
    if (task.title.toLowerCase().includes('standup') || 
        task.title.toLowerCase().includes('daily')) {
      score += 200
    }
  }
  
  // End of day boost for reports/reviews
  if (hour >= 16 && hour <= 18) {
    if (task.title.toLowerCase().includes('report') || 
        task.title.toLowerCase().includes('review') ||
        task.title.toLowerCase().includes('summary')) {
      score += 150
    }
  }
  
  // Monday boost for weekly planning
  if (dayOfWeek === 1 && (
    task.title.toLowerCase().includes('weekly') ||
    task.title.toLowerCase().includes('planning')
  )) {
    score += 100
  }
  
  // Friday boost for week wrap-up
  if (dayOfWeek === 5 && (
    task.title.toLowerCase().includes('wrap') ||
    task.title.toLowerCase().includes('summary') ||
    task.title.toLowerCase().includes('weekly')
  )) {
    score += 100
  }
  
  // 8. RECENCY DECAY - Older tasks slowly fade (unless they're important)
  if (!task.dueDate && !task.reminderDate) {
    score -= taskAge * 5 // Lose 5 points per day if no date set
  }
  
  // 9. EMAIL THREADS - Active threads get priority
  if (task.emailMetadata?.threadLength > 1) {
    score += Math.min(task.emailMetadata.threadLength * 20, 200) // Cap at 200
  }
  
  // 10. QUESTIONS - Tasks that are questions get slight boost
  if (task.title.includes('?') || 
      task.description?.includes('?') ||
      task.title.toLowerCase().includes('question')) {
    score += 50
  }
  
  // Never let score go below 0
  return Math.max(0, Math.round(score))
}

/**
 * Get smart explanation for why a task is prioritized
 */
export function getRelevanceReason(task: Task, now: Date = new Date()): string {
  const reasons = []
  
  if (task.dueDate && new Date(task.dueDate) < now && task.status !== 'done') {
    const daysOverdue = Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    reasons.push(`${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue`)
  }
  
  if (task.reminderDate && new Date(task.reminderDate) <= now && task.status !== 'done') {
    reasons.push('Reminder triggered')
  }
  
  if (task.dueDate && isToday(new Date(task.dueDate), now) && task.status !== 'done') {
    const hoursUntilDue = Math.floor((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60))
    if (hoursUntilDue <= 2 && hoursUntilDue > 0) {
      reasons.push(`Due in ${hoursUntilDue} ${hoursUntilDue === 1 ? 'hour' : 'hours'}`)
    } else if (hoursUntilDue <= 0) {
      reasons.push('Due now')
    } else {
      reasons.push('Due today')
    }
  }
  
  if (task.status === 'in_progress') {
    reasons.push('In progress')
  }
  
  if (task.priority === 'high') {
    reasons.push('High priority')
  }
  
  if (task.createdBy?.email && VIP_DOMAINS.some(vip => task.createdBy?.email.includes(vip))) {
    reasons.push('From VIP')
  }
  
  return reasons.slice(0, 2).join(' • ') // Show max 2 reasons
}

/**
 * Get tasks sorted by relevance
 */
export function getSmartTaskList(
  tasks: Task[], 
  limit: number = 5,
  now: Date = new Date()
): TaskWithScore[] {
  return tasks
    .filter(task => task.status !== 'done') // Hide completed tasks
    .map(task => ({
      ...task,
      relevanceScore: calculateRelevanceScore(task, now),
      relevanceReason: getRelevanceReason(task, now)
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
 * Smart search/command interpreter
 */
export function interpretCommand(query: string, tasks: Task[]): Task[] {
  const q = query.toLowerCase().trim()
  
  // Special commands
  if (q === 'done' || q === 'completed') {
    return tasks.filter(t => t.status === 'done')
  }
  
  if (q === 'today') {
    return tasks.filter(t => t.dueDate && isToday(new Date(t.dueDate), new Date()))
  }
  
  if (q === 'tomorrow') {
    return tasks.filter(t => t.dueDate && isTomorrow(new Date(t.dueDate), new Date()))
  }
  
  if (q === 'overdue') {
    return tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done')
  }
  
  if (q === 'urgent' || q === 'high') {
    return tasks.filter(t => t.priority === 'high' || t.title.toLowerCase().includes('urgent'))
  }
  
  // Otherwise, search in title and description
  return tasks.filter(t => 
    t.title.toLowerCase().includes(q) ||
    t.description?.toLowerCase().includes(q) ||
    t.createdBy?.email.toLowerCase().includes(q) ||
    t.createdBy?.name?.toLowerCase().includes(q)
  )
}
