import { prisma } from '@/lib/prisma'
import { 
  extractTaskRelationships,
  updateSenderIntelligence 
} from '@/lib/smart-agent'
import { applySmartDeadlines } from '@/lib/smart-deadlines'
import { processTaskVisibility } from '@/lib/task-visibility'

interface EmailData {
  From: string
  To: string
  Subject: string
  TextBody?: string
  HtmlBody?: string
  Date: string
  MessageID?: string
  Headers?: Array<{ Name: string; Value: string }>
}

interface ExtractedTaskData {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  dueDate: Date | null
  reminderDate: Date | null
  estimatedEffort: string
  businessImpact: string
  stakeholders: string[]
  projectTag: string | null
  dependencies: string[]
  tags?: {
    when?: string | null
    where?: string | null
    who?: string | null
    what?: string | null
    extras?: string[]
  }
}

/**
 * Creates multiple tasks from an email when AI extraction returns an array
 */
export async function createMultipleTasksFromEmail(
  tasksData: ExtractedTaskData[],
  emailData: EmailData,
  organization: any,
  emailLog: any,
  metadata: {
    emailCommand?: any
    threadId?: string | null
    toEmail: string
    senderEmail: string
    priorityAnalysis: any
    senderHistory: any
    threadContext: any
    bodyText: string
  }
): Promise<any[]> {
  const createdTasks = []
  const skippedDuplicates = []
  
  // Try to find the sender as a member, otherwise use admin/first member
  const creator = organization.members.find((m: any) => 
    m.user.email?.toLowerCase() === metadata.senderEmail.toLowerCase()
  ) || organization.members.find((m: any) => m.role === 'admin') || organization.members[0]
  
  // Get the user's timezone for proper date handling
  let userTimezone = 'America/New_York' // Default fallback
  if (creator?.userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: creator.userId },
        select: { timezone: true }
      })
      if (user?.timezone) {
        userTimezone = user.timezone
      }
    } catch (e) {
      console.log('Could not fetch user timezone, using default')
    }
  }

  // Extract task relationships once for all tasks (they share the same email context)
  console.log('🤖 Extracting task relationships...')
  const relationships = await extractTaskRelationships(
    {
      from: emailData.From,
      to: metadata.toEmail,
      subject: emailData.Subject,
      body: emailData.TextBody || emailData.HtmlBody || '',
      timestamp: new Date(emailData.Date)
    },
    metadata.toEmail
  )
  console.log('🤖 Task relationships:', relationships)
  
  // Process task visibility once for all tasks (they share the same email context)
  const visibilityResult = await processTaskVisibility(
    {
      from: emailData.From,
      subject: emailData.Subject,
      body: emailData.TextBody || emailData.HtmlBody || '',
      aiRelationships: relationships // Pass AI's understanding
    },
    organization.id,
    creator?.userId || null
  )
  
  console.log('👁️ Task visibility:', {
    visibility: visibilityResult.visibility,
    assignedTo: visibilityResult.assignedToId,
    sharedWithCount: visibilityResult.sharedWith.length,
    unresolved: visibilityResult.unresolvedMentions
  })

  // Process each task
  for (let index = 0; index < tasksData.length; index++) {
    const taskData = tasksData[index]
    
    // Check monthly task limit
    const { canCreateTask, incrementMonthlyTaskCount } = await import('@/lib/monthly-limits')
    const limitCheck = await canCreateTask(organization.id)
    
    if (!limitCheck.canCreate) {
      console.log(`📧 Monthly task limit reached after creating ${index} of ${tasksData.length} tasks`)
      break
    }

    // Determine item type for each task
    let itemType = 'task'
    if (metadata.emailCommand?.hasCommand && metadata.emailCommand.commandType === 'remind') {
      itemType = 'reminder'
    } else if (taskData.tags?.what === 'newsletter' || taskData.tags?.what === 'article') {
      itemType = 'read-later'
    } else if (taskData.businessImpact === 'low' && taskData.estimatedEffort === 'quick') {
      itemType = 'note'
    }

    // Build task payload
    let extractedTask = {
      title: taskData.title,
      description: taskData.description,
      priority: itemType === 'read-later' ? 'low' : 
                itemType === 'note' ? 'low' :
                itemType === 'reminder' && metadata.emailCommand?.hasCommand ? 'medium' :
                taskData.priority,
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null
    }

    // If no dueDate but we have a when tag, try to parse it
    if (!extractedTask.dueDate && taskData.tags?.when) {
      try {
        const whenText = String(taskData.tags.when)
        // Try direct parsing
        const parsedDate = new Date(whenText)
        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2020) {
          extractedTask.dueDate = parsedDate
          console.log(`📧 Task ${index + 1}: Extracted dueDate from when tag:`, { 
            whenTag: whenText, 
            dueDate: parsedDate.toISOString() 
          })
        } else {
          // Try to extract date patterns
          const datePatterns = [
            // DD/MM/YYYY
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
            // Month DD, YYYY
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* (\d{1,2}),? (\d{4})/i,
            // DD Month YYYY or DD-Mon-YY
            /(\d{1,2})[\s-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s-](\d{2,4})/i
          ]
          
          for (const pattern of datePatterns) {
            const match = whenText.match(pattern)
            if (match) {
              const attemptedDate = new Date(match[0])
              if (!isNaN(attemptedDate.getTime()) && attemptedDate.getFullYear() > 2020) {
                extractedTask.dueDate = attemptedDate
                console.log(`📧 Task ${index + 1}: Extracted dueDate from pattern:`, { 
                  whenTag: whenText,
                  pattern: pattern.source, 
                  dueDate: attemptedDate.toISOString() 
                })
                break
              }
            }
          }
        }
      } catch (e) {
        console.log(`📧 Task ${index + 1}: Could not parse when tag as date:`, taskData.tags?.when, e)
      }
    }

    // Apply command parameters if this is the first task (commands usually apply to main task)
    if (index === 0 && metadata.emailCommand?.hasCommand && metadata.emailCommand.parameters) {
      if (metadata.emailCommand.parameters.priority) {
        extractedTask.priority = metadata.emailCommand.parameters.priority === 'urgent' ? 
          'high' : metadata.emailCommand.parameters.priority
      }
      if (metadata.emailCommand.parameters.dueDate) {
        try {
          const dueDate = typeof metadata.emailCommand.parameters.dueDate === 'string'
            ? new Date(metadata.emailCommand.parameters.dueDate)
            : metadata.emailCommand.parameters.dueDate
          extractedTask.dueDate = dueDate
        } catch {}
      }
    }

    // Prepare reminder date if specified (for first task only)
    let reminderDate: Date | null = null
    if (index === 0 && metadata.emailCommand?.commandType === 'remind' && 
        metadata.emailCommand.parameters?.reminderDate) {
      try {
        reminderDate = typeof metadata.emailCommand.parameters.reminderDate === 'string'
          ? new Date(metadata.emailCommand.parameters.reminderDate)
          : new Date(metadata.emailCommand.parameters.reminderDate)
      } catch {}
    }

    // Check for duplicate task before creating
    // Look for tasks created in the last hour with same title and due date
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const existingTask = await prisma.task.findFirst({
      where: {
        organizationId: organization.id,
        title: extractedTask.title,
        dueDate: extractedTask.dueDate,
        createdAt: {
          gte: oneHourAgo
        },
        // Only check non-completed tasks
        status: {
          not: 'done'
        }
      }
    })

    if (existingTask) {
      console.log(`📧 Duplicate task detected: "${extractedTask.title}" - skipping creation`)
      skippedDuplicates.push({
        title: extractedTask.title,
        existingTaskId: existingTask.id
      })
      continue // Skip creating this duplicate task
    }

    // DEBUG: Log what we're about to create
    console.log('📧 DEBUG: Creating task with relationships:', {
      title: extractedTask.title,
      assignedToEmail: relationships.assignedToEmail,
      assignedByEmail: relationships.assignedByEmail,
      taskType: relationships.taskType,
      userRole: relationships.userRole,
      from: emailData.From,
      createdVia: 'email'
    })
    
    // Create the task
    const task = await prisma.task.create({
      data: {
        organizationId: organization.id,
        title: extractedTask.title,
        description: extractedTask.description,
        priority: extractedTask.priority,
        dueDate: extractedTask.dueDate,
        reminderDate: reminderDate,
        createdById: creator?.userId || null,
        createdVia: 'email',
        emailThreadId: emailData.MessageID || metadata.threadId,
        // Visibility fields
        visibility: visibilityResult.visibility,
        assignedToId: visibilityResult.assignedToId,
        sharedWith: visibilityResult.sharedWith,
        // Legacy relationship fields (kept for backward compatibility)
        assignedToEmail: relationships.assignedToEmail,
        assignedByEmail: relationships.assignedByEmail,
        taskType: relationships.taskType,
        userRole: relationships.userRole,
        stakeholders: relationships.stakeholders,
        emailMetadata: JSON.parse(JSON.stringify({
          from: emailData.From,
          subject: emailData.Subject,
          messageId: emailData.MessageID,
          receivedAt: emailData.Date,
          itemType: itemType,
          taskIndex: index, // Track which task this was in the email
          totalTasks: tasksData.length,
          smartAnalysis: {
            priorityScore: metadata.priorityAnalysis.score,
            priorityReasoning: metadata.priorityAnalysis.reasoning,
            estimatedEffort: taskData.estimatedEffort,
            businessImpact: taskData.businessImpact,
            stakeholders: taskData.stakeholders,
            projectTag: taskData.projectTag,
            dependencies: taskData.dependencies,
            tags: taskData.tags || null,
            senderImportance: metadata.senderHistory.importanceScore,
            threadContext: metadata.threadContext
          },
          command: index === 0 ? metadata.emailCommand : null
        }))
      }
    })

    // If this is a reminder, create a TaskReminder record
    if (reminderDate) {
      await prisma.taskReminder.create({
        data: {
          taskId: task.id,
          reminderDate: reminderDate,
          recurring: metadata.emailCommand?.parameters?.recurring || null,
          metadata: {
            command: metadata.emailCommand?.originalCommand,
            source: 'email'
          }
        }
      })
    }

    // Update organization task count (both total and monthly)
    await incrementMonthlyTaskCount(organization.id)

    // Apply smart deadline analysis to the created task
    await applySmartDeadlines(
      task.id,
      {
        from: emailData.From,
        subject: emailData.Subject,
        body: metadata.bodyText,
        timestamp: new Date(emailData.Date)
      },
      metadata.threadContext,
      metadata.senderHistory
    )

    createdTasks.push(task)
  }

  // Update sender intelligence once for all tasks
  if (createdTasks.length > 0) {
    await updateSenderIntelligence(metadata.senderEmail, organization.id, {
      taskCreated: true,
      priority: createdTasks[0].priority, // Use priority of first task
      userResponseTime: null,
      taskCompleted: false,
      taskCompletionTime: null
    })

    // Update email log with the first task ID and duplicate info
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { 
        processed: true,
        taskId: createdTasks[0].id,
        rawData: {
          ...(emailData as any),
          multipleTasksCreated: createdTasks.length,
          taskIds: createdTasks.map(t => t.id),
          duplicatesSkipped: skippedDuplicates.length,
          skippedDuplicateDetails: skippedDuplicates
        }
      }
    })
  }

  // Log summary
  if (skippedDuplicates.length > 0) {
    console.log(`📧 Multi-task creation summary: ${createdTasks.length} created, ${skippedDuplicates.length} duplicates skipped`)
  }

  return createdTasks
}