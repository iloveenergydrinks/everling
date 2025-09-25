import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendAllDailyDigests } from '@/lib/daily-digest'

// This endpoint should be called once per day at 8am
export async function GET(request: NextRequest) {
  try {
    // Verify the request is authorized
    const authHeader = request.headers.get('authorization')
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    
    // Check if secret matches
    if (secret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Send daily digests to all users
    const results = await sendAllDailyDigests()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total: results.total,
        processed: results.processed,
        details: results.results
      }
    })
    
  } catch (error) {
    console.error('Daily digest cron error:', error)
    return NextResponse.json(
      { error: 'Failed to send daily digests' },
      { status: 500 }
    )
  }
}

// Manual trigger for testing
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Send digest to current user based on their preferences
    const { sendEmailDigest, sendDailyDigest, sendDiscordDigest } = await import('@/lib/daily-digest')
    
    const results = {
      email: { success: false, sent: false },
      sms: { success: false, sent: false },
      discord: { success: false, sent: false }
    }
    
    // Send email digest if enabled
    if ((user.notificationType === 'email' || user.notificationType === 'both') && user.emailDigestEnabled) {
      const emailResponse = await sendEmailDigest(user.id, user.email)
      results.email = { success: emailResponse.success, sent: true }
    }
    
    // Send SMS digest if enabled
    if ((user.notificationType === 'sms' || user.notificationType === 'both') && 
        user.smsDigestEnabled && user.phoneNumber && user.whatsappVerified) {
      const smsResponse = await sendDailyDigest(user.id, user.phoneNumber)
      results.sms = { success: smsResponse.success, sent: true }
    }
    
    // Send Discord digest if enabled
    if (user.discordDigestEnabled && user.discordUserId) {
      const discordResponse = await sendDiscordDigest(user.id, user.discordUserId)
      results.discord = { 
        success: discordResponse.success, 
        sent: true,
        error: discordResponse.error 
      }
    }
    
    // Build response message
    const sentChannels = []
    if (results.email.sent) sentChannels.push('email')
    if (results.sms.sent) sentChannels.push('SMS')
    if (results.discord.sent) sentChannels.push('Discord')
    
    const message = sentChannels.length > 0 
      ? `Test digest sent via ${sentChannels.join(', ')}`
      : 'No digest sent - check your notification preferences'
    
    return NextResponse.json({
      success: results.email.success || results.sms.success || results.discord.success || sentChannels.length === 0,
      message,
      details: results
    })
    
  } catch (error) {
    console.error('Test digest error:', error)
    return NextResponse.json(
      { error: 'Failed to send test digest' },
      { status: 500 }
    )
  }
}
