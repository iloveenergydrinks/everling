import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Security: Only allow with correct secret
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'not-set'}`
  
  if (authHeader !== expectedAuth) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid CRON_SECRET' },
      { status: 401 }
    )
  }

  try {
    console.log('Starting database schema update...')
    
    // Run prisma db push to update the schema
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss')
    
    console.log('Prisma db push output:', stdout)
    if (stderr) console.error('Prisma db push stderr:', stderr)
    
    return NextResponse.json({
      success: true,
      message: 'Database schema updated successfully',
      output: stdout,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to update database schema:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update database schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
