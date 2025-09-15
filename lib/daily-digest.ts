import { prisma } from '@/lib/prisma'
import { sendTestSMS } from '@/lib/sms'
import { ServerClient } from 'postmark'

// Use the same Postmark client as the email system
const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN || '')

interface DailyTask {
  id: string
  title: string
  dueDate: Date | null
  reminderDate: Date | null
  priority: string
}

/**
 * Send daily digest SMS with all tasks for today
 */
export async function sendDailyDigest(userId: string, phoneNumber: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  // Get all tasks due today or with reminders today
  const tasks = await prisma.task.findMany({
    where: {
      createdById: userId,
      status: { not: 'done' },
      OR: [
        {
          dueDate: {
            gte: today,
            lt: tomorrow
          }
        },
        {
          reminderDate: {
            gte: today,
            lt: tomorrow
          }
        }
      ]
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
      { reminderDate: 'asc' }
    ]
  })
  
  if (tasks.length === 0) {
    // No tasks today - send motivational message
    const message = `Good morning! 🌅\nNo tasks scheduled for today.\nEnjoy your day!`
    return await sendSMS(phoneNumber, message)
  }
  
  // Build the digest message
  let message = `Good morning! Today's tasks:\n\n`
  
  tasks.slice(0, 5).forEach((task, index) => {
    const time = task.dueDate || task.reminderDate
    const timeStr = time ? formatTime(time) : ''
    const priority = task.priority === 'high' ? '⚡' : ''
    
    message += `${index + 1}. ${task.title}${timeStr ? ` (${timeStr})` : ''}${priority}\n`
  })
  
  if (tasks.length > 5) {
    message += `\n+${tasks.length - 5} more tasks`
  }
  
  message += `\n\nReply 1-${Math.min(tasks.length, 5)} to complete`
  
  // Store task IDs for reply handling
  await storeDigestTasks(userId, tasks.slice(0, 5).map(t => t.id))
  
  return await sendSMS(phoneNumber, message)
}

/**
 * Send SMS (wrapper for the actual SMS function)
 */
async function sendSMS(phoneNumber: string, message: string) {
  // Use the existing SMS infrastructure
  const twilio = require('twilio')
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  
  if (!accountSid || !authToken || !fromNumber) {
    console.log('[MOCK DIGEST]:', message)
    return { success: true, mock: true }
  }
  
  const client = twilio(accountSid, authToken)
  
  try {
    await client.messages.create({
      from: fromNumber,
      to: phoneNumber,
      body: message
    })
    return { success: true }
  } catch (error) {
    console.error('Daily digest error:', error)
    return { success: false, error }
  }
}

/**
 * Format time for display (minimalist - just hour)
 */
function formatTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  if (hours === 0 && minutes === 0) return ''
  
  const period = hours >= 12 ? 'pm' : 'am'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  
  if (minutes === 0) {
    return `${displayHours}${period}`
  }
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`
}

/**
 * Store digest task IDs for reply handling
 */
async function storeDigestTasks(userId: string, taskIds: string[]) {
  // In production, use Redis with TTL
  // For now, store in database or memory
  // This maps user replies (1,2,3) to actual task IDs
  const digest = {
    userId,
    taskIds,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
  
  // You could store this in a new Prisma model or Redis
  console.log('Digest tasks stored:', digest)
}

/**
 * Handle SMS reply to daily digest
 */
export async function handleDigestReply(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; reply?: string }> {
  // Find user by phone
  const user = await prisma.user.findFirst({
    where: { phoneNumber }
  })
  
  if (!user) {
    return { success: false }
  }
  
  // Parse reply (1, 2, 3, etc)
  const taskNumber = parseInt(message.trim())
  
  if (isNaN(taskNumber) || taskNumber < 1 || taskNumber > 5) {
    return {
      success: true,
      reply: 'Reply with a number (1-5) to mark a task complete'
    }
  }
  
  // Get today's tasks (same query as digest)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const tasks = await prisma.task.findMany({
    where: {
      createdById: user.id,
      status: { not: 'done' },
      OR: [
        { dueDate: { gte: today, lt: tomorrow } },
        { reminderDate: { gte: today, lt: tomorrow } }
      ]
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' }
    ]
  })
  
  if (taskNumber > tasks.length) {
    return {
      success: true,
      reply: `Task ${taskNumber} not found`
    }
  }
  
  // Mark task as done
  const task = tasks[taskNumber - 1]
  await prisma.task.update({
    where: { id: task.id },
    data: { status: 'done' }
  })
  
  return {
    success: true,
    reply: `✓ "${task.title}" completed!`
  }
}

/**
 * Send email digest with all tasks for today
 */
export async function sendEmailDigest(userId: string, email: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Get user's organization to use their agent email as sender
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organizations: {
        include: {
          organization: true
        }
      }
    }
  })
  
  const organization = user?.organizations[0]?.organization
  const fromEmail = organization ? 
    `${organization.emailPrefix}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}` :
    process.env.EMAIL_FROM || 'noreply@taskmanager.com'
  
  // Get all tasks due today or with reminders today
  const tasks = await prisma.task.findMany({
    where: {
      createdById: userId,
      status: { not: 'done' },
      OR: [
        {
          dueDate: {
            gte: today,
            lt: tomorrow
          }
        },
        {
          reminderDate: {
            gte: today,
            lt: tomorrow
          }
        }
      ]
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
      { reminderDate: 'asc' }
    ]
  })
  
  if (tasks.length === 0) {
    // Send a "no tasks" email
    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Good morning! ☀️</h2>
        <p style="color: #666; line-height: 1.6;">
          You have no tasks scheduled for today. Enjoy your day!
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          You're receiving this because you have email digests enabled. 
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: #0066cc;">Manage preferences</a>
        </p>
      </div>
    `
    
    // Send via Postmark using agent email
    try {
      if (!process.env.POSTMARK_SERVER_TOKEN) {
        console.log('[MOCK EMAIL] Would send digest to:', email)
        return { success: true, mock: true }
      }

      const result = await postmarkClient.sendEmail({
        From: fromEmail,
        To: email,
        Subject: 'Your tasks for today',
        HtmlBody: html,
        TextBody: html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        MessageStream: 'outbound'
      })

      console.log('Email digest sent successfully:', result.MessageID)
      return { success: true, messageId: result.MessageID }
    } catch (error: any) {
      console.error('Email digest error:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Build email HTML
  let tasksHtml = tasks.map((task, index) => {
    const time = task.dueDate || task.reminderDate
    const timeStr = time ? formatTime(time) : ''
    const priority = task.priority === 'high' ? 
      '<span style="color: #ef4444;">⚡ High Priority</span>' : ''
    
    return `
      <div style="padding: 15px; background: #f9f9f9; border-radius: 8px; margin-bottom: 10px;">
        <h3 style="margin: 0 0 8px 0; color: #333;">
          ${index + 1}. ${task.title} ${priority}
        </h3>
        ${task.description ? `<p style="margin: 0 0 8px 0; color: #666;">${task.description}</p>` : ''}
        ${timeStr ? `<p style="margin: 0; color: #999; font-size: 14px;">⏰ ${timeStr}</p>` : ''}
      </div>
    `
  }).join('')
  
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Your tasks for today 📋</h2>
      <p style="color: #666; margin-bottom: 30px;">
        You have ${tasks.length} task${tasks.length === 1 ? '' : 's'} scheduled for today:
      </p>
      ${tasksHtml}
      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
           style="display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px;">
          View in Dashboard
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        You're receiving this because you have email digests enabled. 
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: #0066cc;">Manage preferences</a>
      </p>
    </div>
  `
  
  // Send via Postmark using agent email
  try {
    if (!process.env.POSTMARK_SERVER_TOKEN) {
      console.log('[MOCK EMAIL] Would send digest to:', email)
      return { success: true, mock: true }
    }

    const result = await postmarkClient.sendEmail({
      From: fromEmail,
      To: email,
      Subject: `${tasks.length} task${tasks.length === 1 ? '' : 's'} for today`,
      HtmlBody: html,
      TextBody: html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      MessageStream: 'outbound'
    })

    console.log('Email digest sent successfully:', result.MessageID)
    return { success: true, messageId: result.MessageID }
  } catch (error: any) {
    console.error('Email digest error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send daily digests to all users based on their preferences and timezone
 * This should be called frequently (every hour) to catch all timezones
 */
export async function sendAllDailyDigests() {
  const currentHour = new Date().getUTCHours()
  
  // Find users whose digest time matches current hour in their timezone
  const users = await prisma.user.findMany({
    where: {
      notificationType: { not: 'none' },
      OR: [
        { emailDigestEnabled: true },
        { smsDigestEnabled: true }
      ]
    }
  })
  
  const results = []
  
  for (const user of users) {
    // Check if it's time to send digest for this user's timezone
    const userTime = getUserLocalTime(user.timezone || 'America/New_York')
    const [targetHour, targetMinute] = (user.digestTime || '08:00').split(':').map(Number)
    
    // Only send if it's within the hour window
    if (userTime.hour !== targetHour || userTime.minute >= 30) {
      continue // Not time for this user yet
    }
    
    // Check if we already sent today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // You might want to track sent digests in a separate table
    // For now, we'll send based on preferences
    
    try {
      const emailResult = { success: false }
      const smsResult = { success: false }
      
      // Send email digest if enabled
      if ((user.notificationType === 'email' || user.notificationType === 'both') && user.emailDigestEnabled) {
        const emailResponse = await sendEmailDigest(user.id, user.email)
        emailResult.success = emailResponse.success
      }
      
      // Send SMS digest if enabled
      if ((user.notificationType === 'sms' || user.notificationType === 'both') && 
          user.smsDigestEnabled && user.phoneNumber && user.whatsappVerified) {
        const smsResponse = await sendDailyDigest(user.id, user.phoneNumber)
        smsResult.success = smsResponse.success
      }
      
      results.push({
        userId: user.id,
        email: emailResult.success ? 'sent' : 'skipped',
        sms: smsResult.success ? 'sent' : 'skipped'
      })
    } catch (error) {
      results.push({
        userId: user.id,
        status: 'error',
        error
      })
    }
  }
  
  return {
    total: users.length,
    processed: results.length,
    results
  }
}

/**
 * Get user's current local time based on timezone
 */
function getUserLocalTime(timezone: string): { hour: number, minute: number } {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  })
  
  const parts = formatter.formatToParts(now)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  
  return { hour, minute }
}
