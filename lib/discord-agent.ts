import { extractSmartTask, calculateSmartPriority, extractTaskRelationships } from './smart-agent'
import prisma from './prisma'

/**
 * Process Discord messages and extract tasks - wrapper for Discord bot
 */
export async function smartAgent(params: {
  content: string
  subject: string
  from: string
  userId?: string
  metadata?: {
    source: string
    channelId?: string
    guildId?: string
    messageId?: string
    threadUrl?: string
    threadLike?: {
      from: string
      subject: string
      body: string
      timestamp: Date
    }
  }
}): Promise<{
  success: boolean
  task?: any
  tasks?: any[]
  message?: string
}> {
  try {
    console.log('🤖 Discord Agent: Processing message from', params.from)
    
    // Find the user by ID if provided
    let user = null
    if (params.userId) {
      user = await prisma.user.findUnique({
        where: { id: params.userId },
        include: { organizations: true }
      })
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        }
      }
    }
    
    const organizationId = user?.organizations?.[0]?.organizationId
    if (!organizationId) {
      console.error('No organization found for user')
      return {
        success: false,
        message: 'No organization found'
      }
    }
    
    // Prepare email-like data for the AI
    const emailData = params.metadata?.threadLike ?? {
      from: params.from,
      subject: params.subject,
      body: params.content,
      timestamp: new Date()
    }
    
    // Calculate priority (simplified for Discord)
    const priorityScore = {
      score: 50,
      reasoning: 'Discord message - default priority',
      factors: {
        senderImportance: 10,
        urgencyLevel: 10,
        businessImpact: 10,
        timeConstraint: 10,
        contextualRelevance: 10
      }
    }
    
    // Extract tasks using the smart agent
    // Retry logic with basic fallback heuristics if AI is unavailable
    let extractedTasks: any
    try {
      extractedTasks = await extractSmartTask(
        emailData,
        null,
        priorityScore
      )
    } catch (aiErr) {
      console.warn('AI extraction failed, applying fallback heuristics')
      // Heuristic: detect simple Italian dates like "domani"
      const lower = (emailData.body || '').toLowerCase()
      const hasDomani = lower.includes('domani')
      const due = hasDomani ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null
      extractedTasks = {
        title: params.subject,
        description: `From: ${params.from}\n\n${params.content}`.substring(0, 1000),
        priority: 'medium',
        dueDate: due,
        reminderDate: null,
        estimatedEffort: 'medium',
        businessImpact: 'medium',
        stakeholders: [params.from],
        projectTag: null,
        dependencies: []
      }
    }

    // Normalize to array
    const tasksArray = Array.isArray(extractedTasks) ? extractedTasks : [extractedTasks]

    // De-duplication: avoid creating tasks again for the same Discord message
    const discordMessageId = params.metadata?.messageId || null
    const existingForMessage = discordMessageId ? await prisma.task.findMany({
      where: {
        organizationId: organizationId,
        emailMetadata: {
          path: ['messageId'],
          equals: discordMessageId
        }
      },
      select: { id: true, emailMetadata: true }
    }) : []

    const existingIndices = new Set<number>(
      existingForMessage
        .map(t => (t as any)?.emailMetadata?.taskIndex)
        .filter((n: any) => typeof n === 'number')
    )
    
    // Handle both single task and array of tasks
    
    console.log(`🤖 Extracted ${tasksArray.length} task(s) from Discord`)
    
    // Create tasks in database
    const createdTasks = []
    for (let index = 0; index < tasksArray.length; index++) {
      const taskData = tasksArray[index]

      // Skip duplicates for the same Discord message/taskIndex
      if (discordMessageId && existingIndices.has(index)) {
        console.log('🧹 Skipping duplicate task for message', discordMessageId, 'index', index)
        continue
      }
      const task = await prisma.task.create({
        data: {
          title: taskData.title || params.subject,
          description: taskData.description || params.content,
          status: 'pending',
          priority: taskData.priority || 'medium',
          dueDate: taskData.dueDate,
          reminderDate: taskData.reminderDate,
          createdVia: 'discord',
          createdById: user.id,
          assignedToId: user.id,
          organizationId: organizationId,
          emailMetadata: {
            ...params.metadata,
            discordUser: params.from,
            originalContent: params.content,
            createdByDiscord: true,
            smartAnalysis: {
              // Attach tags if present so UI behaves like email
              tags: taskData.tags || null,
              projectTag: taskData.projectTag || null,
              estimatedEffort: taskData.estimatedEffort || 'medium',
              businessImpact: taskData.businessImpact || 'medium'
            },
            taskIndex: index,
            totalTasks: tasksArray.length
          },
          assignedByEmail: user.email,  // Self-assigned
          assignedToEmail: user.email,  // To themselves
          taskType: 'self',
          userRole: 'executor'
        }
      })
      
      createdTasks.push({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate
      })
    }
    
    // Return appropriate response
    if (createdTasks.length === 1) {
      return {
        success: true,
        task: createdTasks[0],
        message: `Created task: "${createdTasks[0].title}"`
      }
    } else if (createdTasks.length > 1) {
      return {
        success: true,
        tasks: createdTasks,
        message: `Created ${createdTasks.length} tasks`
      }
    } else {
      return {
        success: false,
        message: 'No tasks could be extracted from this conversation'
      }
    }
    
  } catch (error) {
    console.error('Discord agent error:', error)
    return {
      success: false,
      message: 'Failed to process Discord message'
    }
  }
}
