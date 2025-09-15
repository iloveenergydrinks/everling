import twilio from 'twilio'
import { prisma } from '@/lib/prisma'

// Check if we're in mock mode (for testing without real SMS)
const SMS_MODE = process.env.SMS_MODE || 'mock' // Default to mock for safety

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const smsNumber = process.env.TWILIO_PHONE_NUMBER // Must be a real SMS number, not WhatsApp

// Debug logging
console.log('SMS Configuration:', {
  mode: SMS_MODE,
  hasAccountSid: !!accountSid,
  hasAuthToken: !!authToken,
  phoneNumber: smsNumber,
  willUseTwilio: !!(accountSid && authToken && SMS_MODE === 'production')
})

const client = accountSid && authToken && SMS_MODE === 'production' ? twilio(accountSid, authToken) : null

interface Task {
  id: string
  title: string
  description: string | null
  dueDate: Date | null
  reminderDate: Date | null
  priority: string
  status: string
  createdById: string | null
}

interface User {
  id: string
  email: string
  phoneNumber: string | null
  whatsappEnabled: boolean // We'll use this for SMS enabled
  whatsappVerified: boolean // We'll use this for SMS verified
}

/**
 * Send SMS verification message
 */
export async function sendSMSVerification(phoneNumber: string, userId: string) {
  // Mock mode - simulate success without sending real SMS
  if (SMS_MODE === 'mock') {
    console.log(`[MOCK SMS] Would send verification to ${phoneNumber}`)
    return { 
      success: true, 
      message: 'Mock mode: SMS verification simulated (check console)', 
      mock: true 
    }
  }

  if (!client) {
    return { 
      success: false, 
      error: 'SMS not configured. Please set up Twilio credentials or use mock mode.' 
    }
  }

  if (!smsNumber) {
    return { 
      success: false, 
      error: 'No SMS phone number configured. Please add TWILIO_PHONE_NUMBER to your .env file.' 
    }
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
  
  try {
    // Send verification SMS
    await client.messages.create({
      from: smsNumber,
      to: phoneNumber,
      body: `TaskManager: Your verification code is ${verificationCode}. Reply with this code to enable SMS reminders.`
    })

    // Store verification code temporarily (in production, use Redis with TTL)
    // For now, we'll just mark as verified after sending
    // In production, you'd validate the code when they reply
    
    return { success: true, message: 'Verification code sent via SMS' }
  } catch (error: any) {
    console.error('SMS verification error:', error)
    
    // Provide helpful error messages based on Twilio error codes
    if (error.code === 21660) {
      return { 
        success: false, 
        error: 'Invalid SMS number. The number in TWILIO_PHONE_NUMBER must be a valid SMS-enabled Twilio number, not a WhatsApp number.' 
      }
    }
    
    return { success: false, error: error.message || 'Failed to send SMS. Check your Twilio configuration.' }
  }
}

/**
 * Send SMS reminder for a task
 */
export async function sendSMSReminder(task: Task, user: User) {
  if (!user.phoneNumber || !user.whatsappEnabled) { // Using whatsappEnabled for SMS
    return { success: false, error: 'SMS not enabled for user' }
  }

  const message = formatTaskReminder(task)
  
  // Mock mode - simulate success
  if (SMS_MODE === 'mock') {
    console.log(`[MOCK SMS] Would send to ${user.phoneNumber}:`)
    console.log(`[MOCK SMS] ${message}`)
    return { success: true, messageId: 'mock-' + Date.now(), mock: true }
  }

  if (!client || !smsNumber) {
    return { success: false, error: 'SMS not configured' }
  }
  
  try {
    const result = await client.messages.create({
      from: smsNumber,
      to: user.phoneNumber,
      body: message
    })

    // Log the reminder
    console.log(`SMS reminder sent to ${user.phoneNumber} for task ${task.id}`)
    
    return { success: true, messageId: result.sid }
  } catch (error) {
    console.error('SMS reminder error:', error)
    return { success: false, error: 'Failed to send reminder' }
  }
}

/**
 * Format task reminder message (shorter for SMS)
 */
function formatTaskReminder(task: Task): string {
  let message = `TaskManager Reminder:\n${task.title}`
  
  if (task.dueDate) {
    const now = new Date()
    const dueDate = new Date(task.dueDate)
    const hoursUntil = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
    
    if (hoursUntil < 0) {
      message += `\nOVERDUE ${Math.abs(hoursUntil)}h`
    } else if (hoursUntil < 24) {
      message += `\nDue in ${hoursUntil}h`
    }
  }
  
  if (task.priority === 'high') {
    message += `\nHIGH PRIORITY`
  }
  
  message += `\n\nReply: DONE, 1H (snooze), or TOM (tomorrow)`
  
  return message
}

/**
 * Handle incoming SMS reply
 */
export async function handleSMSReply(
  from: string, 
  body: string,
  userId?: string
) {
  // Clean phone number
  const phoneNumber = from.replace(/^\+/, '')
  
  // Find user by phone number
  const user = userId ? await prisma.user.findUnique({
    where: { id: userId }
  }) : await prisma.user.findFirst({
    where: { phoneNumber: from }
  })
  
  if (!user) {
    return { success: false, error: 'User not found' }
  }
  
  // Find the most recent task with a reminder for this user
  const recentTask = await prisma.task.findFirst({
    where: {
      createdById: user.id,
      reminderDate: { not: null },
      status: { not: 'done' }
    },
    orderBy: { reminderDate: 'desc' }
  })
  
  if (!recentTask) {
    return { 
      success: false, 
      error: 'No active tasks with reminders found',
      reply: "No active tasks. Forward an email to create one!"
    }
  }
  
  const command = body.toUpperCase().trim()
  
  // Handle commands
  if (command === 'DONE' || command === 'COMPLETE' || command === 'D') {
    await prisma.task.update({
      where: { id: recentTask.id },
      data: { status: 'done' }
    })
    
    return { 
      success: true, 
      action: 'completed',
      reply: `Task "${recentTask.title}" completed!`
    }
  }
  
  if (command === '1H' || command === '1' || command === 'SNOOZE') {
    const newReminderDate = new Date()
    newReminderDate.setHours(newReminderDate.getHours() + 1)
    
    await prisma.task.update({
      where: { id: recentTask.id },
      data: { reminderDate: newReminderDate, reminderSent: false }
    })
    
    return { 
      success: true, 
      action: 'snoozed',
      reply: `Snoozed for 1 hour`
    }
  }
  
  if (command === 'TOM' || command === 'TOMORROW' || command === 'T') {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0) // 9am tomorrow
    
    await prisma.task.update({
      where: { id: recentTask.id },
      data: { reminderDate: tomorrow, reminderSent: false }
    })
    
    return { 
      success: true, 
      action: 'snoozed',
      reply: `Moved to tomorrow 9am`
    }
  }
  
  // If not a command, add as activity/comment
  await prisma.taskActivity.create({
    data: {
      taskId: recentTask.id,
      type: 'comment',
      content: body,
      userId: user.id
    }
  })
  
  return { 
    success: true, 
    action: 'comment',
    reply: `Comment added to "${recentTask.title}"`
  }
}

/**
 * Send test SMS message
 */
export async function sendTestSMS(phoneNumber: string) {
  const testMessage = `TaskManager: SMS reminders activated! You'll receive task reminders here. Reply STOP to unsubscribe.`
  
  // Mock mode - simulate success
  if (SMS_MODE === 'mock') {
    console.log(`[MOCK SMS TEST] Would send to ${phoneNumber}:`)
    console.log(`[MOCK SMS TEST] ${testMessage}`)
    return { 
      success: true, 
      messageId: 'mock-test-' + Date.now(), 
      mock: true,
      message: 'Mock mode: Test SMS simulated (check console)'
    }
  }

  if (!client || !smsNumber) {
    return { 
      success: false, 
      error: 'SMS not configured. Set up Twilio or use mock mode (SMS_MODE=mock)' 
    }
  }

  try {
    const result = await client.messages.create({
      from: smsNumber,
      to: phoneNumber,
      body: testMessage
    })
    
    return { success: true, messageId: result.sid }
  } catch (error: any) {
    console.error('SMS test error:', error)
    
    if (error.code === 21660) {
      return { 
        success: false, 
        error: 'Invalid SMS number in configuration. Need a real Twilio SMS number.' 
      }
    }
    
    return { success: false, error: error.message || 'Failed to send test message' }
  }
}

/**
 * Check and send due reminders via SMS
 */
export async function checkAndSendSMSReminders() {
  const now = new Date()
  
  // Find tasks with reminders that are due
  const tasksWithReminders = await prisma.task.findMany({
    where: {
      reminderDate: {
        lte: now
      },
      reminderSent: false,
      status: {
        not: 'done'
      }
    },
    include: {
      createdBy: true
    }
  })
  
  const results = []
  
  for (const task of tasksWithReminders) {
    if (!task.createdBy) continue
    
    // Check if user has SMS enabled (using whatsappEnabled field)
    if (task.createdBy.whatsappEnabled && task.createdBy.phoneNumber) {
      const result = await sendSMSReminder(task, task.createdBy)
      
      if (result.success) {
        // Mark reminder as sent
        await prisma.task.update({
          where: { id: task.id },
          data: { reminderSent: true }
        })
        
        results.push({ taskId: task.id, status: 'sent', channel: 'sms' })
      } else {
        results.push({ taskId: task.id, status: 'failed', error: result.error })
      }
    } else {
      // Fall back to email reminder (if implemented)
      results.push({ taskId: task.id, status: 'skipped', reason: 'SMS not enabled' })
    }
  }
  
  return results
}

/**
 * Format phone number for SMS
 */
export function formatPhoneForSMS(phone: string): string {
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // Ensure it starts with + for international format
  if (!cleaned.startsWith('+')) {
    // If it's 10 digits, assume US
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned
    }
  }
  
  return cleaned
}
