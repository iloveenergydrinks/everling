import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // Check for secret to prevent unauthorized access
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get('secret')
  
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    console.log('Creating short_links table if not exists...')
    
    // Create table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "short_links" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "shortCode" TEXT NOT NULL,
        "originalUrl" TEXT NOT NULL,
        "clicks" INTEGER NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "short_links_pkey" PRIMARY KEY ("id")
      )
    `
    
    // Create indexes
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "short_links_shortCode_key" ON "short_links"("shortCode")
    `
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "short_links_expiresAt_idx" ON "short_links"("expiresAt")
    `
    
    // Test the table
    const count = await prisma.shortLink.count()
    
    return NextResponse.json({
      success: true,
      message: 'short_links table created/verified successfully',
      recordCount: count
    })
  } catch (error: any) {
    console.error('Database fix error:', error)
    return NextResponse.json({
      error: 'Failed to create table',
      details: error.message
    }, { status: 500 })
  }
}
