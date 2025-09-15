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
        sent: results.sent,
        failed: results.failed
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
    
    if (!user || !user.phoneNumber || !user.whatsappEnabled) {
      return NextResponse.json(
        { error: 'SMS not enabled' },
        { status: 400 }
      )
    }
    
    // Send digest to current user only (for testing)
    const { sendDailyDigest } = await import('@/lib/daily-digest')
    const result = await sendDailyDigest(user.id, user.phoneNumber)
    
    return NextResponse.json({
      success: result.success,
      message: 'Test digest sent'
    })
    
  } catch (error) {
    console.error('Test digest error:', error)
    return NextResponse.json(
      { error: 'Failed to send test digest' },
      { status: 500 }
    )
  }
}
