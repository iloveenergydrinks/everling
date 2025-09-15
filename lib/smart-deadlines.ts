import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface SmartDeadlineAnalysis {
  suggestedDueDate: Date | null
  confidence: number // 0-1
  reasoning: string
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
  timeSignals: TimeSignal[]
  businessContext: BusinessContext
  reminderStrategy: ReminderStrategy
}

interface TimeSignal {
  type: 'explicit' | 'implicit' | 'contextual'
  text: string
  extractedDate: Date | null
  confidence: number
}

interface BusinessContext {
  isDeadlineCritical: boolean
  hasExternalDependencies: boolean
  affectsOthers: boolean
  businessHours: boolean
}

interface ReminderStrategy {
  optimalReminderTime: Date | null
  reminderFrequency: 'once' | 'daily' | 'hourly'
  escalationNeeded: boolean
  reasoning: string
}

/**
 * AI-powered deadline analysis - understands context, not just keywords
 */
export async function analyzeDeadlineIntelligence(
  emailData: {
    from: string
    subject: string
    body: string
    timestamp: Date
  },
  threadContext: any = null,
  senderHistory: any = null
): Promise<SmartDeadlineAnalysis> {
  try {
    const now = new Date()
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      temperature: 0.1,
      system: `You are an expert deadline intelligence analyst. Your job is to understand time-sensitive requirements from business communications and suggest optimal due dates and reminder strategies.

ANALYSIS FRAMEWORK:

1. TIME SIGNAL DETECTION
   - Explicit deadlines: "by Friday", "due March 15", "need this Monday"
   - Implicit urgency: "ASAP", "urgent", "time-sensitive", "critical"
   - Contextual timing: "for the board meeting", "before the client call", "end of quarter"
   - Business cycles: "end of week", "month-end", "quarterly review"

2. URGENCY CLASSIFICATION
   - Critical: Immediate business impact, blocking others, external deadlines
   - High: Important stakeholders, near-term deadlines, revenue impact
   - Medium: Standard business requests, reasonable timelines
   - Low: Nice-to-have, flexible timing, internal improvements

3. BUSINESS CONTEXT UNDERSTANDING
   - External dependencies: Client meetings, vendor deadlines, regulatory requirements
   - Internal impact: Does delay affect other people/projects?
   - Business hours: Consider working days, holidays, time zones
   - Stakeholder authority: CEO request vs routine task

4. OPTIMAL REMINDER STRATEGY
   - When to remind: Based on task complexity and deadline proximity
   - Frequency: How often to remind without being annoying
   - Escalation: When to escalate if no response

CURRENT CONTEXT:
- Current time: ${now.toISOString()}
- Day of week: ${now.toLocaleDateString('en-US', { weekday: 'long' })}
- Business hours: ${now.getHours() >= 9 && now.getHours() <= 17}

GUIDELINES:
- Be conservative with urgency - don't over-escalate
- Consider business context and relationships
- Factor in realistic completion times
- Account for dependencies and handoffs
- Provide specific reasoning for all decisions

Return comprehensive JSON analysis with specific dates and reasoning.`,
      messages: [{
        role: 'user',
        content: `Analyze deadline requirements for this email:

FROM: ${emailData.from}
SUBJECT: ${emailData.subject}
TIMESTAMP: ${emailData.timestamp.toISOString()}

BODY:
${emailData.body.substring(0, 2000)}

${threadContext ? `
THREAD CONTEXT:
- Status: ${threadContext.currentStatus}
- Participants: ${threadContext.keyParticipants?.map((p: any) => p.email).join(', ')}
- Previous decisions: ${threadContext.decisions?.length || 0}
- Active action items: ${threadContext.actionItems?.length || 0}
` : 'No thread context (new conversation)'}

${senderHistory ? `
SENDER HISTORY:
- Previous emails: ${senderHistory.previousEmails}
- Importance score: ${senderHistory.importanceScore}/100
- Average response time: ${senderHistory.avgResponseTime} hours
` : 'No sender history (new sender)'}

Provide detailed deadline analysis with specific due date recommendations and reminder strategy.`
      }],
    })

    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as SmartDeadlineAnalysis
        
        // Validate and adjust dates
        if (analysis.suggestedDueDate) {
          const suggestedDate = new Date(analysis.suggestedDueDate)
          // Ensure due date is in the future
          if (suggestedDate <= now) {
            analysis.suggestedDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow
            analysis.reasoning += " (Adjusted to tomorrow as suggested date was in the past)"
          }
        }

        return analysis
      }
    }

    throw new Error('Invalid AI response format')
  } catch (error) {
    console.error('Smart deadline analysis failed:', error)
    
    // Fallback to basic analysis
    return {
      suggestedDueDate: null,
      confidence: 0.3,
      reasoning: 'AI analysis failed, no deadline detected',
      urgencyLevel: 'medium',
      timeSignals: [],
      businessContext: {
        isDeadlineCritical: false,
        hasExternalDependencies: false,
        affectsOthers: false,
        businessHours: true
      },
      reminderStrategy: {
        optimalReminderTime: null,
        reminderFrequency: 'once',
        escalationNeeded: false,
        reasoning: 'Default strategy due to analysis failure'
      }
    }
  }
}

/**
 * Smart reminder scheduling based on due date and context
 */
export function calculateOptimalReminders(
  dueDate: Date | null,
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical',
  estimatedEffort: string,
  businessContext: BusinessContext
): Array<{ reminderDate: Date; type: 'initial' | 'follow_up' | 'urgent' | 'escalation' }> {
  if (!dueDate) return []

  const reminders: Array<{ reminderDate: Date; type: 'initial' | 'follow_up' | 'urgent' | 'escalation' }> = []
  const now = new Date()
  const timeToDue = dueDate.getTime() - now.getTime()
  const daysUntilDue = Math.floor(timeToDue / (1000 * 60 * 60 * 24))

  // Critical tasks - aggressive reminding
  if (urgencyLevel === 'critical') {
    if (daysUntilDue > 3) {
      reminders.push({ reminderDate: new Date(dueDate.getTime() - 3 * 24 * 60 * 60 * 1000), type: 'initial' })
    }
    if (daysUntilDue > 1) {
      reminders.push({ reminderDate: new Date(dueDate.getTime() - 1 * 24 * 60 * 60 * 1000), type: 'follow_up' })
    }
    reminders.push({ reminderDate: new Date(dueDate.getTime() - 4 * 60 * 60 * 1000), type: 'urgent' }) // 4 hours before
  }
  
  // High priority - standard aggressive
  else if (urgencyLevel === 'high') {
    if (daysUntilDue > 5) {
      reminders.push({ reminderDate: new Date(dueDate.getTime() - 5 * 24 * 60 * 60 * 1000), type: 'initial' })
    }
    if (daysUntilDue > 1) {
      reminders.push({ reminderDate: new Date(dueDate.getTime() - 1 * 24 * 60 * 60 * 1000), type: 'follow_up' })
    }
  }
  
  // Medium priority - balanced approach
  else if (urgencyLevel === 'medium') {
    if (daysUntilDue > 7) {
      reminders.push({ reminderDate: new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000), type: 'initial' })
    }
    if (daysUntilDue > 2) {
      reminders.push({ reminderDate: new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000), type: 'follow_up' })
    }
  }
  
  // Low priority - minimal reminding
  else {
    if (daysUntilDue > 14) {
      reminders.push({ reminderDate: new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000), type: 'initial' })
    }
  }

  // Filter out past reminders
  return reminders.filter(r => r.reminderDate > now)
}

/**
 * Update task with smart deadline analysis
 */
export async function applySmartDeadlines(
  taskId: string,
  emailData: {
    from: string
    subject: string
    body: string
    timestamp: Date
  },
  threadContext: any = null,
  senderHistory: any = null
) {
  try {
    const deadlineAnalysis = await analyzeDeadlineIntelligence(
      emailData,
      threadContext,
      senderHistory
    )

    // Update task with smart deadline information
    const updateData: any = {}

    if (deadlineAnalysis.suggestedDueDate) {
      updateData.dueDate = deadlineAnalysis.suggestedDueDate
    }

    // Calculate optimal reminders
    if (deadlineAnalysis.suggestedDueDate) {
      const reminders = calculateOptimalReminders(
        deadlineAnalysis.suggestedDueDate,
        deadlineAnalysis.urgencyLevel,
        'medium', // Would get this from smart extraction
        deadlineAnalysis.businessContext
      )

      // Set the first reminder as the task's reminderDate
      if (reminders.length > 0) {
        updateData.reminderDate = reminders[0].reminderDate
      }
    }

    // Update the task
    await prisma.task.update({
      where: { id: taskId },
      data: updateData
    })

    // Create TaskReminder records for multiple reminders
    if (deadlineAnalysis.suggestedDueDate) {
      const reminders = calculateOptimalReminders(
        deadlineAnalysis.suggestedDueDate,
        deadlineAnalysis.urgencyLevel,
        'medium',
        deadlineAnalysis.businessContext
      )

      for (const reminder of reminders) {
        await prisma.taskReminder.create({
          data: {
            taskId,
            reminderDate: reminder.reminderDate,
            recurring: null,
            metadata: {
              type: reminder.type,
              urgencyLevel: deadlineAnalysis.urgencyLevel,
              reasoning: deadlineAnalysis.reasoning,
              autoGenerated: true
            }
          }
        })
      }
    }

    // Log the deadline analysis
    await prisma.taskActivity.create({
      data: {
        taskId,
        type: 'system',
        content: `🤖 AI Deadline Analysis: ${deadlineAnalysis.reasoning}`,
        metadata: JSON.parse(JSON.stringify({
          deadlineAnalysis,
          aiGenerated: true
        }))
      }
    })

    return deadlineAnalysis
  } catch (error) {
    console.error('Failed to apply smart deadlines:', error)
    return null
  }
}

/**
 * Smart reminder timing - when is the best time to remind?
 */
export function getOptimalReminderTime(
  dueDate: Date,
  userTimezone: string = 'America/New_York',
  userPatterns: {
    peakHours: number[]
    preferredReminderTime: number
  } = { peakHours: [9, 14], preferredReminderTime: 9 }
): Date {
  const reminderDate = new Date(dueDate)
  
  // Default: remind 1 day before at user's preferred time
  reminderDate.setDate(reminderDate.getDate() - 1)
  reminderDate.setHours(userPatterns.preferredReminderTime, 0, 0, 0)
  
  // If that's in the past, remind at next peak hour
  const now = new Date()
  if (reminderDate <= now) {
    const nextPeakHour = userPatterns.peakHours.find(hour => hour > now.getHours()) || userPatterns.peakHours[0]
    reminderDate.setTime(now.getTime())
    reminderDate.setHours(nextPeakHour, 0, 0, 0)
    
    // If still in the past, add a day
    if (reminderDate <= now) {
      reminderDate.setDate(reminderDate.getDate() + 1)
    }
  }
  
  return reminderDate
}

/**
 * Analyze if a task should be escalated based on deadline proximity
 */
export async function analyzeEscalationNeeds(
  taskId: string
): Promise<{
  shouldEscalate: boolean
  escalationType: 'reminder' | 'urgent' | 'critical'
  reasoning: string
  suggestedActions: string[]
}> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    if (!task || task.status === 'done') {
      return {
        shouldEscalate: false,
        escalationType: 'reminder',
        reasoning: 'Task completed or not found',
        suggestedActions: []
      }
    }

    const now = new Date()
    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const reminderDate = task.reminderDate ? new Date(task.reminderDate) : null

    // Calculate time factors
    const isOverdue = dueDate && dueDate < now
    const isDueSoon = dueDate && (dueDate.getTime() - now.getTime()) < (24 * 60 * 60 * 1000) // Due within 24 hours
    const reminderPassed = reminderDate && reminderDate < now && !task.reminderSent

    let shouldEscalate = false
    let escalationType: 'reminder' | 'urgent' | 'critical' = 'reminder'
    let reasoning = ''
    const suggestedActions = []

    if (isOverdue) {
      shouldEscalate = true
      escalationType = 'critical'
      reasoning = `Task is overdue by ${Math.floor((now.getTime() - dueDate!.getTime()) / (1000 * 60 * 60 * 24))} days`
      suggestedActions.push('Send immediate notification', 'Consider reassigning', 'Break down into smaller tasks')
    } else if (isDueSoon && task.priority === 'high') {
      shouldEscalate = true
      escalationType = 'urgent'
      reasoning = 'High priority task due within 24 hours'
      suggestedActions.push('Send urgent reminder', 'Check for blockers')
    } else if (reminderPassed) {
      shouldEscalate = true
      escalationType = 'reminder'
      reasoning = 'Scheduled reminder time has passed'
      suggestedActions.push('Send reminder notification')
    }

    return {
      shouldEscalate,
      escalationType,
      reasoning,
      suggestedActions
    }
  } catch (error) {
    console.error('Escalation analysis failed:', error)
    return {
      shouldEscalate: false,
      escalationType: 'reminder',
      reasoning: 'Analysis failed',
      suggestedActions: []
    }
  }
}

/**
 * Smart due date suggestions based on email content and business context
 */
export async function suggestDueDateFromContent(
  content: string,
  subject: string,
  senderImportance: number = 50
): Promise<{
  suggestedDate: Date | null
  confidence: number
  reasoning: string
}> {
  try {
    const now = new Date()
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      temperature: 0.1,
      system: `You are a deadline extraction specialist. Analyze business communications to suggest realistic due dates based on content, urgency, and business context.

ANALYSIS FACTORS:
1. Explicit time references: "by Friday", "end of week", "before the meeting"
2. Implicit urgency: Tone, language patterns, business context
3. Task complexity: Simple approval vs complex analysis
4. Business cycles: End of month, quarter, fiscal year
5. Stakeholder importance: Authority level affects timeline expectations

DEADLINE CALCULATION RULES:
- Explicit dates: Use exactly as specified
- "ASAP/Urgent": 1-2 days depending on complexity
- "End of week": Friday 5pm
- "End of month": Last business day of month
- "Before meeting": Day before mentioned meeting
- No deadline mentioned: Suggest based on content complexity and sender importance

CURRENT CONTEXT:
- Current time: ${now.toISOString()}
- Day: ${now.toLocaleDateString('en-US', { weekday: 'long' })}
- Business hours: ${now.getHours() >= 9 && now.getHours() <= 17}

Return specific date suggestions with confidence scores and detailed reasoning.`,
      messages: [{
        role: 'user',
        content: `Extract due date from this business communication:

SUBJECT: ${subject}
CONTENT: ${content.substring(0, 1500)}
SENDER IMPORTANCE: ${senderImportance}/100

Suggest realistic due date with confidence score and reasoning.`
      }],
    })

    const content_response = message.content[0]
    if (content_response.type === 'text') {
      const jsonMatch = content_response.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        
        return {
          suggestedDate: result.suggestedDate ? new Date(result.suggestedDate) : null,
          confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
          reasoning: result.reasoning || 'AI analysis completed'
        }
      }
    }

    return {
      suggestedDate: null,
      confidence: 0.3,
      reasoning: 'Could not extract deadline from content'
    }
  } catch (error) {
    console.error('Due date suggestion failed:', error)
    return {
      suggestedDate: null,
      confidence: 0.1,
      reasoning: 'Analysis failed'
    }
  }
}
