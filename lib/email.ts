import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { ServerClient } from 'postmark'
import { 
  calculateSmartPriority, 
  analyzeEmailThread, 
  extractSmartTask,
  extractTaskRelationships,
  getSenderHistory,
  updateSenderIntelligence 
} from '@/lib/smart-agent'
import { 
  analyzeDeadlineIntelligence, 
  applySmartDeadlines 
} from '@/lib/smart-deadlines'
import { createMultipleTasksFromEmail } from '@/lib/email-multi-task'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN || '')

// Generic email sending function
async function sendEmail({ to, subject, html, text }: {
  to: string
  subject: string
  html: string
  text?: string
}) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.log('[MOCK EMAIL] Would send to:', to)
    console.log('[MOCK EMAIL] Subject:', subject)
    return
  }

  try {
    const result = await postmarkClient.sendEmail({
      From: process.env.EMAIL_FROM || 'noreply@everling.io',
      To: to,
      Subject: subject,
      HtmlBody: html,
      TextBody: text || html.replace(/<[^>]*>/g, ''),
      MessageStream: 'outbound'
    })
    console.log('Email sent successfully:', result.MessageID)
    return result
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

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
  ToFull?: Array<{ Email: string; Name?: string }>  // Postmark's detailed recipient info
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

// Convert a date to midnight in user's timezone, then to UTC for storage
function setToMidnightInTimezone(date: Date, timezone: string): Date {
  try {
    // Format the date in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const parts = formatter.formatToParts(date)
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0')
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')
    
    // Create a date string at midnight in the target timezone
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`
    
    // Parse this as a local time in the target timezone
    const localDate = new Date(dateStr)
    
    // Get the timezone offset for this date
    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    })
    const targetParts = targetFormatter.formatToParts(localDate)
    const tzName = targetParts.find(p => p.type === 'timeZoneName')?.value || 'EST'
    
    // Return the date adjusted for storage
    return new Date(dateStr + ' ' + tzName)
  } catch (e) {
    console.error('Error setting date to midnight in timezone:', e)
    // Fallback: just set to start of day in local time
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }
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
      console.log('📧 Found forward marker:', marker, 'at index:', index)
    }
  }
  
  if (markerFound) {
    // Extract command (text before the forward)
    const command = body.substring(0, forwardIndex).trim()
    const forwardedContent = body.substring(forwardIndex)
    
    console.log('📧 Extracted command from forward:', {
      command: command?.substring(0, 100),
      commandLength: command?.length,
      hasForwardedContent: forwardedContent.length > 0
    })
    
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
  
  // Extract the original recipient from Postmark webhook data
  // When Cloudflare forwards to Postmark:
  // - To: contains the Postmark inbound address (xxx@inbound.postmarkapp.com)
  // - OriginalRecipient: ALSO contains the Postmark address (Cloudflare's forwarding target)
  // - The actual recipient must be extracted from email headers that Cloudflare preserves
  
  let originalRecipient = ''
  
  // First, check if the To field directly contains an everling.io address (common in direct webhooks)
  if (emailData.To && emailData.To.includes('@everling.io')) {
    originalRecipient = emailData.To
    console.log('Found recipient in To field:', originalRecipient)
  }
  
  // If not found, check ToFull array if it exists
  if (!originalRecipient && emailData.ToFull && Array.isArray(emailData.ToFull) && emailData.ToFull.length > 0) {
    const everlingRecipient = emailData.ToFull.find((r: any) => 
      r.Email && r.Email.includes('@everling.io')
    )
    if (everlingRecipient) {
      originalRecipient = everlingRecipient.Email
      console.log('Found recipient in ToFull:', originalRecipient)
    }
  }
  
  // If not found, check headers for original recipient
  if (!originalRecipient || !originalRecipient.includes('@everling.io')) {
    const headers = emailData.Headers || []
    // Check various headers that might contain the original address
    const headerNames = ['x-original-to', 'delivered-to', 'x-forwarded-to', 'envelope-to', 'to']
    
    for (const headerName of headerNames) {
      const header = headers.find((h: any) => h.Name.toLowerCase() === headerName)
      if (header?.Value?.includes('@everling.io')) {
        originalRecipient = header.Value
        console.log(`Found recipient in ${headerName} header:`, originalRecipient)
        break
      }
    }
  }
  
  // CRITICAL: If still no everling.io address found, we MUST extract from Cloudflare headers
  if (!originalRecipient || !originalRecipient.includes('@everling.io')) {
    // Cloudflare adds X-Forwarded-For headers but for email it's usually in these:
    const cfHeaders = ['x-cf-to', 'x-forwarded-for', 'x-real-to', 'cf-connecting-email']
    for (const headerName of cfHeaders) {
      const header = (emailData.Headers || []).find((h: any) => h.Name.toLowerCase() === headerName)
      if (header?.Value?.includes('@everling.io')) {
        originalRecipient = header.Value
        console.log(`Found recipient in Cloudflare ${headerName} header:`, originalRecipient)
        break
      }
    }
    
    // LAST RESORT: Parse from the email content itself
    if (!originalRecipient || !originalRecipient.includes('@everling.io')) {
      // Try to extract from the To header even if it doesn't have everling.io
      // (sometimes the To header shows the original before forwarding)
      const toHeader = (emailData.Headers || []).find((h: any) => h.Name.toLowerCase() === 'to')
      if (toHeader?.Value) {
        // Look for any everling.io address in the To header value
        const everlingMatch = toHeader.Value.match(/([a-zA-Z0-9._-]+@everling\.io)/)
        if (everlingMatch) {
          originalRecipient = everlingMatch[1]
          console.log('Extracted everling.io address from To header:', originalRecipient)
        }
      }
    }
    
    if (!originalRecipient || !originalRecipient.includes('@everling.io')) {
      // This is a critical error - we can't process without knowing the recipient
      console.error('🔴 CRITICAL: No everling.io recipient found!')
      console.error('Webhook data:', {
        To: emailData.To,
        OriginalRecipient: emailData.OriginalRecipient,
        ToFull: emailData.ToFull,
        AllHeaders: emailData.Headers?.map((h: any) => `${h.Name}: ${h.Value.substring(0, 100)}`)
      })
      
      // Return error response
      return {
        status: 'rejected',
        reason: 'no_recipient',
        message: 'Could not determine everling.io recipient address',
        debugInfo: {
          to: emailData.To,
          originalRecipient: emailData.OriginalRecipient
        }
      }
    }
  }
  
  // Extract clean email address (handles formats like "name@domain" <name@domain>)
  const toEmail = extractEmailAddress(originalRecipient).toLowerCase()
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
    
    // Create email log immediately to show processing status
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
        senderAllowed: false, // Will update after checking
      }
    })

    // Check if sender is in allowed list
    const isInAllowedList = organization.allowedEmails.some(
      (allowed: { email: string }) => allowed.email === senderEmail
    )
    
    // Check if sender is a member of the organization
    const isOrganizationMember = organization.members.some(
      (member: any) => member.user.email === senderEmail
    )
    
    // Sender is allowed if they're in the allowed list OR they're an organization member
    const isAllowed = isInAllowedList || isOrganizationMember
    
    console.log('📧 Sender authorization check:', {
      senderEmail,
      isInAllowedList,
      isOrganizationMember,
      isAllowed,
      allowedEmailsCount: organization.allowedEmails.length,
      allowedEmails: organization.allowedEmails.map((ae: { email: string }) => ae.email),
      organizationMembers: organization.members.map((m: any) => m.user.email)
    })
    
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

    // Update the email log with sender allowed status
    emailLog = await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        senderAllowed: isAllowed || isThreadReply,
      }
    })

    // Check if sender is allowed before creating task
    if (!isAllowed && !isThreadReply) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { 
          processed: true,
          error: `Sender not authorized: ${senderEmail} (not an organization member or in allowed list)`
        }
      })
      
      console.log(`📧 Email rejected: Sender ${senderEmail} is not authorized for org: ${organization.name}`)
      console.log(`📧 Sender is NOT an organization member and NOT in the allowed emails list`)
      console.log(`📧 To allow this sender, either:`)
      console.log(`   1. Add them as a member of the organization`)
      console.log(`   2. Add their email to the allowed emails list in Settings`)
      
      return {
        status: 'rejected',
        reason: 'unauthorized_sender',
        message: `Sender not authorized: ${senderEmail} (not an organization member or in allowed list)`,
        organizationId: organization.id,
        senderEmail
      }
    }
    
    console.log('📧 Step 2: Authorization passed (sender is allowed or replying to existing thread), proceeding to task processing...')

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
              rawData: {
                ...emailData,
                _metadata: {
                  duplicate: true,
                  originalTaskId: duplicateEmail.task.id,
                  reason: 'Exact MessageID match'
                }
              }
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
            rawData: {
              ...emailData,
              _metadata: {
                duplicate: true,
                originalTaskId: recentSimilarTask.id,
                reason: 'Similar task created recently (same subject/sender)'
              }
            }
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
    
    console.log('📧 Command extraction result:', {
      hasCommand: !!command,
      command: command?.substring(0, 100),
      bodyLength: bodyText.length,
      forwardedContentLength: forwardedContent?.length || 0
    })
    
    // Parse command if found
    let emailCommand: EmailCommand | null = null
    if (command) {
      console.log('📧 Parsing command with AI:', command)
      emailCommand = await parseEmailCommand(command, forwardedContent || emailData.Subject)
      console.log('📧 AI command parsing result:', emailCommand)
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

    // EVERY forwarded email creates something - the user forwarded it for a reason
    // The AI's job is to organize, not gatekeep
    const shouldCreateTask = true // Always create something when email is forwarded
    
    // Check if we have multiple tasks or a single task
    const isMultipleTasks = Array.isArray(smartTask)
    
    // Handle multiple tasks case
    if (isMultipleTasks) {
      console.log('📧 Multiple tasks detected:', { 
        count: smartTask.length,
        titles: smartTask.map(t => t.title),
        reason: 'Email contains multiple distinct action items'
      })
      
      // Create multiple tasks using the dedicated handler
      const createdTasks = await createMultipleTasksFromEmail(
        smartTask,
        emailData,
        organization,
        emailLog,
        {
          emailCommand,
          threadId,
          toEmail,
          senderEmail,
          priorityAnalysis,
          senderHistory,
          threadContext,
          bodyText
        }
      )
      
      return {
        success: true,
        taskIds: createdTasks.map(t => t.id),
        taskId: createdTasks[0]?.id || null, // For backwards compatibility
        message: `Created ${createdTasks.length} tasks from email`,
        tasks: createdTasks
      }
    }
    
    // Single task case - continue with existing logic
    console.log('📧 Single task to process:', { 
      title: smartTask.title,
      priority: safeScore, 
      hasCommand: !!emailCommand?.hasCommand,
      reason: 'User forwarded this email intentionally'
    })
    
    // Store classification and command in email log while variables are in scope
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { 
        rawData: {
          ...(emailData as any),
          smartAnalysis: {
            priorityScore: safeScore,
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
              priorityScore: safeScore,
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
        classification: { isActionable: false, type: 'fyi', confidence: safeScore / 100 },
        message: `Email logged but no task created (Priority: ${safeScore}/100 - ${priorityAnalysis?.reasoning || 'N/A'})`
      }
    }
    
    // Determine item type for single task
    let itemType = 'task' // Default for now
    if (emailCommand?.hasCommand && emailCommand.commandType === 'remind') {
      itemType = 'reminder'
    } else if (smartTask.tags?.what === 'newsletter' || smartTask.tags?.what === 'article') {
      itemType = 'read-later'
    } else if (smartTask.businessImpact === 'low' && smartTask.estimatedEffort === 'quick') {
      itemType = 'note'
    }
    
    // Build task payload from AI result
    let extractedTask = {
      title: smartTask.title,
      description: smartTask.description,
      // Adjust priority based on item type (temporary until we have proper categorization)
      priority: itemType === 'read-later' ? 'low' : 
                itemType === 'note' ? 'low' :
                itemType === 'reminder' && emailCommand?.hasCommand ? 'medium' :
                smartTask.priority,
      dueDate: smartTask.dueDate ? new Date(smartTask.dueDate) : null
    }
    
    
    // If no dueDate but we have a when tag, try to parse it
    if (!extractedTask.dueDate && smartTask.tags?.when) {
      try {
        const whenText = String(smartTask.tags.when)
        // Try direct parsing
        const parsedDate = new Date(whenText)
        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2020) {
          extractedTask.dueDate = parsedDate
          console.log('📧 Extracted dueDate from when tag:', { 
            whenTag: whenText, 
            dueDate: parsedDate.toISOString() 
          })
        } else {
          // Try to extract date patterns like "18/09/2025" or "Sep 18, 2025"
          const datePatterns = [
            // DD/MM/YYYY
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
            // Month DD, YYYY
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* (\d{1,2}),? (\d{4})/i,
            // Thu, Sep 18, 2025
            /\w+, (\w+) (\d{1,2}), (\d{4})/
          ]
          
          for (const pattern of datePatterns) {
            const match = whenText.match(pattern)
            if (match) {
              const attemptedDate = new Date(match[0])
              if (!isNaN(attemptedDate.getTime()) && attemptedDate.getFullYear() > 2020) {
                extractedTask.dueDate = attemptedDate
                console.log('📧 Extracted dueDate from when tag pattern:', { 
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
        console.log('📧 Could not parse when tag as date:', smartTask.tags?.when, e)
      }
    }

    // Apply command parameters if available
    console.log('📧 Applying command parameters to task:', {
      hasCommand: emailCommand?.hasCommand,
      commandType: emailCommand?.commandType,
      parameters: emailCommand?.parameters,
      originalCommand: emailCommand?.originalCommand
    })
    
    if (emailCommand?.hasCommand && emailCommand.parameters) {
      if (emailCommand.parameters.priority) {
        console.log('📧 Setting priority from command:', emailCommand.parameters.priority)
        extractedTask.priority = emailCommand.parameters.priority === 'urgent' ? 'high' : emailCommand.parameters.priority
      }
      if (emailCommand.parameters.dueDate) {
        try {
          const dueDate = typeof emailCommand.parameters.dueDate === 'string'
            ? new Date(emailCommand.parameters.dueDate)
            : emailCommand.parameters.dueDate
          console.log('📧 Setting due date from command:', dueDate)
          extractedTask.dueDate = dueDate
        } catch (e) {
          console.log('📧 Failed to parse due date:', emailCommand.parameters.dueDate, e)
        }
      }
    }

    // Check monthly task limit before creating new task
    const { canCreateTask, incrementMonthlyTaskCount } = await import('@/lib/monthly-limits')
    const limitCheck = await canCreateTask(organization.id)
    
    if (!limitCheck.canCreate) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { 
          processed: true,
          error: `Monthly task limit reached (${limitCheck.used}/${limitCheck.limit}). Resets ${limitCheck.resetsIn}`
        }
      })
      
      // Send a friendly email back to the user about the limit
      if (emailData.From && emailData.From !== 'noreply@postmarkapp.com') {
        try {
          await sendEmail({
            to: emailData.From,
            subject: 'Monthly Task Limit Reached - Upgrade to Continue',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Monthly Task Limit Reached</h2>
                <p>You've used all ${limitCheck.limit} tasks in your free plan this month.</p>
                <p>Your limit will reset ${limitCheck.resetsIn}.</p>
                <h3>Upgrade to Pro for:</h3>
                <ul>
                  <li>✅ Unlimited tasks</li>
                  <li>📱 SMS notifications</li>
                  <li>⚡ Priority support</li>
                  <li>🎯 Advanced AI features</li>
                </ul>
                <p><a href="${process.env.NEXTAUTH_URL}/dashboard/settings" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upgrade Now</a></p>
                <p style="color: #666; font-size: 12px;">Your task was not created due to the limit. Please upgrade or wait for the monthly reset.</p>
              </div>
            `,
            text: `Monthly task limit reached (${limitCheck.used}/${limitCheck.limit}). Upgrade to Pro for unlimited tasks. Resets ${limitCheck.resetsIn}.`
          })
        } catch (e) {
          console.error('Failed to send limit notification email:', e)
        }
      }
      
      throw new Error(`Monthly task limit reached (${limitCheck.used}/${limitCheck.limit})`)
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

    // Prepare reminder date if specified
    let reminderDate: Date | null = null
    if (emailCommand?.commandType === 'remind' && emailCommand.parameters?.reminderDate) {
      try {
        reminderDate = typeof emailCommand.parameters.reminderDate === 'string'
          ? new Date(emailCommand.parameters.reminderDate)
          : new Date(emailCommand.parameters.reminderDate)
      } catch {}
    }

    // Extract task relationships using AI
    console.log('🤖 Extracting task relationships...')
    const relationships = await extractTaskRelationships(
      {
        from: emailData.From,
        to: toEmail, // The everling.io recipient
        subject: emailData.Subject,
        body: emailData.TextBody || emailData.HtmlBody || '',
        timestamp: new Date(emailData.Date)
      },
      toEmail
    )
    console.log('🤖 Task relationships:', relationships)

    // Check for duplicate task before creating (single task)
    // Look for tasks created in the last hour with same title and due date
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const existingDuplicate = await prisma.task.findFirst({
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

    if (existingDuplicate) {
      console.log(`📧 Duplicate task detected: "${extractedTask.title}" - returning existing task`)
      
      // Update email log to reference the existing task
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { 
          processed: true,
          taskId: existingDuplicate.id,
          rawData: {
            ...(emailData as any),
            duplicateDetected: true,
            originalTaskId: existingDuplicate.id
          }
        }
      })

      return {
        success: true,
        taskId: existingDuplicate.id,
        message: `Duplicate task detected - returning existing task: ${existingDuplicate.title}`,
        isDuplicate: true
      }
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
        // Task relationship fields
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
          itemType: itemType, // Store the item type for UI to display appropriate icon
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

    // Update organization task count (both total and monthly)
    await incrementMonthlyTaskCount(organization.id)

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
      
      IMPORTANT: Handle multiple languages including Italian:
      - "Ricordami" / "remind me" = reminder command
      - "domani" / "tomorrow" = next day
      - "per domani" / "for tomorrow" = due/reminder tomorrow
      - "entro" / "by" = deadline
      
      Command types:
      - remind: Set reminders (e.g., "remind me in 3 days", "reminder for tomorrow", "ricordami domani")
      - schedule: Set due dates (e.g., "due Friday", "needs to be done by next week", "entro venerdì")
      - priority: Set priority (e.g., "urgent", "low priority", "can wait", "urgente")
      - assign: Assign to someone (e.g., "assign to John", "for the dev team")
      - status: Change status (e.g., "mark as done", "on hold", "in progress")
      - custom: Other task modifications
      
      Parse dates/times (including Italian):
      - Relative: "tomorrow", "domani", "in 3 days", "next Monday", "lunedì prossimo"
      - Specific: "Friday", "venerdì", "March 15", "15 marzo", "3pm", "ore 15"
      - Recurring: "every Monday", "ogni lunedì", "weekly", "settimanale"
      
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
      console.log('📧 AI command parser raw response:', content.text)
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as EmailCommand
        parsed.originalCommand = command
        console.log('📧 Parsed command JSON:', parsed)
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
      system: `You are a MULTILINGUAL email classifier. Analyze emails IN ANY LANGUAGE and determine if they require action.
      
      Classify emails into these types:
      - task: Requires action (requests, assignments, todos)
      - reminder: Time-sensitive notification
      - fyi: Informational only (newsletters, confirmations, receipts)
      - question: Asking for information (may or may not need task)
      - spam: Marketing, promotional, irrelevant
      
      Be strict: Only mark as "task" if there's a clear action item.
      
      NON-actionable (FYI) - MULTILINGUAL:
      English: "Your order has been shipped", "Thanks", "Meeting notes attached", "FYI"
      Italian: "Il tuo ordine è stato spedito", "Grazie", "Allego verbale", "Per conoscenza", "Vi informo"
      - Newsletter content
      - Automated notifications
      - Confirmations ("confermo ricezione")
      
      ACTIONABLE (task) - MULTILINGUAL:
      English: "Can you review?", "Please fix", "Need your help"
      Italian: "Puoi controllare?", "Per favore sistema", "Ho bisogno", "Ti chiedo di", "Cortesemente"
      - Requests with "entro" (by/deadline)
      - Assignments with "da fare", "completare"
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

