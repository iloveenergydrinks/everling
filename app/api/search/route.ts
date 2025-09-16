import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { interpretSearchIntelligently } from '@/lib/tasks-ai'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { query, tasks, timezone } = body

    if (!query || !tasks) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Use AI to interpret and filter tasks
    const results = await interpretSearchIntelligently(query, tasks, {
      timezone: timezone || 'UTC',
      language: request.headers.get('accept-language')?.split(',')[0] || 'en'
    })

    return NextResponse.json(results)

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to process search query' },
      { status: 500 }
    )
  }
}
