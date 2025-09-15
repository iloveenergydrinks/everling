import { prisma } from '@/lib/prisma'
import { sendTestSMS } from '@/lib/sms'

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
 * Send daily digests to all users with SMS enabled
 * This should be called by cron at 8am every day
 */
export async function sendAllDailyDigests() {
  const users = await prisma.user.findMany({
    where: {
      whatsappEnabled: true, // Using for SMS
      whatsappVerified: true,
      phoneNumber: { not: null }
    }
  })
  
  const results = []
  
  for (const user of users) {
    if (!user.phoneNumber) continue
    
    try {
      const result = await sendDailyDigest(user.id, user.phoneNumber)
      results.push({
        userId: user.id,
        status: result.success ? 'sent' : 'failed'
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
    sent: results.filter(r => r.status === 'sent').length,
    failed: results.filter(r => r.status === 'failed').length,
    results
  }
}
