import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { 
  calculateSmartPriority, 
  analyzeEmailThread, 
  extractSmartTask, 
  getSenderHistory,
  updateSenderIntelligence 
} from '@/lib/smart-agent'
import { 
  analyzeDeadlineIntelligence, 
  applySmartDeadlines 
} from '@/lib/smart-deadlines'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface EmailData {
  From: string
  To: string
  Subject: string
  TextBody?: string
  HtmlBody?: string
  Date: string
  MessageID?: string
  Headers?: Array<{ Name: string; Value: string }>
  Cc?: string
  ReplyTo?: string
  OriginalRecipient?: string  // Added for Cloudflare Email Routing forwarding
}

interface ExtractedTask {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
}

interface EmailClassification {
  isActionable: boolean
  type: 'task' | 'reminder' | 'fyi' | 'question' | 'spam'
  confidence: number
  reason: string
  suggestedAction?: string
}

interface EmailCommand {
  hasCommand: boolean
  commandType?: 'remind' | 'schedule' | 'priority' | 'assign' | 'status' | 'custom'
  action?: string
  parameters?: {
    dueDate?: Date
    reminderDate?: Date
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    assignTo?: string
    status?: string
    notes?: string
    recurring?: string
  }
  originalCommand?: string
  confidence: number
}

// Extract clean email address from various formats like "Name <email@domain.com>"
function extractEmailAddress(fromString: string): string {
  const match = fromString.match(/<(.+?)>/)
  return (match ? match[1] : fromString).toLowerCase().trim()
}

// Get thread ID from headers
function getThreadId(emailData: EmailData): string | null {
  if (!emailData.Headers) return null
  
  // Look for In-Reply-To header
  const inReplyTo = emailData.Headers.find(h => h.Name.toLowerCase() === 'in-reply-to')
  if (inReplyTo) return inReplyTo.Value
  
  // Look for References header (last reference is usually the original)
  const references = emailData.Headers.find(h => h.Name.toLowerCase() === 'references')
  if (references) {
    const refs = references.Value.split(/\s+/)
    return refs[0] || null
  }
  
  return null
}

// Extract command from email body (especially forwarded emails)
function extractCommandFromEmail(body: string): { command: string | null, forwardedContent: string } {
  // Common forward markers
  const forwardMarkers = [
    '---------- Forwarded message',
    '-------- Original Message',
    '-----Original Message-----',
    'Begin forwarded message:',
    'From:', // Sometimes emails just start with From:
    '>>> On', // Reply/forward indicator
  ]
  
  // Find the earliest forward marker
  let forwardIndex = body.length
  let markerFound = false
  
  for (const marker of forwardMarkers) {
    const index = body.indexOf(marker)
    if (index !== -1 && index < forwardIndex) {
      forwardIndex = index
      markerFound = true
    }
  }
  
  if (markerFound) {
    // Extract command (text before the forward)
    const command = body.substring(0, forwardIndex).trim()
    const forwardedContent = body.substring(forwardIndex)
    
    // Only consider it a command if there's actual text before the forward
    if (command && command.length > 0 && command.length < 500) {
      return { command, forwardedContent }
    }
  }
  
  // Check if entire email looks like a direct command (short and directive)
  if (body.length < 200 && !body.includes('http')) {
    return { command: body.trim(), forwardedContent: '' }
  }
  
  return { command: null, forwardedContent: body }
}

export async function processInboundEmail(emailData: EmailData) {
  // Log the incoming email data for debugging
  console.log('Processing inbound email:', {
    To: emailData.To,
    OriginalRecipient: emailData.OriginalRecipient,
    From: emailData.From,
    Subject: emailData.Subject
  })
  
  // Extract the original recipient (not the Postmark forwarding address)
  // With Cloudflare Email Routing → Postmark, the To field contains the real recipient
  // and OriginalRecipient contains Postmark's internal address
  const originalRecipient = emailData.To.includes('@everling.io') ? emailData.To : 
                           emailData.OriginalRecipient || emailData.To
  const toEmail = originalRecipient.toLowerCase()
  const emailPrefix = toEmail.split('@')[0]
  const senderEmail = extractEmailAddress(emailData.From)
  
  console.log('Extracted email details:', {
    originalRecipient,
    toEmail,
    emailPrefix,
    senderEmail
  })
  const threadId = getThreadId(emailData)
  // Prefer strict reply detection via In-Reply-To only
  const inReplyToHeader = emailData.Headers?.find(h => h.Name.toLowerCase() === 'in-reply-to')
  const inReplyTo = inReplyToHeader?.Value || null
  const subjectLower = (emailData.Subject || '').trim().toLowerCase()
  const isForward = subjectLower.startsWith('fwd:') || subjectLower.startsWith('fw:')
  
  let emailLog: any
  
  try {
    // Find organization FIRST
    const organization = await prisma.organization.findUnique({
      where: { emailPrefix },
      include: {
        members: {
          include: {
            user: true
          }
        },
        allowedEmails: true
      }
    })

    if (!organization) {
      // Log the failed attempt (without organization ID since we don't have one)
      console.log(`Email rejected: No organization found for prefix: ${emailPrefix} (from: ${senderEmail})`)
      
      // Return a status indicating the email was rejected (not an error)
      return {
        status: 'rejected',
        reason: 'invalid_organization',
        message: `No organization found for email prefix: ${emailPrefix}`,
        emailPrefix,
        senderEmail
      }
    }

    // Check if sender is in allowed list
    const isAllowed = organization.allowedEmails.some(
      (allowed: { email: string }) => allowed.email === senderEmail
    )
    
    console.log('📧 Sender authorization check:', {
      senderEmail,
      isAllowed,
      allowedEmailsCount: organization.allowedEmails.length,
      allowedEmails: organization.allowedEmails.map((ae: { email: string }) => ae.email)
    })
    
    console.log('📧 Proceeding with email processing - sender is authorized')
    
    console.log('📧 Step 1: Checking for existing thread...')
    
    // Check if this is part of an existing thread
    let isThreadReply = false
    if (threadId && !isAllowed) {
      // Check if the thread has any emails from allowed senders
      const threadEmails = await prisma.emailLog.findFirst({
        where: {
          organizationId: organization.id,
          OR: [
            { messageId: threadId },
            { threadId: threadId }
          ],
          senderAllowed: true
        }
      })
      isThreadReply = !!threadEmails
    }

    // Now create the email log with the correct organizationId
    emailLog = await prisma.emailLog.create({
      data: {
        fromEmail: emailData.From,
        toEmail: emailData.To,
        subject: emailData.Subject,
        rawData: emailData as any,
        processed: false,
        organizationId: organization.id,
        messageId: emailData.MessageID || null,
        threadId: threadId,
        inReplyTo: threadId,
        senderAllowed: isAllowed || isThreadReply,
      }
    })

    // Check if sender is allowed before creating task
    if (!isAllowed && !isThreadReply) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { 
          processed: true,
          error: `Sender not in allowed list: ${senderEmail}`
        }
      })
      
      console.log(`Email rejected: Sender not in allowed list: ${senderEmail} for org: ${organization.name}`)
      
      return {
        status: 'rejected',
        reason: 'unauthorized_sender',
        message: `Sender not in allowed list: ${senderEmail}`,
        organizationId: organization.id,
        senderEmail
      }
    }
    
    console.log('📧 Step 2: Authorization passed, proceeding to task processing...')

    console.log('📧 Step 3: Looking for existing tasks in thread...')

    // Check if this is a reply to an existing thread with a task
    let existingTask = null
    try {
      console.log('📧 Step 3a: Reply detection check:', { inReplyTo, hasInReplyTo: !!inReplyTo, isForward })

      // First, check if we've already processed this exact MessageID
      if (emailData.MessageID) {
        const duplicateEmail = await prisma.emailLog.findFirst({
          where: {
            organizationId: organization.id,
            messageId: emailData.MessageID,
            taskId: { not: null }
          },
          include: {
            task: true
          }
        })

        if (duplicateEmail?.task) {
          console.log('📧 Duplicate email detected - task already exists for this MessageID')
          await prisma.emailLog.update({
            where: { id: emailLog.id },
            data: { 
              processed: true,
              taskId: duplicateEmail.task.id,
              emailMetadata: {
                duplicate: true,
                originalTaskId: duplicateEmail.task.id,
                reason: 'Exact MessageID match'
              } as any
            }
          })
          
          return {
            success: true,
            message: 'Duplicate email - task already exists',
            taskId: duplicateEmail.task.id,
            duplicate: true
          }
        }
      }

      // Check for recent similar tasks (same subject + sender within last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recentSimilarTask = await prisma.task.findFirst({
        where: {
          organizationId: organization.id,
          title: emailData.Subject,
          createdAt: { gte: oneHourAgo },
          createdVia: 'email',
          emailMetadata: {
            path: ['from'],
            equals: emailData.From
          }
        }
      })

      if (recentSimilarTask) {
        console.log('📧 Similar task detected - likely duplicate email')
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: { 
            processed: true,
            taskId: recentSimilarTask.id,
            emailMetadata: {
              duplicate: true,
              originalTaskId: recentSimilarTask.id,
              reason: 'Similar task created recently (same subject/sender)'
            } as any
          }
        })
        
        return {
          success: true,
          message: 'Similar task already exists',
          taskId: recentSimilarTask.id,
          duplicate: true
        }
      }

      // Treat as reply ONLY if In-Reply-To is present and the subject does not indicate a forward
      if (inReplyTo && !isForward) {
        console.log('📧 Step 3b: Searching for existing task by In-Reply-To...')

        // Find if any email in this thread already created a task
        const existingEmailWithTask = await prisma.emailLog.findFirst({
          where: {
            organizationId: organization.id,
            messageId: inReplyTo,
            taskId: { not: null }
          },
          include: {
            task: true
          }
        })

        if (existingEmailWithTask?.task) {
          existingTask = existingEmailWithTask.task
        }
      }
    } catch (threadError) {
      console.error('📧 Error in thread checking:', threadError)
    }

    // If this is a reply to an existing task, add it as an activity
    if (existingTask) {
      // Extract and parse any command in the reply
      const replyText = emailData.TextBody || emailData.HtmlBody || ''
      const { command: replyCommand } = extractCommandFromEmail(replyText)
      let replyEmailCommand: EmailCommand | null = null
      
      if (replyCommand) {
        replyEmailCommand = await parseEmailCommand(replyCommand, existingTask.title)
      }
      
      // Update the email log with the task ID
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { 
          processed: true,
          taskId: existingTask.id,
          rawData: {
            ...(emailData as any),
            command: replyEmailCommand
          }
        }
      })

      // Apply command updates to the task
      let updateData: any = {}
      let activityMessages: string[] = []
      
      if (replyEmailCommand?.hasCommand && replyEmailCommand.confidence > 0.6) {
        const params = replyEmailCommand.parameters
        
        // Status updates
        if (replyEmailCommand.commandType === 'status' && params?.status) {
          const statusMap: { [key: string]: string } = {
            'done': 'done',
            'completed': 'done',
            'finished': 'done',
            'in progress': 'in_progress',
            'working': 'in_progress',
            'hold': 'todo',
            'paused': 'todo',
            'cancelled': 'archived'
          }
          const newStatus = statusMap[params.status.toLowerCase()] || params.status
          if (newStatus !== existingTask.status) {
            updateData.status = newStatus
            activityMessages.push(`Status changed to ${newStatus}`)
          }
        }
        
        // Priority updates
        if (params?.priority && params.priority !== existingTask.priority) {
          updateData.priority = params.priority === 'urgent' ? 'high' : params.priority
          activityMessages.push(`Priority changed to ${updateData.priority}`)
        }
        
        // Due date updates
        if (params?.dueDate) {
          const dueDate = typeof params.dueDate === 'string' 
            ? new Date(params.dueDate)
            : params.dueDate
          updateData.dueDate = dueDate
          activityMessages.push(`Due date updated to ${dueDate.toLocaleDateString()}`)
        }
        
        // Reminder updates
        if (replyEmailCommand.commandType === 'remind' && params?.reminderDate) {
          const reminderDate = typeof params.reminderDate === 'string'
            ? new Date(params.reminderDate)
            : params.reminderDate
            
          await prisma.taskActivity.create({
            data: {
              taskId: existingTask.id,
              type: 'comment',
              content: `⏰ Reminder updated to ${reminderDate.toLocaleString()}`,
              metadata: {
                type: 'reminder',
                reminderDate: reminderDate.toISOString(),
                command: replyEmailCommand.originalCommand
              }
            }
          })
          activityMessages.push(`Reminder set for ${reminderDate.toLocaleString()}`)
        }
      } else {
        // No command, check for simple status keywords
        const bodyLower = replyText.toLowerCase()
        if (bodyLower.includes('done') || bodyLower.includes('completed') || bodyLower.includes('finished')) {
          if (existingTask.status !== 'done') {
            updateData.status = 'done'
            activityMessages.push('Status changed to done')
          }
        } else if (bodyLower.includes('in progress') || bodyLower.includes('working on')) {
          if (existingTask.status !== 'in_progress') {
            updateData.status = 'in_progress'
            activityMessages.push('Status changed to in progress')
          }
        }
      }
      
      // Apply updates if any
      if (Object.keys(updateData).length > 0) {
        await prisma.task.update({
          where: { id: existingTask.id },
          data: updateData
        })
      }
      
      // Create activity for the reply
      await prisma.taskActivity.create({
        data: {
          taskId: existingTask.id,
          type: 'reply_email',
          content: replyEmailCommand?.originalCommand || replyText.substring(0, 500),
          emailLogId: emailLog.id,
          metadata: {
            from: emailData.From,
            subject: emailData.Subject,
            date: emailData.Date,
            command: replyEmailCommand ? JSON.parse(JSON.stringify(replyEmailCommand)) : null,
            updates: activityMessages
          }
        }
      })

      return {
        success: true,
        taskId: existingTask.id,
        isReply: true,
        message: activityMessages.length > 0 
          ? `Task updated: ${activityMessages.join(', ')}`
          : `Reply added to existing task: ${existingTask.title}`,
        updates: activityMessages
      }
    }

    console.log('📧 Step 4: Getting sender history for smart analysis...')
    
    try {
      // Get sender history for smart analysis
      const senderHistory = await getSenderHistory(senderEmail, organization.id)
    
    console.log('📧 Step 5: Analyzing thread context...')
    
    // Analyze thread context if this is part of a thread
    let threadContext = null
    if (threadId) {
      threadContext = await analyzeEmailThread(threadId, organization.id)
    }

    console.log('📧 Step 6: Calculating smart priority using AI...')

    // Calculate smart priority using AI
    const priorityAnalysis = await calculateSmartPriority(
      {
        from: emailData.From,
        subject: emailData.Subject,
        body: emailData.TextBody || emailData.HtmlBody || '',
        timestamp: new Date(emailData.Date)
      },
      senderHistory,
      {
        id: organization.id,
        businessDomain: organization.name,
        teamSize: organization.members?.length || 1
      }
    )

    // Extract any command from the email
    const bodyText = emailData.TextBody || emailData.HtmlBody || ''
    const { command, forwardedContent } = extractCommandFromEmail(bodyText)
    
    // Parse command if found
    let emailCommand: EmailCommand | null = null
    if (command) {
      emailCommand = await parseEmailCommand(command, forwardedContent || emailData.Subject)
    }

    // Use smart task extraction instead of basic classification
    const safeScore = Number(priorityAnalysis?.score) || 50
    console.log('📧 Calling AI task extraction with data:', {
      from: emailData.From,
      subject: emailData.Subject,
      bodyLength: (forwardedContent || bodyText)?.length || 0,
      hasThreadContext: !!threadContext,
      priorityScore: safeScore
    })
    
    const smartTask = await extractSmartTask(
      {
        from: emailData.From,
        subject: emailData.Subject,
        body: forwardedContent || bodyText,
        timestamp: new Date(emailData.Date)
      },
      threadContext,
      priorityAnalysis
    )
    
    console.log('📧 AI task extraction result:', smartTask ? 'SUCCESS' : 'FAILED')

    // Determine if this should create a task based on AI analysis
    const score = safeScore
    const shouldCreateTask = score > 20 && // Minimum threshold
      (smartTask.businessImpact !== 'low' || smartTask.estimatedEffort !== 'quick')
      
    console.log('📧 Step 7: Should create task?', shouldCreateTask, 'Priority score:', score)
    
    // Store classification and command in email log while variables are in scope
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { 
        rawData: {
          ...(emailData as any),
          smartAnalysis: {
            priorityScore: score,
            reasoning: priorityAnalysis?.reasoning || 'N/A',
            threadContext: threadContext
          },
          command: emailCommand
        }
      }
    })

    // If AI determines email is not actionable, just log it and exit early
    if (!shouldCreateTask) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { 
          processed: true,
          error: null,
          rawData: {
            ...(emailData as any),
            smartAnalysis: {
              priorityScore: score,
              reasoning: priorityAnalysis?.reasoning || 'N/A',
              shouldCreateTask: false,
              threadContext: threadContext
            }
          }
        }
      })

      await updateSenderIntelligence(senderEmail, organization.id, {
        taskCreated: false,
        priority: 'low',
        userResponseTime: null,
        taskCompleted: false,
        taskCompletionTime: null
      })

      return {
        success: true,
        taskId: null,
        isActionable: false,
        classification: { isActionable: false, type: 'fyi', confidence: score / 100 },
        message: `Email logged but no task created (Priority: ${score}/100 - ${priorityAnalysis?.reasoning || 'N/A'})`
      }
    }

    // Build task payload from AI result
    let extractedTask = {
      title: smartTask.title,
      description: smartTask.description,
      priority: smartTask.priority,
      dueDate: smartTask.dueDate ? new Date(smartTask.dueDate) : null
    }

    // Apply command parameters if available
    if (emailCommand?.hasCommand && emailCommand.parameters) {
      if (emailCommand.parameters.priority) {
        extractedTask.priority = emailCommand.parameters.priority === 'urgent' ? 'high' : emailCommand.parameters.priority
      }
      if (emailCommand.parameters.dueDate) {
        try {
          const dueDate = typeof emailCommand.parameters.dueDate === 'string'
            ? new Date(emailCommand.parameters.dueDate)
            : emailCommand.parameters.dueDate
          extractedTask.dueDate = dueDate
        } catch {}
      }
    }

    // Create new task with smart metadata and thread tracking (inside main try)
    /* DUPLICATE BLOCK COMMENTED OUT: Check task limit only when creating new tasks */
    if (organization.tasksCreated >= organization.taskLimit) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { 
          processed: true,
          error: 'Organization has reached task limit'
        }
      })
      throw new Error('Organization has reached task limit')
    }

    // Use smart task extraction result to prepare payload (already defined above)

    // Apply command parameters if available
    if (emailCommand?.hasCommand && emailCommand.parameters) {
      // Override priority if specified in command
      if (emailCommand.parameters.priority) {
        extractedTask.priority = emailCommand.parameters.priority === 'urgent' ? 'high' : emailCommand.parameters.priority
      }
      // Use command due date if specified
      if (emailCommand.parameters.dueDate) {
        try {
          const dueDate = typeof emailCommand.parameters.dueDate === 'string' 
            ? new Date(emailCommand.parameters.dueDate)
            : emailCommand.parameters.dueDate
          extractedTask.dueDate = dueDate
        } catch {}
      } else if (emailCommand.parameters.reminderDate) {
        // Use reminder date as due date if no explicit due date
        try {
          const reminderDateTmp = typeof emailCommand.parameters.reminderDate === 'string'
            ? new Date(emailCommand.parameters.reminderDate)
            : emailCommand.parameters.reminderDate
          extractedTask.dueDate = reminderDateTmp
        } catch {}
      }
      // Add command notes to description
      if (emailCommand.parameters.notes) {
        extractedTask.description = `${extractedTask.description}\n\n📝 Note: ${emailCommand.parameters.notes}`
      }
      // Add original command to description for context
      if (emailCommand.originalCommand) {
        extractedTask.description = `${extractedTask.description}\n\n💬 Command: "${emailCommand.originalCommand}"`
      }
    }

    // Get the first admin or member to assign as creator
    const creator = organization.members.find((m: any) => m.role === 'admin') || organization.members[0]

    // Prepare reminder date if specified
    let reminderDate: Date | null = null
    if (emailCommand?.commandType === 'remind' && emailCommand.parameters?.reminderDate) {
      try {
        reminderDate = typeof emailCommand.parameters.reminderDate === 'string'
          ? new Date(emailCommand.parameters.reminderDate)
          : new Date(emailCommand.parameters.reminderDate)
      } catch {}
    }

    const task = await prisma.task.create({
      data: {
        organizationId: organization.id,
        title: extractedTask.title,
        description: extractedTask.description,
        priority: extractedTask.priority,
        dueDate: extractedTask.dueDate ? new Date(extractedTask.dueDate!) : null,
        reminderDate: reminderDate, // Store reminder date on task
        createdById: creator?.userId || null,
        createdVia: 'email',
        emailThreadId: emailData.MessageID || threadId, // Store thread ID for future replies
        emailMetadata: JSON.parse(JSON.stringify({
          from: emailData.From,
          subject: emailData.Subject,
          messageId: emailData.MessageID,
          receivedAt: emailData.Date,
          smartAnalysis: {
            priorityScore: priorityAnalysis.score,
            priorityReasoning: priorityAnalysis.reasoning,
            estimatedEffort: smartTask.estimatedEffort,
            businessImpact: smartTask.businessImpact,
            stakeholders: smartTask.stakeholders,
            projectTag: smartTask.projectTag,
            dependencies: smartTask.dependencies,
            tags: smartTask.tags || null,
            senderImportance: senderHistory.importanceScore,
            threadContext: threadContext
          },
          command: emailCommand
        }))
      }
    })

    // If this is a reminder, create a TaskReminder record
    if (reminderDate) {
      await prisma.taskReminder.create({
        data: {
          taskId: task.id,
          reminderDate: reminderDate,
          recurring: emailCommand?.parameters?.recurring || null,
          metadata: {
            command: emailCommand?.originalCommand,
            source: 'email'
          }
        }
      })
      // Also create an activity for tracking
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          type: 'comment',
          content: `⏰ Reminder set for ${reminderDate.toLocaleString()}${emailCommand?.parameters?.recurring ? ` (${emailCommand.parameters.recurring})` : ''}`,
          metadata: {
            type: 'reminder',
            reminderDate: reminderDate.toISOString(),
            recurring: emailCommand?.parameters?.recurring
          }
        }
      })
    }

    // Update organization task count
    await prisma.organization.update({
      where: { id: organization.id },
      data: { tasksCreated: { increment: 1 } }
    })

    // Apply smart deadline analysis to the created task
    await applySmartDeadlines(
      task.id,
      {
        from: emailData.From,
        subject: emailData.Subject,
        body: bodyText,
        timestamp: new Date(emailData.Date)
      },
      threadContext,
      senderHistory
    )

    // Update sender intelligence with task creation
    await updateSenderIntelligence(senderEmail, organization.id, {
      taskCreated: true,
      priority: extractedTask.priority,
      userResponseTime: null, // Will be updated when user responds
      taskCompleted: false,
      taskCompletionTime: null
    })

    // Update email log
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { 
        processed: true,
        taskId: task.id
      }
    })

    return task

    } catch (aiError) {
      console.error('📧 Error in AI processing:', aiError)
      
      // Fallback: create a simple task without AI
      console.log('📧 Falling back to simple task creation...')
      
      const fallbackTask = {
        title: emailData.Subject,
        description: `Email from ${senderEmail}\n\n${emailData.TextBody || emailData.HtmlBody || ''}`,
        priority: 'medium' as const,
        dueDate: null,
        reminderDate: null,
        estimatedEffort: 'medium',
        businessImpact: 'medium',
        stakeholders: [senderEmail],
        projectTag: null,
        dependencies: []
      }
      
      return await createTaskFromEmail(fallbackTask, emailData, organization, emailLog)
    }

    // duplicate block removed
  } catch (error) {
    // Only update email log if it exists (it won't exist if org wasn't found)
    if (typeof emailLog !== 'undefined') {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { 
          processed: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
    
    throw error
  }
}

// Helper: create a Task from AI-extracted (or fallback) data and link the email log
async function createTaskFromEmail(
  extractedTask: {
    title: string
    description: string
    priority: 'low' | 'medium' | 'high'
    dueDate: Date | null
  },
  emailData: EmailData,
  organization: { id: string },
  emailLog: { id: string }
) {
  // Compute a thread id from headers if present
  const thread = getThreadId(emailData) || emailData.MessageID || null

  // Create the task
  const task = await prisma.task.create({
    data: {
      organizationId: organization.id,
      title: extractedTask.title,
      description: extractedTask.description,
      priority: extractedTask.priority,
      dueDate: extractedTask.dueDate,
      createdVia: 'email',
      emailMetadata: JSON.parse(JSON.stringify({
        from: emailData.From,
        subject: emailData.Subject,
        date: emailData.Date
      })),
      emailThreadId: thread || undefined
    }
  })

  // Link the email log to the task and mark processed
  await prisma.emailLog.update({
    where: { id: emailLog.id },
    data: {
      processed: true,
      taskId: task.id
    }
  })

  return task
}

async function parseEmailCommand(command: string, context?: string): Promise<EmailCommand> {
  try {
    const now = new Date()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      system: `You are a command parser for an email task management system.
      Parse natural language commands and extract actionable parameters.
      
      Command types:
      - remind: Set reminders (e.g., "remind me in 3 days", "reminder for tomorrow")
      - schedule: Set due dates (e.g., "due Friday", "needs to be done by next week")
      - priority: Set priority (e.g., "urgent", "low priority", "can wait")
      - assign: Assign to someone (e.g., "assign to John", "for the dev team")
      - status: Change status (e.g., "mark as done", "on hold", "in progress")
      - custom: Other task modifications
      
      Parse dates/times:
      - Relative: "tomorrow", "in 3 days", "next Monday", "in 2 hours"
      - Specific: "Friday", "March 15", "3pm", "EOD"
      - Recurring: "every Monday", "weekly", "daily"
      
      Current date and time:
      - ISO: ${now.toISOString()}
      - Local: ${now.toLocaleString()}
      - Timezone: ${timezone}
      - Day of week: ${now.toLocaleDateString('en-US', { weekday: 'long' })}
      
      Return dates as ISO 8601 strings (e.g., "2025-09-14T14:00:00Z").
      For "tomorrow at 2pm", calculate from current time and return exact ISO string.
      For "in 3 days", add exactly 3 days to current timestamp.
      For "next Friday", find the next Friday from today.
      
      Respond with JSON only. Include confidence score (0-1).
      If no clear command is found, set hasCommand: false.`,
      messages: [{
        role: 'user',
        content: `Command: "${command}"${context ? `\n\nContext: ${context.substring(0, 500)}` : ''}`
      }],
      temperature: 0.2,
    })

    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as EmailCommand
        parsed.originalCommand = command
        return parsed
      }
    }

    return {
      hasCommand: false,
      confidence: 0,
      originalCommand: command
    }
  } catch (error) {
    console.error('Error parsing command:', error)
    return {
      hasCommand: false,
      confidence: 0,
      originalCommand: command
    }
  }
}

async function classifyEmail({ subject, body, from }: {
  subject: string
  body: string
  from: string
}): Promise<EmailClassification> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      system: `You are an email classifier. Analyze emails and determine if they require action.
      
      Classify emails into these types:
      - task: Requires action (requests, assignments, todos)
      - reminder: Time-sensitive notification
      - fyi: Informational only (newsletters, confirmations, receipts)
      - question: Asking for information (may or may not need task)
      - spam: Marketing, promotional, irrelevant
      
      Be strict: Only mark as "task" if there's a clear action item.
      
      Examples of NON-actionable (FYI):
      - "Your order has been shipped"
      - "Thanks for your email"
      - "Meeting notes attached"
      - "FYI - server maintenance tonight"
      - Newsletter content
      - Automated notifications
      
      Examples of ACTIONABLE (task):
      - "Can you review this document?"
      - "Please fix the login bug"
      - "Need this by Friday"
      - "Action required: approve budget"
      
      Respond with JSON only.`,
      messages: [{
        role: 'user',
        content: `From: ${from}\nSubject: ${subject}\n\nBody:\n${body.substring(0, 1000)}`
      }],
      temperature: 0.3,
    })

    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const classification = JSON.parse(jsonMatch[0]) as EmailClassification
        return classification
      }
    }

    // Default to FYI if classification fails
    return {
      isActionable: false,
      type: 'fyi',
      confidence: 0.5,
      reason: 'Could not classify email',
    }
  } catch (error) {
    console.error('Error classifying email:', error)
    // Default to creating a task if AI fails (safer)
    return {
      isActionable: true,
      type: 'task',
      confidence: 0.3,
      reason: 'Classification failed, defaulting to task',
    }
  }
}

async function extractTaskFromEmail({ subject, body, from }: { 
  subject: string
  body: string 
  from: string
}): Promise<ExtractedTask> {
  const prompt = `You are a task extraction assistant. Extract actionable task information from the following email.

Email From: ${from}
Email Subject: ${subject}
Email Body: ${body}

Extract and return ONLY valid JSON in this exact format:
{
  "title": "Clear, actionable task title (max 100 characters)",
  "description": "Detailed task description with all relevant information from the email",
  "priority": "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD format or null if no date mentioned"
}

Rules:
- Title should be action-oriented and concise
- Description should include all relevant details from the email
- Set priority to "high" if words like urgent, ASAP, critical, important are used
- Set priority to "low" if words like eventually, when you can, no rush are used  
- Default priority is "medium"
- Extract specific dates mentioned and convert to YYYY-MM-DD format
- If relative dates are mentioned (tomorrow, next week), calculate from today
- Ignore email signatures and footers
- Focus on the actionable content

Return ONLY the JSON object, no additional text.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Invalid response from Claude')
    }

    // Parse the JSON response
    const parsed = JSON.parse(content.text) as ExtractedTask
    
    // Validate the response
    if (!parsed.title || !parsed.description || !parsed.priority) {
      throw new Error('Invalid task data extracted')
    }

    // Ensure title is not too long
    if (parsed.title.length > 100) {
      parsed.title = parsed.title.substring(0, 97) + '...'
    }

    return parsed
  } catch (error) {
    console.error('Error extracting task from email:', error)
    
    // Fallback to basic extraction
    return {
      title: subject.substring(0, 100),
      description: `From: ${from}\n\nSubject: ${subject}\n\n${body}`.substring(0, 1000),
      priority: 'medium',
      dueDate: null
    }
  }
}

