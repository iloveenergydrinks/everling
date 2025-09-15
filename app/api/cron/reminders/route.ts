import { NextRequest, NextResponse } from 'next/server'
import { checkAndSendSMSReminders } from '@/lib/sms'

// This endpoint should be called by a cron job service (e.g., Vercel Cron, GitHub Actions, or external service)
// Example: Run every 5 minutes to check for due reminders

export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication to ensure only your cron service can call this
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Check and send all due reminders
    const results = await checkAndSendSMSReminders()
    
    const sentCount = results.filter(r => r.status === 'sent').length
    const failedCount = results.filter(r => r.status === 'failed').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    
    console.log(`Reminder cron job completed: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped`)
    
    return NextResponse.json({
      success: true,
      summary: {
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
        total: results.length
      },
      details: results
    })
    
  } catch (error) {
    console.error('Reminder cron job error:', error)
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    )
  }
}

// Manual trigger for testing
export async function POST(request: NextRequest) {
  try {
    // This allows manual triggering from the dashboard for testing
    const session = request.headers.get('cookie')
    
    if (!session?.includes('next-auth.session-token')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const results = await checkAndSendSMSReminders()
    
    return NextResponse.json({
      success: true,
      message: 'Reminders processed',
      results
    })
    
  } catch (error) {
    console.error('Manual reminder trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger reminders' },
      { status: 500 }
    )
  }
}
