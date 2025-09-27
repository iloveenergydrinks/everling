import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredLinks } from '@/lib/url-shortener'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify the request is authorized (same as other cron endpoints)
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Cleanup expired short links
    await cleanupExpiredLinks()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Expired links cleaned up successfully'
    })
    
  } catch (error) {
    console.error('Cleanup cron error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup expired links' },
      { status: 500 }
    )
  }
}
