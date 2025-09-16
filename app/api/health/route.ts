import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()
  
  // These will now show in production logs
  console.log(`[HEALTH CHECK] API accessed at ${timestamp}`)
  console.log('[HEALTH CHECK] Environment:', process.env.NODE_ENV)
  console.log('[HEALTH CHECK] Database URL exists:', !!process.env.DATABASE_URL)
  
  return NextResponse.json({
    status: 'healthy',
    timestamp,
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
  })
}
