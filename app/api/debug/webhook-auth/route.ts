import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Only show in development or with secret
  const secret = request.nextUrl.searchParams.get('secret')
  
  if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    authConfigured: !!process.env.POSTMARK_WEBHOOK_AUTH,
    authLength: process.env.POSTMARK_WEBHOOK_AUTH?.length || 0,
    authPrefix: process.env.POSTMARK_WEBHOOK_AUTH?.substring(0, 10) + '...' || 'NOT SET',
    timestamp: new Date().toISOString()
  })
}
